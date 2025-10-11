import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  TransactionInstruction,
  Transaction,
  SystemProgram,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  getMXEAccAddress,
  getMempoolAccAddress,
  getExecutingPoolAccAddress,
  getComputationAccAddress,
  getCompDefAccAddress,
  getCompDefAccOffset,
  getClusterAccAddress,
} from "@arcium-hq/client";
import { randomBytes } from "crypto";
import * as fs from "fs";
import * as os from "os";

const VOTING_PROGRAM_ID = new PublicKey(
  "665esySAfjG6KFU7oGMEZNHbnK17xh92LCiXmxoUhzv8"
);
const ARCIUM_PROGRAM_ID = new PublicKey(
  "BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6"
);
const ARCIUM_FEE_POOL_ACCOUNT = new PublicKey(
  "7MGSS4iKNM4sVib7bDZDJhVqB6EcchPwVnTKenCY1jt3"
);
const ARCIUM_CLOCK_ACCOUNT = new PublicKey(
  "FHriyvoZotYiFnbUzKFjzRSb2NiaC8RPWY7jtKuKhg65"
);
const CLUSTER_OFFSET = 1078779259;
const SIGNER_PDA_SEED = "SignerAccount";

function readKeypair(): anchor.web3.Keypair {
  const path = `${os.homedir()}/.config/solana/id.json`;
  const secretKeyString = fs.readFileSync(path, { encoding: "utf8" });
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  return anchor.web3.Keypair.fromSecretKey(secretKey);
}

function deriveSignerPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SIGNER_PDA_SEED)],
    VOTING_PROGRAM_ID
  );
}

function derivePollPDA(authority: PublicKey, pollId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("poll"),
      authority.toBuffer(),
      new anchor.BN(pollId).toArrayLike(Buffer, "le", 4),
    ],
    VOTING_PROGRAM_ID
  );
}

async function main() {
  const keypair = readKeypair();
  const rpcUrl =
    process.env.RPC_URL ||
    "https://devnet.helius-rpc.com/?api-key=98664a07-fdde-46f8-ac7d-7efd848339c4";
  const connection = new Connection(rpcUrl, "confirmed");

  const pollId = Number(process.argv[2] || 1);
  const question = process.argv[3] || "Simulation poll";

  const manualOffset = process.env.COMP_OFFSET;
  let computationOffset = manualOffset
    ? new anchor.BN(manualOffset)
    : new anchor.BN(randomBytes(8), "le");
  const nonce = new anchor.BN(randomBytes(16), "le");

  console.log("Computation offset (BN):", computationOffset.toString());
  console.log("Computation offset (hex):", computationOffset.toString(16));
  console.log("Computation offset (LE bytes):", Array.from(computationOffset.toArrayLike(Buffer, 'le', 8)));
  console.log("Computation offset type:", typeof computationOffset);

  const [signPdaAccount] = deriveSignerPDA();
  const [pollPDA] = derivePollPDA(keypair.publicKey, pollId);

  const compDefOffset = Buffer.from(
    getCompDefAccOffset("init_vote_stats")
  ).readUInt32LE(0);

  const accounts = {
    payer: keypair.publicKey,
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
    pollAcc: pollPDA,
  };

  const idl = JSON.parse(
    fs.readFileSync("./target/idl/voting.json", { encoding: "utf8" })
  );
  const coder = new anchor.BorshCoder(idl);

  // Try encoding with explicit types
  const encodedData = {
    computationOffset: computationOffset.toNumber(),  // Convert to number
    id: pollId,
    question,
    nonce: nonce,  // Keep as BN for u128
  };
  console.log("\n=== Data to encode ===");
  console.log("computationOffset:", encodedData.computationOffset, "type:", typeof encodedData.computationOffset);
  console.log("id:", encodedData.id, "type:", typeof encodedData.id);
  console.log("nonce:", encodedData.nonce.toString());
  
  const data = coder.instruction.encode("create_new_poll", encodedData);

  console.log("\n=== Instruction Data (hex) ===");
  console.log("Full instruction data:", data.toString("hex"));
  console.log("First 8 bytes (discriminator):", data.slice(0, 8).toString("hex"));
  console.log("Next 8 bytes (computation_offset):", data.slice(8, 16).toString("hex"));
  console.log("Next 4 bytes (id):", data.slice(16, 20).toString("hex"));

  const keys = [
    { pubkey: accounts.payer, isSigner: true, isWritable: true },
    { pubkey: accounts.signPdaAccount, isSigner: false, isWritable: true },
    { pubkey: accounts.mxeAccount, isSigner: false, isWritable: false },
    { pubkey: accounts.mempoolAccount, isSigner: false, isWritable: true },
    { pubkey: accounts.executingPool, isSigner: false, isWritable: true },
    { pubkey: accounts.computationAccount, isSigner: false, isWritable: true },
    { pubkey: accounts.compDefAccount, isSigner: false, isWritable: false },
    { pubkey: accounts.clusterAccount, isSigner: false, isWritable: true },
    { pubkey: accounts.poolAccount, isSigner: false, isWritable: true },
    { pubkey: accounts.clockAccount, isSigner: false, isWritable: false },
    { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
    { pubkey: accounts.arciumProgram, isSigner: false, isWritable: false },
    { pubkey: accounts.pollAcc, isSigner: false, isWritable: true },
  ];

  const instruction = new TransactionInstruction({
    programId: VOTING_PROGRAM_ID,
    keys,
    data,
  });

  const tx = new Transaction();
  tx.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
    instruction
  );
  tx.feePayer = keypair.publicKey;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(
    "confirmed"
  );
  tx.recentBlockhash = blockhash;

  tx.sign(keypair);

  const simulation = await connection.simulateTransaction(tx, [keypair]);

  console.log("\n=== PDA Verification ===");
  console.log("Derived computation account:", accounts.computationAccount.toBase58());
  
  // Manual derivation to verify
  const manualPDA = PublicKey.findProgramAddressSync(
    [
      Buffer.from("ComputationAccount"),
      VOTING_PROGRAM_ID.toBuffer(),
      computationOffset.toArrayLike(Buffer, "le", 8),
    ],
    ARCIUM_PROGRAM_ID
  )[0];
  console.log("Manual PDA derivation:      ", manualPDA.toBase58());
  console.log("Match:", accounts.computationAccount.equals(manualPDA));
  
  console.log("\nSimulation result:");
  console.dir(simulation, { depth: null });
  console.log("Accounts used:");
  console.dir(accounts, { depth: null });
}

main().catch((err) => {
  console.error("Simulation failed:", err);
  if (err.logs) {
    console.error("Logs:\n", err.logs.join("\n"));
  }
  process.exit(1);
});
