import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
import idl from '@/idl/voting.json';
import fs from 'fs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Solana connection setup for on-chain poll creation
const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com');
const PROGRAM_ID = new PublicKey('DZDFeQuWe8ULjVUjhY7qvPMHo4D2h8YCetv4VwwwE96X');

// Helper to derive multi-option poll PDA
function deriveMultiOptionPollPDA(onchainId: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("multi_option_poll"), Buffer.from([onchainId])],
    PROGRAM_ID
  );
  return pda;
}

// Helper to get next available onchain_id
async function getNextOnchainId(): Promise<number> {
  const { data } = await supabase
    .from('dao_polls')
    .select('onchain_id')
    .not('onchain_id', 'is', null)
    .order('onchain_id', { ascending: false })
    .limit(1);
  
  return data && data.length > 0 ? data[0].onchain_id + 1 : 0;
}

// Create poll on-chain
async function createPollOnChain(
  onchainId: number,
  question: string,
  options: string[]
): Promise<boolean> {
  try {
    // Load authority keypair
    const keypairPath = process.env.AUTHORITY_KEYPAIR_PATH || '/home/codespace/.config/solana/id.json';
    const secretKey = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    const authorityKeypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
    
    const wallet = new Wallet(authorityKeypair);
    const provider = new AnchorProvider(connection, wallet, {});
    const program = new Program(idl as any, provider);

    const pollPDA = deriveMultiOptionPollPDA(onchainId);

    // Check if poll already exists
    const accountInfo = await connection.getAccountInfo(pollPDA);
    if (accountInfo) {
      console.log(`[CRON] Poll ${onchainId} already exists on-chain`);
      return true;
    }

    // Create the poll on-chain
    await program.methods
      .createMultiOptionPoll(onchainId, question, options)
      .accounts({
        multiOptionPollAccount: pollPDA,
        authority: wallet.publicKey,
        systemProgram: PublicKey.default,
      })
      .rpc();

    console.log(`[CRON] Created poll ${onchainId} on-chain at ${pollPDA.toBase58()}`);
    return true;
  } catch (error) {
    console.error(`[CRON] Error creating poll ${onchainId} on-chain:`, error);
    return false;
  }
}

/**
 * Cron job to promote top 5 nominated polls to voting section
 * Runs every Monday at 00:00 UTC
 * Awards 10 bonus points to creators of promoted polls
 */
export async function GET(request: Request) {
  try {
    // Verify this is a legitimate cron request (Vercel cron secret)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Starting promote-polls job...');

    // Get current week_id (ISO week number)
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekId = Math.ceil((days + startOfYear.getDay() + 1) / 7);

    console.log(`[CRON] Current week: ${weekId}`);

    // Find top 5 nominated polls by selection_count for current week
    const { data: topPolls, error: fetchError } = await supabase
      .from('dao_polls')
      .select('id, question, creator_wallet, selection_count')
      .eq('status', 'nomination')
      .eq('section', 'nomination')
      .eq('week_id', weekId)
      .order('selection_count', { ascending: false })
      .limit(5);

    if (fetchError) {
      console.error('[CRON] Error fetching top polls:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!topPolls || topPolls.length === 0) {
      console.log('[CRON] No polls to promote this week');
      return NextResponse.json({ 
        message: 'No polls to promote',
        promoted: 0,
        weekId 
      });
    }

    console.log(`[CRON] Found ${topPolls.length} polls to promote`);

    // Get full poll data including options
    const { data: fullPolls, error: fullPollsError } = await supabase
      .from('dao_polls')
      .select('*')
      .in('id', topPolls.map(p => p.id));

    if (fullPollsError || !fullPolls) {
      console.error('[CRON] Error fetching full poll data:', fullPollsError);
      return NextResponse.json({ error: fullPollsError?.message }, { status: 500 });
    }

    // Create on-chain polls and track onchain_ids
    const onchainCreationResults: Record<string, number | null> = {};
    let nextOnchainId = await getNextOnchainId();

    for (const poll of fullPolls) {
      const created = await createPollOnChain(nextOnchainId, poll.question, poll.options);
      if (created) {
        onchainCreationResults[poll.id] = nextOnchainId;
        
        // Update poll with onchain_id
        await supabase
          .from('dao_polls')
          .update({ onchain_id: nextOnchainId })
          .eq('id', poll.id);
        
        nextOnchainId++;
      } else {
        onchainCreationResults[poll.id] = null;
        console.error(`[CRON] Failed to create poll ${poll.id} on-chain`);
      }
    }

    console.log('[CRON] On-chain creation results:', onchainCreationResults);

    // Calculate deadline: 7 days from now
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);

    // Promote polls to voting section
    const pollIds = topPolls.map(p => p.id);
    const { error: updateError } = await supabase
      .from('dao_polls')
      .update({
        status: 'voting',
        section: 'voting',
        deadline: deadline.toISOString(),
        promoted_at: now.toISOString(),
      })
      .in('id', pollIds);

    if (updateError) {
      console.error('[CRON] Error updating polls:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log(`[CRON] Promoted ${pollIds.length} polls to voting`);

    // Award 10 bonus points to creators of promoted polls
    const creatorWallets = Array.from(new Set(topPolls.map(p => p.creator_wallet)));
    const pointsAwarded: Record<string, number> = {};

    for (const wallet of creatorWallets) {
      const pollsForCreator = topPolls.filter(p => p.creator_wallet === wallet);
      const bonusPoints = pollsForCreator.length * 10;

      const { error: pointsError } = await supabase.rpc('add_points', {
        p_wallet: wallet,
        p_points: bonusPoints,
      });

      if (pointsError) {
        console.error(`[CRON] Error awarding points to ${wallet}:`, pointsError);
      } else {
        pointsAwarded[wallet] = bonusPoints;
        console.log(`[CRON] Awarded ${bonusPoints} bonus points to ${wallet}`);
      }
    }

    // Log promotion event
    const promotionSummary = topPolls.map(p => ({
      id: p.id,
      question: p.question,
      selections: p.selection_count,
      creator: p.creator_wallet,
    }));

    console.log('[CRON] Promotion complete:', promotionSummary);

    return NextResponse.json({
      success: true,
      weekId,
      promoted: pollIds.length,
      polls: promotionSummary,
      pointsAwarded,
      deadline: deadline.toISOString(),
    });

  } catch (error: any) {
    console.error('[CRON] Promote polls error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
