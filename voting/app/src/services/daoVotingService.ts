/**
 * DAO Multi-Option Voting Service
 * Handles MPC-encrypted voting on polls with 2-4 options
 */

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
  getMXEAccAddress,
  getCompDefAccOffset,
  getCompDefAccAddress,
} from "@arcium-hq/client";
import {
  VOTING_PROGRAM_ID,
  ARCIUM_PROGRAM_ID,
} from "@/config/constants";
import { Voting } from "@/types/voting";
import VotingIDL from "../../target/types/voting.json";
import { generateComputationOffset, generateNonce, deriveArciumAccounts, deserializeLE } from "@/utils/helpers";

// Derive multi-option poll PDA
function deriveMultiOptionPollPDA(pollId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("multi_option_poll"), Buffer.from([pollId])],
    VOTING_PROGRAM_ID
  );
}

export interface MultiOptionVoteState {
  pollId: number;
  computationOffset: number;
  status: "encrypting" | "queued" | "processing" | "confirmed" | "error";
  txSignatures?: {
    queue?: string;
  };
  error?: string;
}

export class DAOVotingService {
  private program: Program<Voting>;
  private provider: AnchorProvider;

  constructor(connection: Connection, wallet: any) {
    this.provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    this.program = new Program<Voting>(VotingIDL as Voting, this.provider);
  }

  /**
   * Cast an encrypted vote on a multi-option poll
   * @param pollId - The on-chain poll ID
   * @param optionIndex - Selected option (0-3 for options A-D)
   * @param cipher - Arcium cipher instance for encryption
   * @param clientPublicKey - Encryption public key
   * @param onStatusChange - Callback for status updates
   * @returns Transaction signature
   */
  async castMultiOptionVote(
    pollId: number,
    optionIndex: number,
    cipher: any,
    clientPublicKey: Uint8Array,
    onStatusChange?: (status: MultiOptionVoteState) => void
  ): Promise<string> {
    const authority = this.provider.wallet.publicKey;
    if (!authority) {
      throw new Error("Wallet not connected");
    }

    // Validate option index
    if (optionIndex < 0 || optionIndex > 3) {
      throw new Error("Option index must be between 0 and 3");
    }

    const [pollPDA] = deriveMultiOptionPollPDA(pollId);
    
    // Update status: encrypting
    const computationOffset = generateComputationOffset();
    onStatusChange?.({
      pollId,
      computationOffset: computationOffset as any as number,
      status: "encrypting",
    });

    // Encrypt the selected option index
    const plaintext = [BigInt(optionIndex)];
    const nonce = generateNonce();
    const ciphertext = cipher.encrypt(plaintext, nonce);

    console.log(`[DAO Vote] Encrypting vote for option ${optionIndex} on poll ${pollId}`);

    // Update status: queued
    onStatusChange?.({
      pollId,
      computationOffset: computationOffset as any as number,
      status: "queued",
    });

    // Derive Arcium accounts for vote computation
    const arciumAccounts = deriveArciumAccounts(computationOffset, "vote_multi_option");

    // Queue the vote computation
    let queueSignature: string;
    try {
      queueSignature = await this.program.methods
        .voteMultiOption(
          computationOffset,
          pollId,
          Array.from(ciphertext[0]),  // encrypted option index
          Array.from(clientPublicKey),
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

      console.log(`[DAO Vote] Vote queued with signature: ${queueSignature}`);
      console.log(`[DAO Vote] MPC will process vote in background`);
    } catch (error: any) {
      console.error("[DAO Vote] Error queuing vote:", error);
      onStatusChange?.({
        pollId,
        computationOffset: computationOffset as any as number,
        status: "error",
        error: error.message || "Failed to queue vote",
      });
      throw new Error(`Failed to cast vote: ${error.message}`);
    }

    // Update status: processing
    onStatusChange?.({
      pollId,
      computationOffset: computationOffset as any as number,
      status: "processing",
      txSignatures: { queue: queueSignature },
    });

    // Note: MPC computation happens asynchronously
    // The encrypted vote will be processed by the MPC network
    // and added to the encrypted vote tally

    // Update status: confirmed
    onStatusChange?.({
      pollId,
      computationOffset: computationOffset as any as number,
      status: "confirmed",
      txSignatures: { queue: queueSignature },
    });

    return queueSignature;
  }

  /**
   * Check if a poll exists on-chain
   */
  async pollExists(pollId: number): Promise<boolean> {
    try {
      const [pollPDA] = deriveMultiOptionPollPDA(pollId);
      const account = await this.provider.connection.getAccountInfo(pollPDA);
      return account !== null;
    } catch (error) {
      console.error("[DAO Vote] Error checking poll existence:", error);
      return false;
    }
  }

  /**
   * Fetch multi-option poll account
   */
  async fetchMultiOptionPoll(pollId: number) {
    const [pollPDA] = deriveMultiOptionPollPDA(pollId);
    return (this.program.account as any).multiOptionPollAccount.fetch(pollPDA);
  }

  /**
   * Create a new multi-option poll on-chain
   * Note: This should be called by backend/admin, not by frontend users
   * TODO: Fix method signature to match program interface
   */
  /*
  async createMultiOptionPoll(
    pollId: number,
    question: string,
    options: string[]
  ): Promise<string> {
    const authority = this.provider.wallet.publicKey;
    if (!authority) {
      throw new Error("Wallet not connected");
    }

    if (options.length < 2 || options.length > 4) {
      throw new Error("Poll must have 2-4 options");
    }

    const [pollPDA] = deriveMultiOptionPollPDA(pollId);

    try {
      const signature = await this.program.methods
        .createMultiOptionPoll(pollId, question, options)
        .accounts({
          pollAcc: pollPDA,
          authority: authority,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ skipPreflight: false, commitment: "confirmed" });

      console.log(`[DAO Poll] Created multi-option poll ${pollId}: ${signature}`);
      return signature;
    } catch (error: any) {
      console.error("[DAO Poll] Error creating poll:", error);
      throw new Error(`Failed to create poll: ${error.message}`);
    }
  }
  */
}
