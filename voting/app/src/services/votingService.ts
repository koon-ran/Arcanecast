import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import {
  awaitComputationFinalization,
  getMXEAccAddress,
  getCompDefAccOffset,
  getCompDefAccAddress,
} from "@arcium-hq/client";
import {
  VOTING_PROGRAM_ID,
  COMPUTATION_TIMEOUT_MS,
  ARCIUM_PROGRAM_ID,
} from "@/config/constants";
import { VoteState, RevealState } from "@/types";
import { generateComputationOffset, generateNonce, deriveArciumAccounts, derivePollPDA, deserializeLE } from "@/utils/helpers";
import { hasVoted, saveVote, getVote } from "@/utils/voteStorage";

// Import TypeScript type and JSON IDL
import { Voting } from "@/types/voting";
import VotingIDL from "../../target/types/voting.json";

export class VotingService {
  private program: Program<Voting>;
  private provider: AnchorProvider;

  constructor(connection: Connection, wallet: any) {
    this.provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    this.program = new Program<Voting>(VotingIDL as Voting, this.provider);
  }

  // NOTE: Arcium initialization (MXE + comp defs) must be done ONCE via
  // the test suite on the target cluster before using the frontend.
  // Run: anchor test --skip-build --skip-deploy --provider.cluster devnet

