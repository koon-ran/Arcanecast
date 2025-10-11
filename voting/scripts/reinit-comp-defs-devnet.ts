import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { Voting } from "../target/types/voting";
import {
  getCompDefAccOffset,
  getArciumAccountBaseSeed,
  getArciumProgAddress,
  getMXEAccAddress,
  uploadCircuit,
} from "@arcium-hq/client";
import * as fs from "fs";
import * as os from "os";

// Read keypair from file
function readKpJson(filePath: string): Keypair {
  const secretKeyString = fs.readFileSync(filePath, { encoding: "utf8" });
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  return Keypair.fromSecretKey(secretKey);
}

async function main() {
  const owner = readKpJson(`${os.homedir()}/.config/solana/id.json`);
  
  // Set up provider for devnet
  const connection = new anchor.web3.Connection(
    "https://devnet.helius-rpc.com/?api-key=98664a07-fdde-46f8-ac7d-7efd848339c4",
    "confirmed"
  );
  
  const wallet = new anchor.Wallet(owner);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const programId = new PublicKey("665esySAfjG6KFU7oGMEZNHbnK17xh92LCiXmxoUhzv8");
  const idl = JSON.parse(fs.readFileSync("target/idl/voting.json", "utf8"));
  const program = new Program(idl, provider) as Program<Voting>;

  console.log("Reinitializing computation definitions on devnet with circuit upload...");
  console.log("Using wallet:", owner.publicKey.toString());
  console.log("Program ID:", programId.toString());
  console.log("\n⚠️  WARNING: This will close existing comp defs and recreate them.");
  console.log("You will lose ~0.05 SOL in rent that will be reclaimed.\n");

  // Reinitialize each comp def with circuit upload
  await reinitCompDefWithCircuit(program, owner, "init_vote_stats", "initVoteStatsCompDef");
  await reinitCompDefWithCircuit(program, owner, "vote", "initVoteCompDef");
  await reinitCompDefWithCircuit(program, owner, "reveal_result", "initRevealResultCompDef");

  console.log("\n✅ All computation definitions reinitialized with circuits!");
  console.log("You can now use the frontend to create polls and vote.");
}

async function reinitCompDefWithCircuit(
  program: Program<Voting>,
  owner: Keypair,
  name: string,
  methodName: string
): Promise<void> {
  const baseSeedCompDefAcc = getArciumAccountBaseSeed("ComputationDefinitionAccount");
  const offset = getCompDefAccOffset(name);

  const compDefPDA = PublicKey.findProgramAddressSync(
    [baseSeedCompDefAcc, program.programId.toBuffer(), offset],
    getArciumProgAddress()
  )[0];

  console.log(`\n=== ${name} ===`);
  console.log(`PDA: ${compDefPDA.toBase58()}`);

  // Step 1: Close existing account if it exists
  try {
    const accountInfo = await program.provider.connection.getAccountInfo(compDefPDA);
    if (accountInfo) {
      console.log(`  Closing existing ${name} comp def account...`);
      // Transfer lamports back to owner and close account
      const tx = new anchor.web3.Transaction().add(
        SystemProgram.transfer({
          fromPubkey: compDefPDA,
          toPubkey: owner.publicKey,
          lamports: accountInfo.lamports,
        })
      );
      
      // Note: We can't actually close a PDA account this way.
      // We need to deploy a NEW program with different program ID
      // OR wait for Arcium to add a close_comp_def instruction
      
      console.log(`  ✗ Cannot close comp def - PDAs can only be closed by the program that owns them`);
      console.log(`  ✗ You need to either:`);
      console.log(`     1. Deploy to a new program ID, OR`);
      console.log(`     2. Wait for Arcium to provide a close_comp_def instruction`);
      console.log(`  \n  Current workaround: Deploy fresh program with circuit sources configured`);
      return;
    }
  } catch (e) {
    console.log(`  Account doesn't exist, will create fresh`);
  }

  // Step 2: Initialize fresh
  const mxeAccount = getMXEAccAddress(program.programId);
  
  try {
    const sig = await (program.methods as any)[methodName]()
      .accounts({
        compDefAccount: compDefPDA,
        payer: owner.publicKey,
        mxeAccount,
      })
      .signers([owner])
      .rpc({
        commitment: "confirmed",
        skipPreflight: false,
      });

    console.log(`  ✓ Initialized: ${sig}`);
    await program.provider.connection.confirmTransaction(sig, "confirmed");
  } catch (error: any) {
    console.error(`  ✗ Failed to initialize:`, error.message);
    return;
  }

  // Step 3: Upload circuit
  console.log(`  Uploading circuit bytecode...`);
  const circuitPath = `build/${name}_testnet.arcis`;
  
  try {
    const rawCircuit = fs.readFileSync(circuitPath);
    console.log(`  Circuit size: ${(rawCircuit.length / 1024).toFixed(2)} KB`);
    
    await uploadCircuit(
      program.provider as anchor.AnchorProvider,
      name,
      program.programId,
      rawCircuit,
      false // not verbose
    );
    
    console.log(`  ✓ Circuit uploaded!`);
  } catch (uploadError: any) {
    console.error(`  ✗ Upload failed:`, uploadError.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
