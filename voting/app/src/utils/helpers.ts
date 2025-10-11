import { PublicKey, SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  getCompDefAccOffset,
  getComputationAccAddress,
  getMXEAccAddress,
  getMempoolAccAddress,
  getExecutingPoolAccAddress,
  getCompDefAccAddress,
  getClusterAccAddress,
} from "@arcium-hq/client";
import {
  VOTING_PROGRAM_ID,
  CLUSTER_OFFSET,
  ARCIUM_PROGRAM_ID,
  ARCIUM_FEE_POOL_ACCOUNT,
  ARCIUM_CLOCK_ACCOUNT,
} from "@/config/constants";

const SIGNER_PDA_SEED = "SignerAccount";

/**
 * Get computation definition offset for an encrypted instruction
 */
export function getCompDefOffset(instructionName: string): Buffer {
  return Buffer.from(getCompDefAccOffset(instructionName));
}

/**
 * Derive all Arcium-related accounts required by the on-chain program
 */
export function deriveSignerPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SIGNER_PDA_SEED)],
    VOTING_PROGRAM_ID
  );
}

export function deriveArciumAccounts(
  computationOffset: BN,
  compDefInstructionName: string
) {
  const [signPdaAccount] = deriveSignerPDA();
  const compDefOffset = getCompDefOffset(compDefInstructionName).readUInt32LE();

  return {
    signPdaAccount,
    mxeAccount: getMXEAccAddress(VOTING_PROGRAM_ID),
    mempoolAccount: getMempoolAccAddress(VOTING_PROGRAM_ID),
    executingPool: getExecutingPoolAccAddress(VOTING_PROGRAM_ID),
    computationAccount: getComputationAccAddress(
      VOTING_PROGRAM_ID,  // Uses voting program ID as MXE program (ID in macro context)
      computationOffset
    ),
    compDefAccount: getCompDefAccAddress(VOTING_PROGRAM_ID, compDefOffset),
    clusterAccount: getClusterAccAddress(CLUSTER_OFFSET),
    poolAccount: ARCIUM_FEE_POOL_ACCOUNT,
    clockAccount: ARCIUM_CLOCK_ACCOUNT,
    systemProgram: SystemProgram.programId,
    arciumProgram: ARCIUM_PROGRAM_ID,
  };
}

/**
 * Derive poll PDA
 */
export function derivePollPDA(
  authority: PublicKey,
  pollId: number
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("poll"),
      authority.toBuffer(),
      new BN(pollId).toArrayLike(Buffer, "le", 4),
    ],
    VOTING_PROGRAM_ID
  );
}

/**
 * Generate random computation offset
 */
export function generateComputationOffset(): BN {
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);
  // Use little-endian encoding - must pass undefined for base parameter
  return new BN(randomBytes, undefined, "le");
}

/**
 * Generate random nonce for encryption
 */
export function generateNonce(): Uint8Array {
  const nonce = new Uint8Array(16);
  crypto.getRandomValues(nonce);
  return nonce;
}

/**
 * Deserialize little-endian bytes to BN
 */
export function deserializeLE(bytes: Uint8Array): BN {
  return new BN(Buffer.from(bytes), "le");
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format timestamp
 */
export function formatTimestamp(timestamp: BN): string {
  const date = new Date(timestamp.toNumber() * 1000);
  return date.toLocaleString();
}

/**
 * Shorten address for display
 */
export function shortenAddress(address: PublicKey | string): string {
  const str = address.toString();
  return `${str.slice(0, 4)}...${str.slice(-4)}`;
}
