// API Route: Store reveal results in database
// POST /api/polls/[id]/reveal

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface RevealRequestBody {
  winner: 'yes' | 'no';
  revealedBy: string;
  transactionSignature: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pollId = params.id;
    const body: RevealRequestBody = await request.json();
    const { winner, revealedBy, transactionSignature } = body;

    if (!pollId || !winner || !revealedBy) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Check if poll exists first
    const { data: existingPoll, error: fetchError } = await supabaseAdmin
      .from('polls')
      .select('poll_id')
      .eq('poll_id', pollId)
      .single();

    if (fetchError || !existingPoll) {
      console.error('Poll not found in database:', pollId);
      return NextResponse.json(
        { error: 'Poll not found. Make sure it was created via the frontend.' },
        { status: 404 }
      );
    }

    // Update poll with reveal results
    const { error: updateError } = await supabaseAdmin
      .from('polls')
      .update({
        status: 'revealed',
        revealed_at: new Date().toISOString(),
        winner: winner, // Store which side won
      })
      .eq('poll_id', pollId);

    if (updateError) {
      console.error('Error updating poll:', updateError);
      return NextResponse.json(
        { error: 'Failed to update poll', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Reveal result stored',
      winner,
    });
  } catch (error) {
    console.error('Error in reveal API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch reveal results
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pollId = params.id;

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('polls')
      .select('status, revealed_at, winner, total_participants')
      .eq('poll_id', pollId)
      .single();

    if (error) {
      // Poll doesn't exist in database (might be on-chain only)
      // Return default "not revealed" state instead of 404
      console.log(`Poll ${pollId} not found in database (on-chain only)`);
      return NextResponse.json({
        isRevealed: false,
        revealedAt: null,
        winner: null,
        totalVotes: 0,
      });
    }

    return NextResponse.json({
      isRevealed: data.status === 'revealed',
      revealedAt: data.revealed_at,
      winner: data.winner, // 'yes' or 'no'
      totalVotes: data.total_participants,
    });
  } catch (error) {
    console.error('Error in reveal GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
