import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { Voting } from "../target/types/voting";
import {
  uploadCircuit,
} from "@arcium-hq/client";
import * as fs from "fs";
import * as os from "os";

function readKpJson(filePath: string): Keypair {
  const secretKeyString = fs.readFileSync(filePath, { encoding: "utf8" });
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  return Keypair.fromSecretKey(secretKey);
}

async function main() {
  const owner = readKpJson(`${os.homedir()}/.config/solana/id.json`);
  
  const connection = new anchor.web3.Connection(
    "https://devnet.helius-rpc.com/?api-key=98664a07-fdde-46f8-ac7d-7efd848339c4",
    "confirmed"
  );
  
  const wallet = new anchor.Wallet(owner);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const programId = new PublicKey("D2FnRkvsmn7sS74ZLrXT4ioS5auJw6sFdmXwb5tqFcr3");

  console.log("Uploading circuits to devnet...");
  console.log("Using wallet:", owner.publicKey.toString());
  console.log("Program ID:", programId.toString());

  // Upload init_vote_stats circuit - use testnet version
  console.log("\n📤 Uploading init_vote_stats circuit...");
  const initVoteStatsCircuit = fs.readFileSync("build/init_vote_stats_testnet.arcis");
  await uploadCircuit(
    provider,
    "init_vote_stats",
    programId,
    initVoteStatsCircuit,
    true
  );
  console.log("✅ init_vote_stats circuit uploaded");

  // Upload vote circuit
  console.log("\n📤 Uploading vote circuit...");
  const voteCircuit = fs.readFileSync("build/vote_testnet.arcis");
  await uploadCircuit(
    provider,
    "vote",
    programId,
    voteCircuit,
    true
  );
  console.log("✅ vote circuit uploaded");

  // Upload reveal_result circuit
  console.log("\n📤 Uploading reveal_result circuit...");
  const revealResultCircuit = fs.readFileSync("build/reveal_result_testnet.arcis");
  await uploadCircuit(
    provider,
    "reveal_result",
    programId,
    revealResultCircuit,
    true
  );
  console.log("✅ reveal_result circuit uploaded");

  console.log("\n🎉 All circuits uploaded successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
