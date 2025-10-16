// API Route: Record a vote in the database
// POST /api/polls/[id]/vote

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface VoteRequestBody {
  voterWallet: string;
  transactionSignature: string;
}

interface RecordVoteResult {
  success: boolean;
  points_awarded: number;
  total_points: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pollId = params.id;
    const body: VoteRequestBody = await request.json();
    const { voterWallet, transactionSignature } = body;

    // Validate inputs
    if (!pollId || !voterWallet || !transactionSignature) {
      return NextResponse.json(
        { error: 'Missing required fields: pollId, voterWallet, transactionSignature' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Check if user has already voted (for better error message)
    const { data: existingVote } = await supabaseAdmin
      .from('vote_records')
      .select('id')
      .eq('poll_id', pollId)
      .eq('voter_wallet', voterWallet)
      .single();

    if (existingVote) {
      return NextResponse.json(
        { error: 'You have already voted on this poll' },
        { status: 409 } // Conflict
      );
    }

    // Call the database function to record vote and award points
    const { data, error } = await supabaseAdmin.rpc('record_vote', {
      p_poll_id: pollId,
      p_voter_wallet: voterWallet,
      p_transaction_signature: transactionSignature,
    });

    if (error) {
      console.error('Error recording vote:', error);
      
      // Check if it's a duplicate vote error
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { error: 'You have already voted on this poll' },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to record vote', details: error.message },
        { status: 500 }
      );
    }

    const result = data as RecordVoteResult;

    return NextResponse.json({
      success: true,
      message: 'Vote recorded successfully',
      pointsAwarded: result.points_awarded,
      totalPoints: result.total_points,
      transactionSignature,
    });
  } catch (error) {
    console.error('Error in vote API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check if a user has voted
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pollId = params.id;
    const searchParams = request.nextUrl.searchParams;
    const voterWallet = searchParams.get('wallet');

    if (!voterWallet) {
      return NextResponse.json(
        { error: 'Missing wallet parameter' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Call has_voted function
    const { data, error } = await supabaseAdmin.rpc('has_voted', {
      p_poll_id: pollId,
      p_voter_wallet: voterWallet,
    });

    if (error) {
      console.error('Error checking vote status:', error);
      return NextResponse.json(
        { error: 'Failed to check vote status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      hasVoted: data === true,
      pollId,
      wallet: voterWallet,
    });
  } catch (error) {
    console.error('Error in vote check API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
