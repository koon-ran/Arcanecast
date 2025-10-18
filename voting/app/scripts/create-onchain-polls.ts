/**
 * Utility script to create DAO polls on-chain
 * Run with: npx ts-node scripts/create-onchain-polls.ts
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import VotingIDL from "../target/types/voting.json";

// Load environment variables
const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const VOTING_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_VOTING_PROGRAM_ID!);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Load authority keypair
const AUTHORITY_KEYPAIR_PATH = process.env.AUTHORITY_KEYPAIR_PATH || "/home/codespace/.config/solana/id.json";
const keypairData = JSON.parse(fs.readFileSync(AUTHORITY_KEYPAIR_PATH, 'utf-8'));
const authorityKeypair = Keypair.fromSecretKey(new Uint8Array(keypairData));

// Initialize connection and program
const connection = new Connection(SOLANA_RPC_URL, "confirmed");
const wallet = new Wallet(authorityKeypair);
const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
const program = new Program(VotingIDL as any, provider);

function deriveMultiOptionPollPDA(pollId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("multi_option_poll"), Buffer.from([pollId])],
    VOTING_PROGRAM_ID
  );
}

async function createPollOnChain(
  onchainId: number,
  question: string,
  options: string[]
): Promise<string> {
  console.log(`\n📝 Creating poll ${onchainId} on-chain...`);
  console.log(`Question: ${question}`);
  console.log(`Options: ${options.join(', ')}`);

  const [pollPDA] = deriveMultiOptionPollPDA(onchainId);
  
  try {
    // Check if poll already exists
    const accountInfo = await connection.getAccountInfo(pollPDA);
    if (accountInfo) {
      console.log(`✅ Poll ${onchainId} already exists on-chain at ${pollPDA.toBase58()}`);
      return pollPDA.toBase58();
    }

    // Create poll on-chain
    const tx = await program.methods
      .createMultiOptionPoll(onchainId, question, options)
      .accounts({
        multiOptionPollAccount: pollPDA,
        authority: wallet.publicKey,
        systemProgram: PublicKey.default,
      })
      .rpc({ skipPreflight: false });

    console.log(`✅ Poll created on-chain!`);
    console.log(`   Transaction: ${tx}`);
    console.log(`   PDA: ${pollPDA.toBase58()}`);
    
    return tx;
  } catch (error: any) {
    console.error(`❌ Error creating poll ${onchainId}:`, error.message);
    throw error;
  }
}

async function syncPollsToChain() {
  console.log("🔄 Syncing voting polls to blockchain...\n");

  // Fetch all voting polls without onchain_id
  const { data: polls, error } = await supabase
    .from('dao_polls')
    .select('id, question, options, onchain_id')
    .eq('section', 'voting')
    .is('onchain_id', null);

  if (error) {
    console.error("❌ Error fetching polls:", error);
    return;
  }

  if (!polls || polls.length === 0) {
    console.log("ℹ️  No voting polls need to be created on-chain");
    return;
  }

  console.log(`Found ${polls.length} polls to create on-chain\n`);

  let nextOnchainId = 1;
  
  // Check what on-chain IDs are already used
  const { data: existingPolls } = await supabase
    .from('dao_polls')
    .select('onchain_id')
    .not('onchain_id', 'is', null)
    .order('onchain_id', { ascending: false })
    .limit(1);

  if (existingPolls && existingPolls.length > 0) {
    nextOnchainId = existingPolls[0].onchain_id + 1;
  }

  console.log(`Starting from onchain_id: ${nextOnchainId}\n`);

  for (const poll of polls) {
    try {
      // Create on-chain
      await createPollOnChain(nextOnchainId, poll.question, poll.options);

      // Update database with onchain_id
      const { error: updateError } = await supabase
        .from('dao_polls')
        .update({ onchain_id: nextOnchainId })
        .eq('id', poll.id);

      if (updateError) {
        console.error(`❌ Error updating database for poll ${poll.id}:`, updateError);
      } else {
        console.log(`✅ Database updated with onchain_id ${nextOnchainId}\n`);
      }

      nextOnchainId++;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to process poll ${poll.id}, skipping...`);
      continue;
    }
  }

  console.log("\n✨ All voting polls synced to blockchain!");
}

// Run the script
syncPollsToChain()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
