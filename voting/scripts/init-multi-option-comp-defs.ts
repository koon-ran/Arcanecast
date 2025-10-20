import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
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

  const programId = new PublicKey("25aB1D3Q1rtrJDuhME83HpfLoWLvZMuFmtYnH7UvMDLb");
  const idl = JSON.parse(fs.readFileSync("target/idl/voting.json", "utf8"));
  const program = new Program(idl, provider) as Program<Voting>;

  console.log("🎯 Initializing MULTI-OPTION poll computation definitions on devnet...");
  console.log("Using wallet:", owner.publicKey.toString());
  console.log("Program ID:", programId.toString());

  // Initialize multi-option poll comp defs
  console.log("\n=== Multi-Option Poll Computation Definitions ===");
  await initCompDef(program, owner, "init_multi_option_vote_stats", "initMultiOptionVoteStatsCompDef");
  await initCompDef(program, owner, "vote_multi_option", "initVoteMultiOptionCompDef");
  await initCompDef(program, owner, "reveal_multi_option_result", "initRevealMultiOptionResultCompDef");

  console.log("\n✅ All multi-option computation definitions initialized successfully!");
  console.log("You can now create multi-option DAO polls on-chain.");
}

async function initCompDef(
  program: Program<Voting>,
  owner: Keypair,
  name: string,
  methodName: string
): Promise<void> {
  const baseSeedCompDefAcc = getArciumAccountBaseSeed(
    "ComputationDefinitionAccount"
  );
  const offset = getCompDefAccOffset(name);

  const compDefPDA = PublicKey.findProgramAddressSync(
    [baseSeedCompDefAcc, program.programId.toBuffer(), offset],
    getArciumProgAddress()
  )[0];

  console.log(`\n${name} computation definition PDA:`, compDefPDA.toBase58());

  const mxeAccount = getMXEAccAddress(program.programId);
  
  // Check if already exists
  let alreadyInitialized = false;
  try {
    const accountInfo = await program.provider.connection.getAccountInfo(compDefPDA);
    if (accountInfo) {
      console.log(`✓ ${name} already initialized`);
      alreadyInitialized = true;
    }
  } catch (e) {
    // Account doesn't exist, continue with initialization
  }

  if (!alreadyInitialized) {
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

      console.log(`✓ ${name} initialized with signature:`, sig);
      
      // Wait for confirmation
      await program.provider.connection.confirmTransaction(sig, "confirmed");
    } catch (error: any) {
      if (error.message?.includes("already in use")) {
        console.log(`✓ ${name} already initialized (account exists)`);
      } else {
        console.error(`✗ Failed to initialize ${name}:`, error.message);
        throw error;
      }
    }
  }
  
  // Upload circuit bytecode
  console.log(`  Uploading ${name} circuit bytecode...`);
  
  // Try testnet circuit first, fall back to regular
  let circuitPath = `build/${name}_testnet.arcis`;
  if (!fs.existsSync(circuitPath)) {
    circuitPath = `build/${name}.arcis`;
  }
  
  if (!fs.existsSync(circuitPath)) {
    console.log(`  ⚠️  Circuit file not found: ${circuitPath}`);
    console.log(`  Note: You may need to build circuits first with 'npm run build:circuits'`);
    return;
  }
  
  try {
    const rawCircuit = fs.readFileSync(circuitPath);
    console.log(`  Circuit file size: ${(rawCircuit.length / 1024).toFixed(2)} KB`);
    
    await uploadCircuit(
      program.provider as anchor.AnchorProvider,
      name,
      program.programId,
      rawCircuit,
      true // verbose
    );
    
    console.log(`  ✓ ${name} circuit uploaded successfully!`);
  } catch (uploadError: any) {
    console.error(`  ✗ Failed to upload ${name} circuit:`, uploadError.message);
    console.log(`  Note: Circuit initialization succeeded, but upload failed.`);
    console.log(`  You may need to configure offchain storage or upload manually.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
