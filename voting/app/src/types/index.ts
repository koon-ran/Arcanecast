import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

// Poll account structure
export interface PollAccount {
  bump: number;
  voteState: number[][]; // [[yes_encrypted], [no_encrypted]]
  id: number;
  authority: PublicKey;
  nonce: BN;
  question: string;
}

// Computation status
export type ComputationStatus =
  | "idle"
  | "encrypting"
  | "queued"
  | "processing"
  | "confirmed"
  | "failed";

// Vote state for tracking
export interface VoteState {
  pollId: number;
  computationOffset: BN;
  status: ComputationStatus;
  txSignatures: {
    queue?: string;
    finalize?: string;
  };
  error?: string;
}

// Reveal state
export interface RevealState {
  pollId: number;
  computationOffset: BN;
  status: ComputationStatus;
  result?: boolean;
  error?: string;
}

// Events
export interface VoteEvent {
  timestamp: BN;
}

export interface RevealResultEvent {
  output: boolean;
}

// Arcium context
export interface ArciumContextType {
  isReady: boolean;
  mxePublicKey: Uint8Array | null;
  clientPrivateKey: Uint8Array | null;
  clientPublicKey: Uint8Array | null;
  cipher: any | null; // RescueCipher
  error: string | null;
  initialize: () => Promise<void>;
}
