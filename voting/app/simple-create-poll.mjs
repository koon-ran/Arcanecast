import { createClient } from '@supabase/supabase-js';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import anchorPkg from '@coral-xyz/anchor';
const { AnchorProvider, Program, Wallet, BN } = anchorPkg;
import { readFileSync } from 'fs';

const idl = JSON.parse(readFileSync('./src/idl/voting.json', 'utf-8'));

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const connection = new Connection('https://api.devnet.solana.com');
const PROGRAM_ID = new PublicKey('DZDFeQuWe8ULjVUjhY7qvPMHo4D2h8YCetv4VwwwE96X');

const keypairPath = '/home/codespace/.config/solana/id.json';
const secretKey = JSON.parse(readFileSync(keypairPath, 'utf-8'));
const authorityKeypair = Keypair.fromSecretKey(new Uint8Array(secretKey));

const wallet = new Wallet(authorityKeypair);
const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
const program = new Program(idl, provider);

console.log('Wallet public key:', wallet.publicKey.toString());
console.log('Trying to build instruction...');

const [pollPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('multi_poll'), Buffer.from([0])],
  PROGRAM_ID
);

console.log('Poll PDA:', pollPDA.toString());

try {
  const builder = program.methods
    .createMultiOptionPoll(new BN(12345), 0, 'Test poll', ['Option A', 'Option B']);
  
  console.log('Method builder created successfully');
  console.log('Builder keys:', Object.keys(builder));
} catch (e) {
  console.error('Failed:', e.message);
}
