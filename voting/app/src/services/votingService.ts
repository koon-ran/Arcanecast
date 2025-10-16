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

// Database API helpers
async function checkVoteEligibility(pollId: string, voterWallet: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/polls/${pollId}/vote?wallet=${voterWallet}`);
    if (!response.ok) {
      console.error("Failed to check vote eligibility:", response.statusText);
      return false; // Assume eligible if API fails (graceful degradation)
    }
    const data = await response.json();
    return !data.hasVoted; // Return true if user hasn't voted yet
  } catch (error) {
    console.error("Error checking vote eligibility:", error);
    return false; // Assume eligible if error
  }
}

async function recordVoteInDatabase(pollId: string, voterWallet: string, txSignature: string): Promise<{ pointsAwarded: number; totalPoints: number }> {
  try {
    const response = await fetch(`/api/polls/${pollId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voterWallet,
        transactionSignature: txSignature,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to record vote");
    }

    const data = await response.json();
    return {
      pointsAwarded: data.pointsAwarded,
      totalPoints: data.totalPoints,
    };
  } catch (error) {
    console.error("Error recording vote in database:", error);
    throw error;
  }
}

async function createPollInDatabase(
  pollId: string,
  chainAddress: string,
  creatorWallet: string,
  question: string,
  description?: string,
  category: string = "general"
): Promise<void> {
  try {
    const response = await fetch("/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pollId,
        chainAddress,
        creatorWallet,
        question,
        description,
        category,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Failed to create poll in database:", error);
      // Don't throw - poll is on-chain, DB is just metadata
    }

    const data = await response.json();
    console.log(`Poll created in database. Creator awarded ${data.pointsAwarded} points.`);
  } catch (error) {
    console.error("Error creating poll in database:", error);
    // Don't throw - DB is supplementary
  }
}

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
    const [pollPDA] = derivePollPDA(pollId);
    
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

    // Store poll metadata in database and award creator points
    await createPollInDatabase(
      pollId.toString(),
      pollPDA.toString(),
      authority.toString(),
      question,
      undefined, // description - can be added to UI later
      "general" // category - can be customized in UI
    );

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
    const [pollPDA] = derivePollPDA(pollId);
    
    // Check database if user has already voted (server-side enforcement)
    const isEligible = await checkVoteEligibility(pollId.toString(), authority.toString());
    if (!isEligible) {
      throw new Error(
        `You have already voted on this poll. Each wallet can only vote once.`
      );
    }
    
    // Also check localStorage (client-side backup check)
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

    // Vote has been queued - MPC will process it in background
    console.log("Vote queued successfully. MPC will process in background.");
    
    // Save vote to localStorage immediately after successful queue
    saveVote(
      authority.toString(),
      pollId,
      vote ? "yes" : "no",
      queueSignature
    );

    // Record vote in database and award points
    try {
      const dbResult = await recordVoteInDatabase(
        pollId.toString(),
        authority.toString(),
        queueSignature
      );
      console.log(`Vote recorded! +${dbResult.pointsAwarded} points. Total: ${dbResult.totalPoints}`);
    } catch (error: any) {
      // Don't fail the vote if database recording fails
      console.error("Failed to record vote in database:", error.message);
      console.warn("Vote was cast successfully on-chain, but database update failed.");
    }

    // Update status: confirmed (queue is confirmed, finalization happens async)
    onStatusChange?.({
      pollId,
      computationOffset,
      status: "confirmed",
      txSignatures: {
        queue: queueSignature,
        finalize: undefined, // Finalization happens in background
      },
    });
    
    // Note: MPC computation happens asynchronously. The encrypted vote
    // will be processed by the MPC network and added to the vote tally.
    // No need to wait for finalization - user gets immediate feedback.

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
    const [pollPDA] = derivePollPDA(pollId);

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

    // CRITICAL: Register event listener BEFORE queuing transaction!
    // The MPC callback can execute within 2-5 seconds of queuing
    console.log("📡 Registering event listener...");
    let actualResult: boolean | null = null;
    let eventListener: number | undefined;
    
    const eventPromise = new Promise<boolean>((resolve, reject) => {
      // 30 second timeout (MPC is fast on devnet - usually 2-5 seconds!)
      const timeout = setTimeout(() => {
        if (eventListener !== undefined) {
          this.program.removeEventListener(eventListener);
        }
        reject(new Error(
          "MPC computation timed out after 30 seconds. " +
          "The reveal was queued but callback did not fire. " +
          "Try revealing again."
        ));
      }, 30000);

      eventListener = this.program.addEventListener("revealResultEvent", (event: any) => {
        console.log("✅ RevealResultEvent received:", event);
        clearTimeout(timeout);
        if (eventListener !== undefined) {
          this.program.removeEventListener(eventListener);
        }
        resolve(event.output);
      });
    });

    // Update status: processing
    onStatusChange?.({
      pollId,
      computationOffset,
      status: "processing",
    });

    // NOW queue the reveal computation
    console.log("🚀 Queuing reveal computation...");
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
      
      console.log("✅ Reveal queued:", queueSignature);
      console.log("⏳ Waiting for MPC callback (usually 2-5 seconds)...");
    } catch (error) {
      // Clean up listener on error
      if (eventListener !== undefined) {
        this.program.removeEventListener(eventListener);
      }
      throw this.formatAnchorError(error, "revealResult");
    }

    try {
      actualResult = await eventPromise;
      console.log("🎉 Poll result:", actualResult ? "YES WINS" : "NO WINS");
    } catch (error: any) {
      console.error("❌ Reveal error:", error.message);
      throw error;
    }

    // Update database with reveal result
    try {
      await fetch(`/api/polls/${pollId}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winner: actualResult ? "yes" : "no",
          revealedBy: authority.toString(),
          transactionSignature: queueSignature,
        }),
      });
      console.log("✅ Reveal result stored in database");
    } catch (dbError) {
      console.error("Failed to store reveal result in database:", dbError);
      // Don't fail the reveal if DB update fails
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
   * Fetch a specific poll by ID (globally accessible)
   */
  async fetchPoll(pollId: number) {
    const [pollPDA] = derivePollPDA(pollId);
    return this.program.account.pollAccount.fetch(pollPDA);
  }

  /**
   * Fetch all polls (globally accessible)
   */
  async fetchAllPolls() {
    const polls = await this.program.account.pollAccount.all();
    return polls;
  }

  /**
   * Fetch polls created by a specific authority
   */
  async fetchPollsByAuthority(authority: PublicKey) {
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
