import { createClient } from '@supabase/supabase-js';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import anchorPkg from '@coral-xyz/anchor';
const { AnchorProvider, Program, Wallet, BN } = anchorPkg;
import { readFileSync } from 'fs';
import {
  getMXEAccAddress,
  getCompDefAccOffset,
  getCompDefAccAddress,
  getMempoolAccAddress,
  getExecutingPoolAccAddress,
  getComputationAccAddress,
  getClusterAccAddress,
} from '@arcium-hq/client';

// Load IDL
const idl = JSON.parse(readFileSync('./src/idl/voting.json', 'utf-8'));

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const connection = new Connection('https://api.devnet.solana.com');
const PROGRAM_ID = new PublicKey('DZDFeQuWe8ULjVUjhY7qvPMHo4D2h8YCetv4VwwwE96X');
const ARCIUM_PROGRAM_ID = new PublicKey('BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6');
const ARCIUM_FEE_POOL_ACCOUNT = new PublicKey('7MGSS4iKNM4sVib7bDZDJhVqB6EcchPwVnTKenCY1jt3');
const ARCIUM_CLOCK_ACCOUNT = new PublicKey('FHriyvoZotYiFnbUzKFjzRSb2NiaC8RPWY7jtKuKhg65');
const CLUSTER_OFFSET = 1078779259; // Official Arcium devnet cluster

const keypairPath = '/home/codespace/.config/solana/id.json';
const secretKey = JSON.parse(readFileSync(keypairPath, 'utf-8'));
const authorityKeypair = Keypair.fromSecretKey(new Uint8Array(secretKey));

const wallet = new Wallet(authorityKeypair);
const provider = new AnchorProvider(connection, wallet, {});
const program = new Program(idl, provider);

// Helper to generate computation offset
function generateComputationOffset() {
  const buffer = new Uint8Array(8);
  crypto.getRandomValues(buffer);
  const view = new DataView(buffer.buffer);
  return new BN(view.getBigUint64(0, true).toString());
}

// Helper to generate nonce
function generateNonce() {
  const buffer = new Uint8Array(16);
  crypto.getRandomValues(buffer);
  return buffer;
}

// Helper to deserialize little-endian bytes to BigInt
function deserializeLE(bytes) {
  let result = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(bytes[i]);
  }
  return result;
}

// Derive Arcium accounts (matching helpers.ts logic)
function deriveArciumAccounts(computationOffset, compDefName) {
  const [signPdaAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('SignerAccount')],
    PROGRAM_ID
  );
  
  const compDefOffset = Buffer.from(getCompDefAccOffset(compDefName)).readUInt32LE();

  return {
    signPdaAccount,
    mxeAccount: getMXEAccAddress(PROGRAM_ID),
    mempoolAccount: getMempoolAccAddress(PROGRAM_ID),
    executingPool: getExecutingPoolAccAddress(PROGRAM_ID),
    computationAccount: getComputationAccAddress(PROGRAM_ID, computationOffset),
    compDefAccount: getCompDefAccAddress(PROGRAM_ID, compDefOffset),
    clusterAccount: getClusterAccAddress(CLUSTER_OFFSET),
    poolAccount: ARCIUM_FEE_POOL_ACCOUNT,
    clockAccount: ARCIUM_CLOCK_ACCOUNT,
    systemProgram: SystemProgram.programId,
    arciumProgram: ARCIUM_PROGRAM_ID,
  };
}

async function run() {
  console.log('🔍 Checking for polls needing on-chain creation...\n');
  
  // Get polls needing onchain_id
  const { data: polls, error } = await supabase
    .from('dao_polls')
    .select('*')
    .eq('section', 'voting')
    .is('onchain_id', null);

  if (error) {
    console.error('❌ Error fetching polls:', error);
    return;
  }

  if (!polls || polls.length === 0) {
    console.log('✅ No polls need fixing!');
    return;
  }

  console.log(`Found ${polls.length} polls to create on-chain:\n`);
  polls.forEach(p => console.log(`  - ${p.question}`));
  console.log('');

  // Get next available ID
  const { data: maxData } = await supabase
    .from('dao_polls')
    .select('onchain_id')
    .not('onchain_id', 'is', null)
    .order('onchain_id', { ascending: false })
    .limit(1);

  let nextId = maxData && maxData.length > 0 ? maxData[0].onchain_id + 1 : 0;
  console.log(`Starting from onchain_id: ${nextId}\n`);

  for (const poll of polls) {
    console.log(`📝 Creating poll ${nextId}: ${poll.question.substring(0, 50)}...`);
    
    // Correct PDA derivation: multi_poll + u32 little-endian bytes
    const idBuffer = Buffer.alloc(4);
    idBuffer.writeUInt32LE(nextId);
    const [pollPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('multi_poll'), idBuffer],
      PROGRAM_ID
    );

    // Generate computation offset and nonce
    const computationOffset = generateComputationOffset();
    const nonce = generateNonce();

    // Derive all Arcium accounts (use multi-option comp def)
    const arciumAccounts = deriveArciumAccounts(computationOffset, 'init_multi_option_vote_stats');

    try {
      const tx = await program.methods
        .createMultiOptionPoll(
          computationOffset,
          nextId,
          poll.question,
          poll.options,
          new BN(deserializeLE(nonce).toString())
        )
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
        .rpc({ skipPreflight: false, commitment: 'confirmed' });

      await supabase
        .from('dao_polls')
        .update({ onchain_id: nextId })
        .eq('id', poll.id);

      console.log(`   ✅ Created on-chain (ID: ${nextId}, TX: ${tx.substring(0, 8)}...)\n`);
      nextId++;
    } catch (e) {
      console.error(`   ❌ Failed: ${e.message}`);
      console.error(`   Full error:`, e);
      console.log('');
    }
  }

  console.log('🎉 Done!');
}

run().catch(console.error);
