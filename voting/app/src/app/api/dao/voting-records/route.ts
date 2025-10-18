// API Route: DAO Voting Records
// POST /api/dao/voting-records - Record vote participation

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Helper to award points
async function awardPoints(
  wallet: string,
  amount: number,
  reason: string,
  referenceId?: string
): Promise<void> {
  await supabaseAdmin!.from('point_transactions').insert({
    member_wallet: wallet,
    amount,
    reason,
    reference_id: referenceId,
  });
}

// POST - Record vote participation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { poll_id, wallet, tx_signature } = body;

    if (!poll_id || !wallet || !tx_signature) {
      return NextResponse.json(
        { error: 'Missing required fields: poll_id, wallet, tx_signature' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Check if poll exists and is in voting section
    const { data: poll, error: pollError } = await supabaseAdmin
      .from('dao_polls')
      .select('*')
      .eq('id', poll_id)
      .single();

    if (pollError || !poll) {
      return NextResponse.json(
        { error: 'Poll not found' },
        { status: 404 }
      );
    }

    if (poll.section !== 'voting') {
      return NextResponse.json(
        { error: 'Can only vote on polls in voting section' },
        { status: 400 }
      );
    }

    // Check if voting period has ended
    if (poll.voting_ends_at && new Date(poll.voting_ends_at) < new Date()) {
      return NextResponse.json(
        { error: 'Voting period has ended for this poll' },
        { status: 400 }
      );
    }

    // Check if user already voted
    const { data: existing } = await supabaseAdmin
      .from('dao_voting_records')
      .select('*')
      .eq('poll_id', poll_id)
      .eq('wallet', wallet)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'You have already voted on this poll' },
        { status: 400 }
      );
    }

    // Record vote
    const { data: record, error: recordError } = await supabaseAdmin
      .from('dao_voting_records')
      .insert({
        poll_id,
        wallet,
        tx_signature,
      })
      .select()
      .single();

    if (recordError) {
      console.error('Error recording vote:', recordError);
      
      // Check if duplicate error
      if (recordError.message.includes('duplicate') || recordError.code === '23505') {
        return NextResponse.json(
          { error: 'You have already voted on this poll' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to record vote', details: recordError.message },
        { status: 500 }
      );
    }

    // Award 3 points for voting in DAO
    try {
      await awardPoints(wallet, 3, 'dao_vote_cast', record.id);
    } catch (error) {
      console.error('Failed to award points:', error);
      // Don't fail vote recording if points fail
    }

    return NextResponse.json({
      success: true,
      record,
      pointsAwarded: 3,
      message: 'Vote recorded successfully!',
    });
  } catch (error) {
    console.error('Error in POST /api/dao/voting-records:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Check if user has voted on a poll
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poll_id = searchParams.get('poll_id');
    const wallet = searchParams.get('wallet');

    if (!poll_id || !wallet) {
      return NextResponse.json(
        { error: 'Missing poll_id or wallet parameter' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const { data: record, error } = await supabaseAdmin
      .from('dao_voting_records')
      .select('*')
      .eq('poll_id', poll_id)
      .eq('wallet', wallet)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking vote status:', error);
      return NextResponse.json(
        { error: 'Failed to check vote status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      hasVoted: !!record,
      record: record || null,
    });
  } catch (error) {
    console.error('Error in GET /api/dao/voting-records:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
