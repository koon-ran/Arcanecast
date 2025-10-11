import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, SystemProgram } from "@solana/web3.js";
import {
  getMXEAccAddress,
  getMempoolAccAddress,
  getExecutingPoolAccAddress,
  getComputationAccAddress,
  getCompDefAccAddress,
  getCompDefAccOffset,
  getClusterAccAddress,
} from "@arcium-hq/client";
import { Voting } from "../target/types/voting";
import * as fs from "fs";
import * as os from "os";
import { randomBytes } from "crypto";

const VOTING_PROGRAM_ID = new PublicKey(
  "665esySAfjG6KFU7oGMEZNHbnK17xh92LCiXmxoUhzv8"
);
const programId = VOTING_PROGRAM_ID;
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
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const idl = require("../target/idl/voting.json");
  // @ts-ignore - using runtime IDL
  const program = new anchor.Program(idl as Voting, VOTING_PROGRAM_ID, provider);

  const pollId = Number(process.argv[2] || 1);
  const question = process.argv[3] || "Test question";

  const computationOffset = new anchor.BN(randomBytes(8), "le");
  const nonceBytes = randomBytes(16);
  const nonceBn = new anchor.BN(nonceBytes, "le");

  const [pollPDA] = derivePollPDA(wallet.publicKey, pollId);
  const [signPdaAccount] = deriveSignerPDA();

  const compDefOffsetBuf = getCompDefAccOffset("init_vote_stats");
  const compDefOffset = Buffer.from(compDefOffsetBuf).readUInt32LE(0);

  const arciumAccounts = {
    signPdaAccount,
    mxeAccount: getMXEAccAddress(VOTING_PROGRAM_ID),
    mempoolAccount: getMempoolAccAddress(VOTING_PROGRAM_ID),
    executingPool: getExecutingPoolAccAddress(VOTING_PROGRAM_ID),
    computationAccount: getComputationAccAddress(
      VOTING_PROGRAM_ID,
      computationOffset
    ),
    compDefAccount: getCompDefAccAddress(VOTING_PROGRAM_ID, compDefOffset),
    clusterAccount: getClusterAccAddress(CLUSTER_OFFSET),
    poolAccount: ARCIUM_FEE_POOL_ACCOUNT,
    clockAccount: ARCIUM_CLOCK_ACCOUNT,
    systemProgram: SystemProgram.programId,
    arciumProgram: ARCIUM_PROGRAM_ID,
  };

  console.log("Using computation offset:", computationOffset.toString());
  console.log("Derived accounts:");
  console.dir(arciumAccounts, { depth: null });

  try {
    // @ts-ignore - account typing handled at runtime
    const simulation = await program.methods
      .createNewPoll(computationOffset, pollId, question, nonceBn)
      // @ts-ignore - account typing handled at runtime
      .accounts({
        payer: wallet.publicKey,
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
      .simulate();

    console.log("Simulation result:");
    console.dir(simulation, { depth: null });
  } catch (err: any) {
    console.error("Simulation failed");
    if (err.logs) {
      console.error("Logs:\n", err.logs.join("\n"));
    }
    console.error(err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
