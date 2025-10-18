import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import anchorPkg from '@coral-xyz/anchor';
const { AnchorProvider, Program, Wallet } = anchorPkg;
import { readFileSync } from 'fs';

const idl = JSON.parse(readFileSync('./src/idl/voting.json', 'utf-8'));
const connection = new Connection('https://api.devnet.solana.com');
const PROGRAM_ID = new PublicKey('DZDFeQuWe8ULjVUjhY7qvPMHo4D2h8YCetv4VwwwE96X');

const keypairPath = '/home/codespace/.config/solana/id.json';
const secretKey = JSON.parse(readFileSync(keypairPath, 'utf-8'));
const authorityKeypair = Keypair.fromSecretKey(new Uint8Array(secretKey));

const wallet = new Wallet(authorityKeypair);
const provider = new AnchorProvider(connection, wallet, {});
const program = new Program(idl, provider);

console.log('Program methods:', Object.keys(program.methods));
console.log('Has createMultiOptionPoll:', 'createMultiOptionPoll' in program.methods);