  private async ensureMXEInitialized(): Promise<void> {
    const payer = this.provider.wallet.publicKey;
    if (!payer) {
      throw new Error("Wallet not connected");
    }

    const mxeAccount = getMXEAccAddress(VOTING_PROGRAM_ID);
    const accountInfo = await this.provider.connection.getAccountInfo(mxeAccount);
    if (accountInfo) {
      return;
    }

    const initMXEDiscriminator = Buffer.from([240, 227, 11, 166, 193, 167, 25, 79]);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: mxeAccount, isSigner: false, isWritable: true },
        { pubkey: ARCIUM_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: ARCIUM_PROGRAM_ID,
      data: initMXEDiscriminator,
    });

    const transaction = new Transaction();
    transaction.add(instruction);
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 })
    );
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000_000 })
    );

    const { blockhash, lastValidBlockHeight } = await this.provider.connection.getLatestBlockhash(
      "confirmed"
    );
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = payer;

    const signedTx = await this.provider.wallet.signTransaction(transaction);
    const signature = await this.provider.connection.sendRawTransaction(
      signedTx.serialize(),
      {
        skipPreflight: true,
        preflightCommitment: "confirmed",
      }
    );

    await this.provider.connection.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight,
      },
      "confirmed"
    );
  }

  private async ensureComputationDefinitionInitialized(
    name: "init_vote_stats" | "vote" | "reveal_result"
  ): Promise<void> {
    const payer = this.provider.wallet.publicKey;
    if (!payer) {
      throw new Error("Wallet not connected");
    }

    const mxeAccount = getMXEAccAddress(VOTING_PROGRAM_ID);
    const compDefOffset = Buffer.from(getCompDefAccOffset(name)).readUInt32LE();
    const compDefAccount = getCompDefAccAddress(
      VOTING_PROGRAM_ID,
      compDefOffset
    );

    const accountInfo = await this.provider.connection.getAccountInfo(
      compDefAccount
    );
    if (accountInfo) {
      console.log(`Computation definition ${name} already exists`);
      return;
    }

    console.log(`Initializing computation definition: ${name}`);

    // Call the voting program's init methods (not Arcium directly)
    let method;
    switch (name) {
      case "init_vote_stats":
        method = this.program.methods.initVoteStatsCompDef();
        break;
      case "vote":
        method = this.program.methods.initVoteCompDef();
        break;
      case "reveal_result":
        method = this.program.methods.initRevealResultCompDef();
        break;
    }

    try {
      const signature = await method
        .accounts({
          payer,
          mxeAccount,
          compDefAccount,
        })
        .rpc({ skipPreflight: false, commitment: "confirmed" });

      console.log(`${name} initialized with signature:`, signature);

      await this.provider.connection.confirmTransaction(signature, "confirmed");
    } catch (error: any) {
      console.error(`Failed to initialize ${name}:`, error);
      throw this.formatAnchorError(error, `initialize ${name}`);
    }
  }

  private formatAnchorError(error: any, context: string): Error {
    if (!error) {
      return new Error(`${context} failed with unknown error`);
    }

    const baseMessage = error.message || String(error);
    const logs = Array.isArray((error as any).logs)
      ? (error as any).logs.join("\n")
      : undefined;
    const errorCode = (error as any).errorCode?.code;

    let details = `${context} failed: ${baseMessage}`;
    if (errorCode) {
      details += `\nAnchor error code: ${errorCode}`;
    }
    if (logs) {
      details += `\nProgram logs:\n${logs}`;
    }

    return new Error(details);
  }

  /**
   * Create a new confidential poll
   */
  async createPoll(
    pollId: number,
    question: string,
    cipher: any
  ): Promise<{ signature: string; pollAddress: PublicKey }> {
    const authority = this.provider.wallet.publicKey;
    const [pollPDA] = derivePollPDA(authority, pollId);
    
    // Generate nonce for initial encryption
    const nonce = generateNonce();
    const computationOffset = generateComputationOffset();

    // Derive Arcium accounts - this returns all required accounts including signPdaAccount
    const arciumAccounts = deriveArciumAccounts(
      computationOffset,
      "init_vote_stats"
    );

    // Call create_new_poll with all required accounts in the correct order
    // The Rust program expects: payer, sign_pda_account, mxe_account, mempool_account,
    // executing_pool, computation_account, comp_def_account, cluster_account, 
    // pool_account, clock_account, system_program, arcium_program, poll_acc
    let signature: string;
    try {
      signature = await this.program.methods
        .createNewPoll(
          computationOffset,
          pollId,
          question,
          new BN(deserializeLE(nonce).toString())
        )
        .accountsPartial({
          payer: authority,
          signPdaAccount: arciumAccounts.signPdaAccount,
          mxeAccount: arciumAccounts.mxeAccount,
          mempoolAccount: arciumAccounts.mempoolAccount,
          executingPool: arciumAccounts.executingPool,
          computationAccount: arciumAccounts.computationAccount,
          compDefAccount: arciumAccounts.compDefAccount,
          clusterAccount: arciumAccounts.clusterAccount,
          poolAccount: arciumAccounts.poolAccount,
          clockAccount: arciumAccounts.clockAccount,
          systemProgram: arciumAccounts.systemProgram,
          arciumProgram: arciumAccounts.arciumProgram,
          pollAcc: pollPDA,
        })
  .rpc({ skipPreflight: true, commitment: "confirmed" });
    } catch (error: any) {
      // Check if poll was actually created despite the error
      const errorMsg = error?.message || String(error);
      if (errorMsg.includes("already been processed") || errorMsg.includes("Blockhash not found")) {
        // Poll might have been created, check if account exists
        try {
          const pollAccount = await this.program.account.pollAccount.fetch(pollPDA);
          if (pollAccount) {
            console.log("Poll was created successfully despite error");
            signature = ""; // We don't have the signature but poll exists
          } else {
            throw this.formatAnchorError(error, "createNewPoll");
          }
        } catch (fetchError) {
          // Account doesn't exist, original error is real
          throw this.formatAnchorError(error, "createNewPoll");
        }
      } else {
        throw this.formatAnchorError(error, "createNewPoll");
      }
    }

    console.log("Poll creation transaction sent:", signature);
    console.log("Waiting for MPC computation to complete...");
    console.log("Computation offset:", computationOffset.toString());

    // Wait for MPC computation to complete with timeout
    try {
      const finalizationPromise = awaitComputationFinalization(
        this.provider,
        computationOffset,
        VOTING_PROGRAM_ID,
        "finalized" // Use 'finalized' commitment for better reliability
      );

      // Add 3 minute timeout (MPC can take time on first circuit execution)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Computation finalization timed out after 3 minutes")), 180000);
      });

      const result = await Promise.race([finalizationPromise, timeoutPromise]);
      console.log("MPC computation completed successfully:", result);
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      console.error("MPC computation error:", errorMessage);
      
      // Check if computation actually completed despite the error
      // Sometimes awaitComputationFinalization has issues detecting completion
      if (errorMessage.includes("timeout") || errorMessage.includes("not found")) {
        console.warn("Finalization wait failed, but poll may still have been created. Checking poll account...");
        
        try {
          const pollAccount = await this.program.account.pollAccount.fetch(pollPDA);
          if (pollAccount && pollAccount.voteState && pollAccount.voteState[0].some((b: number) => b !== 0)) {
            console.log("Poll was successfully initialized! Vote state exists.");
            // Poll exists and has vote state, computation succeeded
            return { signature, pollAddress: pollPDA };
          }
        } catch (fetchError) {
          // Continue to throw original error
        }
      }
      
      // Poll was created but computation failed/timed out
      throw new Error(
        `Poll created but MPC computation failed: ${errorMessage}. ` +
        `The poll exists at ${pollPDA.toString()} but vote statistics initialization may be incomplete.`
      );
    }

    return { signature, pollAddress: pollPDA };
  }

  /**
   * Check if the current wallet has voted on a poll
   */
  hasVotedOnPoll(authority: PublicKey, pollId: number): boolean {
    return hasVoted(authority.toString(), pollId);
  }

  /**
   * Get the user's vote on a poll (if any)
   */
  getUserVote(authority: PublicKey, pollId: number): { vote: "yes" | "no"; signature: string } | null {
    const voteRecord = getVote(authority.toString(), pollId);
    if (!voteRecord) return null;
    return {
      vote: voteRecord.vote,
      signature: voteRecord.signature,
    };
  }

  /**
   * Cast an encrypted vote
   */
  async castVote(
    pollId: number,
    vote: boolean,
    cipher: any,
    clientPublicKey: Uint8Array,
    authority: PublicKey,
    onStatusChange?: (status: VoteState) => void
  ): Promise<string> {
    const [pollPDA] = derivePollPDA(authority, pollId);
    
    // Check if user has already voted (client-side check)
    if (hasVoted(authority.toString(), pollId)) {
      const existingVote = getVote(authority.toString(), pollId);
      throw new Error(
        `You have already voted ${existingVote?.vote.toUpperCase()} on this poll. ` +
        `Each wallet can only vote once.`
      );
    }
    
    // Fetch current poll account
    const pollAccount = await this.program.account.pollAccount.fetch(pollPDA);

    // Encrypt the vote
    const plaintext = [BigInt(vote ? 1 : 0)];
    const nonce = generateNonce();
    const ciphertext = cipher.encrypt(plaintext, nonce);

    const computationOffset = generateComputationOffset();

    // Update status: encrypting complete
    onStatusChange?.({
      pollId,
      computationOffset,
      status: "queued",
      txSignatures: {},
    });

    // Derive Arcium accounts
    const arciumAccounts = deriveArciumAccounts(computationOffset, "vote");

    // Queue the vote computation with explicit account ordering
    let queueSignature: string;
    try {
      queueSignature = await this.program.methods
        .vote(
          computationOffset,
          pollId,
          Array.from(ciphertext[0]),
          Array.from(clientPublicKey),
          new BN(deserializeLE(nonce).toString())
        )
        .accountsPartial({
          payer: this.provider.wallet.publicKey,
          signPdaAccount: arciumAccounts.signPdaAccount,
          mxeAccount: arciumAccounts.mxeAccount,
          mempoolAccount: arciumAccounts.mempoolAccount,
          executingPool: arciumAccounts.executingPool,
          computationAccount: arciumAccounts.computationAccount,
          compDefAccount: arciumAccounts.compDefAccount,
          clusterAccount: arciumAccounts.clusterAccount,
          poolAccount: arciumAccounts.poolAccount,
          clockAccount: arciumAccounts.clockAccount,
          systemProgram: arciumAccounts.systemProgram,
          arciumProgram: arciumAccounts.arciumProgram,
          pollAcc: pollPDA,
          authority: authority,
        })
        .rpc({ skipPreflight: true, commitment: "confirmed" });
    } catch (error) {
      throw this.formatAnchorError(error, "vote");
    }

    console.log("Vote queued with signature:", queueSignature);
    console.log("Waiting for MPC computation to finalize vote...");

    // Update status: processing
    onStatusChange?.({
      pollId,
      computationOffset,
      status: "processing",
      txSignatures: { queue: queueSignature },
    });

    // Wait for MPC computation with timeout
    let finalizeSignature: string;
    try {
      const finalizationPromise = awaitComputationFinalization(
        this.provider,
        computationOffset,
        VOTING_PROGRAM_ID,
        "confirmed"
      );

      // Add 3 minute timeout
      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error("Vote computation timed out after 3 minutes")), 180000);
      });

      finalizeSignature = await Promise.race([finalizationPromise, timeoutPromise]);
      console.log("Vote MPC computation completed:", finalizeSignature);
      
      // Save vote to localStorage after successful finalization
      saveVote(
        authority.toString(),
        pollId,
        vote ? "yes" : "no",
        queueSignature
      );
    } catch (error: any) {
      console.error("Vote MPC computation error:", error);
      throw new Error(`Vote submitted but MPC computation failed: ${error.message}`);
    }

    // Update status: confirmed
    onStatusChange?.({
      pollId,
      computationOffset,
      status: "confirmed",
      txSignatures: {
        queue: queueSignature,
        finalize: finalizeSignature,
      },
    });

    return queueSignature; // Return queue signature so frontend can show it
  }

  /**
   * Reveal poll results (authority only)
   */
  async revealResults(
    pollId: number,
    onStatusChange?: (status: RevealState) => void
  ): Promise<boolean> {
    const authority = this.provider.wallet.publicKey;
    const [pollPDA] = derivePollPDA(authority, pollId);

    // Fetch poll to check current vote state
    const pollAccount = await this.program.account.pollAccount.fetch(pollPDA);
    console.log("Poll account before reveal:", {
      id: pollAccount.id,
      nonce: pollAccount.nonce.toString(),
      voteState: pollAccount.voteState.map((arr: number[]) => 
        arr.slice(0, 8).map((b: number) => b.toString(16).padStart(2, '0')).join('')
      )
    });

    const computationOffset = generateComputationOffset();

    // Update status: queued
    onStatusChange?.({
      pollId,
      computationOffset,
      status: "queued",
    });

    // Derive Arcium accounts
    const arciumAccounts = deriveArciumAccounts(
      computationOffset,
      "reveal_result"
    );

    // Queue reveal computation with explicit account ordering
    let queueSignature: string;
    try {
      queueSignature = await this.program.methods
        .revealResult(computationOffset, pollId)
        .accountsPartial({
          payer: authority,
          signPdaAccount: arciumAccounts.signPdaAccount,
          mxeAccount: arciumAccounts.mxeAccount,
          mempoolAccount: arciumAccounts.mempoolAccount,
          executingPool: arciumAccounts.executingPool,
          computationAccount: arciumAccounts.computationAccount,
          compDefAccount: arciumAccounts.compDefAccount,
          clusterAccount: arciumAccounts.clusterAccount,
          poolAccount: arciumAccounts.poolAccount,
          clockAccount: arciumAccounts.clockAccount,
          systemProgram: arciumAccounts.systemProgram,
          arciumProgram: arciumAccounts.arciumProgram,
          pollAcc: pollPDA,
        })
        .rpc({ skipPreflight: true, commitment: "confirmed" });
    } catch (error) {
      throw this.formatAnchorError(error, "revealResult");
    }

    console.log("Reveal queued with signature:", queueSignature);
    console.log("Waiting for MPC reveal computation...");

    // Update status: processing
    onStatusChange?.({
      pollId,
      computationOffset,
      status: "processing",
    });

    // Set up event listener for the result BEFORE waiting for finalization
    let actualResult: boolean | null = null;
    const eventPromise = new Promise<boolean>((resolve) => {
      const listener = this.program.addEventListener("revealResultEvent", (event: any) => {
        console.log("RevealResultEvent received:", event);
        actualResult = event.output;
        resolve(event.output);
      });
      // Store listener ID to remove later if needed
      setTimeout(() => {
        this.program.removeEventListener(listener);
      }, 180000); // 3 minute timeout
    });

    // Wait for MPC computation with timeout
    try {
      const finalizationPromise = awaitComputationFinalization(
        this.provider,
        computationOffset,
        VOTING_PROGRAM_ID,
        "confirmed"
      );

      // Add 3 minute timeout
      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error("Reveal computation timed out after 3 minutes")), 180000);
      });

      await Promise.race([finalizationPromise, timeoutPromise]);
      console.log("Reveal MPC computation completed");
    } catch (error: any) {
      console.error("Reveal MPC computation error:", error);
      throw new Error(`Reveal submitted but MPC computation failed: ${error.message}`);
    }

    // Wait for the event to get the actual result
    console.log("Waiting for reveal result event...");
    try {
      actualResult = await Promise.race([
        eventPromise,
        new Promise<boolean>((_, reject) => 
          setTimeout(() => reject(new Error("Event not received within 30 seconds")), 30000)
        )
      ]);
      console.log("Poll result:", actualResult ? "YES WINS" : "NO WINS");
    } catch (error) {
      console.error("Failed to get reveal result event:", error);
      throw new Error("Reveal computation completed but result could not be retrieved. Please try again.");
    }

    // Update status: confirmed with actual result
    onStatusChange?.({
      pollId,
      computationOffset,
      status: "confirmed",
      result: actualResult,
    });

    return actualResult;
  }

  /**
   * Fetch a specific poll
   */
  async fetchPoll(authority: PublicKey, pollId: number) {
    const [pollPDA] = derivePollPDA(authority, pollId);
    return this.program.account.pollAccount.fetch(pollPDA);
  }

  /**
   * Fetch all polls for an authority
   */
  async fetchAllPolls(authority: PublicKey) {
    const polls = await this.program.account.pollAccount.all([
      {
        memcmp: {
          offset: 8 + 1 + 64 + 4, // discriminator + bump + voteState + id
          bytes: authority.toBase58(),
        },
      },
    ]);
    return polls;
  }

  /**
   * Wait for reveal result event
   */
  private async waitForRevealEvent(timeout: number = COMPUTATION_TIMEOUT_MS): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Timeout waiting for reveal event"));
      }, timeout);

      const listener = this.program.addEventListener(
        "revealResultEvent",
        (event: any) => {
          clearTimeout(timer);
          this.program.removeEventListener(listener);
          resolve(event.output);
        }
      );
    });
  }
}
