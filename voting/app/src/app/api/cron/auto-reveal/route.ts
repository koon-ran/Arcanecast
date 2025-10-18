import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import idl from '@/types/voting.json';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Cron job to automatically reveal completed poll results
 * Runs every hour to check for polls past their deadline
 * Calls revealMultiOptionResult on-chain and updates database
 */
export async function GET(request: Request) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Starting auto-reveal job...');

    // Find polls that are past deadline but not yet revealed
    const now = new Date();
    const { data: completedPolls, error: fetchError } = await supabase
      .from('dao_polls')
      .select('id, question, onchain_id, deadline')
      .eq('status', 'voting')
      .lt('deadline', now.toISOString())
      .is('revealed_at', null);

    if (fetchError) {
      console.error('[CRON] Error fetching completed polls:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!completedPolls || completedPolls.length === 0) {
      console.log('[CRON] No polls to reveal');
      return NextResponse.json({ 
        message: 'No polls to reveal',
        revealed: 0 
      });
    }

    console.log(`[CRON] Found ${completedPolls.length} polls to reveal`);

    // Setup Solana connection and program
    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );

    // Load authority keypair from environment (base58 or array format)
    let authorityKeypair: Keypair;
    try {
      const secretKey = process.env.AUTHORITY_KEYPAIR;
      if (!secretKey) {
        throw new Error('AUTHORITY_KEYPAIR not set');
      }
      
      // Try parsing as JSON array first, then base58
      try {
        const secretArray = JSON.parse(secretKey);
        authorityKeypair = Keypair.fromSecretKey(new Uint8Array(secretArray));
      } catch {
        // Assume base58 format
        const bs58 = require('bs58');
        authorityKeypair = Keypair.fromSecretKey(bs58.decode(secretKey));
      }
    } catch (error) {
      console.error('[CRON] Error loading authority keypair:', error);
      return NextResponse.json({ 
        error: 'Server configuration error: invalid authority keypair' 
      }, { status: 500 });
    }

    const wallet = new Wallet(authorityKeypair);
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    const programId = new PublicKey(process.env.NEXT_PUBLIC_VOTING_PROGRAM_ID!);
    const program = new Program(idl as any, provider) as any;

    const revealedPolls: any[] = [];
    const errors: any[] = [];

    // Process each poll
    for (const poll of completedPolls) {
      try {
        if (!poll.onchain_id) {
          console.warn(`[CRON] Poll ${poll.id} has no onchain_id, skipping`);
          errors.push({ pollId: poll.id, error: 'No onchain_id' });
          continue;
        }

        console.log(`[CRON] Revealing poll ${poll.id} (onchain_id: ${poll.onchain_id})`);

        // Derive poll PDA
        const [pollPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('multi_option_poll'), Buffer.from([poll.onchain_id])],
          programId
        );

        // Call reveal instruction
        const tx = await program.methods
          .revealMultiOptionResult({ id: poll.onchain_id })
          .accounts({
            multiOptionPollAccount: pollPda,
            authority: wallet.publicKey,
          })
          .rpc();

        console.log(`[CRON] Reveal transaction: ${tx}`);

        // Wait for confirmation and parse event
        await connection.confirmTransaction(tx, 'confirmed');
        
        // Fetch transaction to get event data
        const txDetails = await connection.getTransaction(tx, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        });

        // Parse RevealMultiOptionResultEvent from logs
        let voteCounts = [0, 0, 0, 0];
        if (txDetails?.meta?.logMessages) {
          const eventLog = txDetails.meta.logMessages.find(log => 
            log.includes('RevealMultiOptionResultEvent')
          );
          
          if (eventLog) {
            // Parse event data (format depends on Anchor serialization)
            // For now, we'll fetch the account directly
            const pollAccount = await program.account.multiOptionPollAccount.fetch(pollPda);
            // TODO: Parse vote_state to extract counts
            // For now, use placeholder until we implement proper parsing
            console.log('[CRON] Poll account:', pollAccount);
          }
        }

        // Update database with results
        const { error: updateError } = await supabase
          .from('dao_polls')
          .update({
            status: 'completed',
            section: 'completed',
            vote_counts: voteCounts,
            revealed_at: now.toISOString(),
            reveal_tx_signature: tx,
          })
          .eq('id', poll.id);

        if (updateError) {
          console.error(`[CRON] Error updating poll ${poll.id}:`, updateError);
          errors.push({ pollId: poll.id, error: updateError.message });
        } else {
          revealedPolls.push({
            id: poll.id,
            question: poll.question,
            voteCounts,
            txSignature: tx,
          });
          console.log(`[CRON] Successfully revealed poll ${poll.id}`);
        }

      } catch (error: any) {
        console.error(`[CRON] Error revealing poll ${poll.id}:`, error);
        errors.push({ 
          pollId: poll.id, 
          error: error.message || 'Unknown error' 
        });
      }
    }

    console.log(`[CRON] Reveal complete: ${revealedPolls.length} succeeded, ${errors.length} failed`);

    return NextResponse.json({
      success: true,
      revealed: revealedPolls.length,
      polls: revealedPolls,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    console.error('[CRON] Auto-reveal error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
