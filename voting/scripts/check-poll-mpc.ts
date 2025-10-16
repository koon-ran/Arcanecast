// Diagnostic script to check poll account state
// Run with: npx ts-node scripts/check-poll-mpc.ts <POLL_ID>

import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import { Voting } from "../target/types/voting";

const VotingIDL = require("../target/idl/voting.json");

const PROGRAM_ID = new PublicKey("FHuabcvigE645KXLy4KCFCLkLx1jLxi1nwFYs8ajWyYd");
const RPC_URL = "https://devnet.helius-rpc.com/?api-key=98664a07-fdde-46f8-ac7d-7efd848339c4";

function derivePollPDA(pollId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("poll"),
      new BN(pollId).toArrayLike(Buffer, "le", 4),
    ],
    PROGRAM_ID
  );
}

async function checkPollMPC(pollId: number) {
  console.log("\n🔍 Checking MPC Status for Poll", pollId);
  console.log("=" .repeat(60));

  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new Wallet(Keypair.generate());
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const program = new Program<Voting>(VotingIDL as any, provider);

  const [pollPDA, bump] = derivePollPDA(pollId);
  console.log("\n📍 Poll PDA:", pollPDA.toString());
  console.log("📍 Bump:", bump);

  try {
    const pollAccount = await program.account.pollAccount.fetch(pollPDA);
    
    console.log("\n✅ Poll Account Found!");
    console.log("=" .repeat(60));
    console.log("📝 Question:", pollAccount.question);
    console.log("👤 Authority:", pollAccount.authority.toString());
    console.log("🔢 Poll ID:", pollAccount.id);
    console.log("🔐 Nonce:", pollAccount.nonce.toString());
    
    // Check if vote_state is initialized (non-zero)
    const voteState0HasData = pollAccount.voteState[0].some((b: number) => b !== 0);
    const voteState1HasData = pollAccount.voteState[1].some((b: number) => b !== 0);
    
    console.log("\n🗳️  Vote State Status:");
    console.log("=" .repeat(60));
    console.log("YES counter initialized:", voteState0HasData ? "✅ YES" : "❌ NO (all zeros)");
    console.log("NO counter initialized:", voteState1HasData ? "✅ YES" : "❌ NO (all zeros)");
    
    if (voteState0HasData || voteState1HasData) {
      console.log("\n✅ MPC COMPUTATION COMPLETED!");
      console.log("The encrypted vote counters have been initialized.");
      console.log("Poll is ready for voting.");
    } else {
      console.log("\n⏳ MPC COMPUTATION PENDING...");
      console.log("The encrypted vote counters are still all zeros.");
      console.log("Wait a bit and check again, or the MPC may have failed.");
    }
    
    // Show raw vote state (first 8 bytes of each)
    console.log("\n🔍 Vote State (first 8 bytes):");
    console.log("=" .repeat(60));
    console.log("YES counter:", pollAccount.voteState[0].slice(0, 8).join(", "));
    console.log("NO counter:", pollAccount.voteState[1].slice(0, 8).join(", "));
    
  } catch (error: any) {
    console.log("\n❌ Error fetching poll account:");
    console.log(error.message);
    
    // Check if account exists at all
    const accountInfo = await connection.getAccountInfo(pollPDA);
    if (!accountInfo) {
      console.log("\n❌ Poll account does not exist!");
      console.log("The poll may not have been created, or the PDA derivation is wrong.");
    } else {
      console.log("\n⚠️  Account exists but can't be deserialized.");
      console.log("This might be a program version mismatch.");
    }
  }
  
  console.log("\n" + "=".repeat(60));
}

// Get poll ID from command line
const pollId = parseInt(process.argv[2]);

if (isNaN(pollId)) {
  console.error("Usage: npx ts-node scripts/check-poll-mpc.ts <POLL_ID>");
  process.exit(1);
}

checkPollMPC(pollId).catch(console.error);
