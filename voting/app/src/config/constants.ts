import { PublicKey } from "@solana/web3.js";

// Network configuration
export const NETWORK = process.env.NEXT_PUBLIC_NETWORK || "devnet";
export const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_RPC_ENDPOINT || "https://devnet.helius-rpc.com/?api-key=98664a07-fdde-46f8-ac7d-7efd848339c4";

// Program IDs
export const VOTING_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_VOTING_PROGRAM_ID ||
    "FHuabcvigE645KXLy4KCFCLkLx1jLxi1nwFYs8ajWyYd"
);

export const ARCIUM_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_ARCIUM_PROGRAM_ID ||
    "BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6"
);

export const ARCIUM_FEE_POOL_ACCOUNT = new PublicKey(
  process.env.NEXT_PUBLIC_ARCIUM_FEE_POOL_ACCOUNT ||
    "7MGSS4iKNM4sVib7bDZDJhVqB6EcchPwVnTKenCY1jt3"
);

export const ARCIUM_CLOCK_ACCOUNT = new PublicKey(
  process.env.NEXT_PUBLIC_ARCIUM_CLOCK_ACCOUNT ||
    "FHriyvoZotYiFnbUzKFjzRSb2NiaC8RPWY7jtKuKhg65"
);

// Arcium cluster configuration
// IMPORTANT: This must match the --cluster-offset used during arcium deploy
// Using official Arcium devnet cluster: 1078779259
export const CLUSTER_OFFSET = 1078779259;

// Configuration
export const COMPUTATION_TIMEOUT_MS = 300000; // 5 minutes (MPC can be slow on devnet)
export const POLL_REFRESH_INTERVAL_MS = 5000; // 5 seconds
export const MAX_QUESTION_LENGTH = 50;
