// API Route: DAO Polls Management
// POST /api/dao/polls - Create poll proposal
// GET /api/dao/polls - List polls by section with sorting

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

// POST - Create poll proposal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, options, creator_wallet } = body;

    // Validation
    if (!question || !options || !creator_wallet) {
      return NextResponse.json(
        { error: 'Missing required fields: question, options, creator_wallet' },
        { status: 400 }
      );
    }

    if (!Array.isArray(options) || options.length < 2 || options.length > 4) {
      return NextResponse.json(
        { error: 'Options must be an array with 2-4 items' },
        { status: 400 }
      );
    }

    if (question.trim().length < 10) {
      return NextResponse.json(
        { error: 'Question must be at least 10 characters' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Create poll in nomination section
    // Calculate current ISO week number
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekId = Math.ceil((days + startOfYear.getDay() + 1) / 7);

    const { data: poll, error: pollError } = await supabaseAdmin
      .from('dao_polls')
      .insert({
        question: question.trim(),
        options: options.map((opt: string) => opt.trim()),
        creator_wallet,
        section: 'nomination',
        status: 'nomination',
        week_id: weekId,
      })
      .select()
      .single();

    if (pollError) {
      console.error('Error creating poll:', pollError);
      return NextResponse.json(
        { error: 'Failed to create poll', details: pollError.message },
        { status: 500 }
      );
    }

    // Award creator 5 points
    try {
      await awardPoints(creator_wallet, 5, 'poll_created', poll.id);
    } catch (error) {
      console.error('Failed to award points:', error);
      // Don't fail poll creation if points fail
    }

    return NextResponse.json({
      success: true,
      poll,
      pointsAwarded: 5,
      message: 'Poll created successfully in nomination section',
    });
  } catch (error) {
    console.error('Error in POST /api/dao/polls:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - List polls by section with sorting
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section') || 'nomination';
    const sort = searchParams.get('sort') || 'newest'; // newest|popular|oldest
    const wallet = searchParams.get('wallet'); // Optional: filter by creator

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Build query
    let query = supabaseAdmin
      .from('dao_polls')
      .select('*')
      .eq('section', section);

    // Filter out archived polls from nomination section
    if (section === 'nomination') {
      query = query.neq('status', 'archived');
    }

    // Filter by creator if provided
    if (wallet) {
      query = query.eq('creator_wallet', wallet);
    }

    // Apply sorting
    switch (sort) {
      case 'popular':
        query = query.order('selection_count', { ascending: false });
        query = query.order('created_at', { ascending: false });
        break;
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    const { data: polls, error } = await query;

    if (error) {
      console.error('Error fetching polls:', error);
      return NextResponse.json(
        { error: 'Failed to fetch polls', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      polls,
      count: polls?.length || 0,
      section,
      sort,
    });
  } catch (error) {
    console.error('Error in GET /api/dao/polls:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
