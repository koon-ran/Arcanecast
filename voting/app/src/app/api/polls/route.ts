// API Route: Create a new poll in the database
// POST /api/polls

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface CreatePollRequestBody {
  pollId: string;
  chainAddress: string;
  creatorWallet: string;
  question: string;
  description?: string;
  category?: 'recognizer' | 'general' | 'nomination' | 'award';
  endsAt?: string; // ISO timestamp
}

export async function POST(request: NextRequest) {
  try {
    const body: CreatePollRequestBody = await request.json();
    const {
      pollId,
      chainAddress,
      creatorWallet,
      question,
      description,
      category = 'general',
      endsAt,
    } = body;

    // Validate required fields
    if (!pollId || !chainAddress || !creatorWallet || !question) {
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

    // Call database function to create poll and award points
    const { data, error } = await supabaseAdmin.rpc('create_poll', {
      p_poll_id: pollId,
      p_chain_address: chainAddress,
      p_creator_wallet: creatorWallet,
      p_question: question,
      p_description: description || null,
      p_category: category,
      p_ends_at: endsAt || null,
    });

    if (error) {
      console.error('Error creating poll:', error);
      
      // Check for duplicate poll
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Poll with this ID already exists' },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to create poll', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Poll created successfully',
      pollDbId: data, // UUID from database
      pollId,
      chainAddress,
      pointsAwarded: 5,
    });
  } catch (error) {
    console.error('Error in create poll API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch polls
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const status = searchParams.get('status') || 'active';
    const creator = searchParams.get('creator');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    let query = supabaseAdmin
      .from('polls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (creator) {
      query = query.eq('creator_wallet', creator);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching polls:', error);
      return NextResponse.json(
        { error: 'Failed to fetch polls' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      polls: data,
      count: data?.length || 0,
    });
  } catch (error) {
    console.error('Error in polls GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
