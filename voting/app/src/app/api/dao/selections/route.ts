// API Route: DAO Selections Management
// POST /api/dao/selections - Select a poll in nomination
// DELETE /api/dao/selections/[id] - Deselect a poll
// GET /api/dao/selections/me - Get user's current selections

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Helper to get current week ID
async function getCurrentWeekId(): Promise<number> {
  const { data, error } = await supabaseAdmin!.rpc('get_current_week_id');
  if (error) throw new Error('Failed to get current week');
  return data as number;
}

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

// POST - Select a poll
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { poll_id, wallet } = body;

    if (!poll_id || !wallet) {
      return NextResponse.json(
        { error: 'Missing required fields: poll_id, wallet' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Get current week
    const weekId = await getCurrentWeekId();

    // Check if poll exists and is in nomination section
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

    if (poll.section !== 'nomination') {
      return NextResponse.json(
        { error: 'Can only select polls in nomination section' },
        { status: 400 }
      );
    }

    // Check if user already selected this poll
    const { data: existing } = await supabaseAdmin
      .from('selections')
      .select('*')
      .eq('poll_id', poll_id)
      .eq('wallet', wallet)
      .eq('week_id', weekId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'You have already selected this poll' },
        { status: 400 }
      );
    }

    // Check selection limit (should also be enforced by DB trigger)
    const { data: userSelections } = await supabaseAdmin
      .from('selections')
      .select('*')
      .eq('wallet', wallet)
      .eq('week_id', weekId);

    if (userSelections && userSelections.length >= 5) {
      return NextResponse.json(
        { error: 'Selection limit reached (5 per week). Deselect another poll first.' },
        { status: 400 }
      );
    }

    // Create selection
    const { data: selection, error: selectionError } = await supabaseAdmin
      .from('selections')
      .insert({
        poll_id,
        wallet,
        week_id: weekId,
      })
      .select()
      .single();

    if (selectionError) {
      console.error('Error creating selection:', selectionError);
      
      // Check if it's the trigger error (limit reached)
      if (selectionError.message.includes('Selection limit reached')) {
        return NextResponse.json(
          { error: 'Selection limit reached (5 per week)' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to create selection', details: selectionError.message },
        { status: 500 }
      );
    }

    // Award 1 point for selection
    try {
      await awardPoints(wallet, 1, 'selection_made', selection.id);
    } catch (error) {
      console.error('Failed to award points:', error);
    }

    // Get remaining selections
    const remainingSelections = 5 - ((userSelections?.length || 0) + 1);

    return NextResponse.json({
      success: true,
      selection,
      pointsAwarded: 1,
      remainingSelections,
      message: `Poll selected! ${remainingSelections} selections remaining this week.`,
    });
  } catch (error) {
    console.error('Error in POST /api/dao/selections:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Get user's current selections
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
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

    // Get current week
    const weekId = await getCurrentWeekId();

    // Get user's selections with poll details
    const { data: selections, error } = await supabaseAdmin
      .from('selections')
      .select(`
        *,
        dao_polls (*)
      `)
      .eq('wallet', wallet)
      .eq('week_id', weekId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching selections:', error);
      return NextResponse.json(
        { error: 'Failed to fetch selections', details: error.message },
        { status: 500 }
      );
    }

    const remainingSelections = 5 - (selections?.length || 0);

    return NextResponse.json({
      success: true,
      selections: selections || [],
      count: selections?.length || 0,
      remainingSelections,
      weekId,
    });
  } catch (error) {
    console.error('Error in GET /api/dao/selections:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
