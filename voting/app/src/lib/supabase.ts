// Supabase client configuration for VeiledCasts
// This file provides both client-side and server-side Supabase clients

import { createClient } from '@supabase/supabase-js';

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.');
}

/**
 * Client-side Supabase client (uses anon key)
 * Safe to use in browser/frontend code
 * Has limited permissions based on RLS policies
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Server-side Supabase client (uses service role key)
 * ONLY use in API routes or server components
 * Has full admin access - bypasses RLS policies
 */
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// Type definitions for database tables
export interface Member {
  id: string;
  wallet_address: string;
  username?: string;
  bio?: string;
  avatar_url?: string;
  points: number;
  member_since: string;
  last_active: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Poll {
  id: string;
  poll_id: string;
  chain_address: string;
  creator_wallet: string;
  question: string;
  description?: string;
  category: 'recognizer' | 'general' | 'nomination' | 'award';
  created_at: string;
  starts_at: string;
  ends_at?: string;
  revealed_at?: string;
  status: 'active' | 'closed' | 'revealed';
  is_featured: boolean;
  winner?: 'yes' | 'no'; // Only populated after reveal (MPC result)
  total_participants: number;
  tags?: string[];
  image_url?: string;
  external_url?: string;
  updated_at: string;
}

export interface VoteRecord {
  id: string;
  poll_id: string;
  voter_wallet: string;
  voted_at: string;
  transaction_signature?: string;
}

export interface PointTransaction {
  id: string;
  member_wallet: string;
  amount: number;
  reason: 'vote_cast' | 'poll_created' | 'recognition_won' | 'award_won';
  reference_id?: string;
  created_at: string;
}

export interface PollStats {
  id: string;
  poll_id: string;
  total_votes: number;
  unique_voters: number;
  views: number;
  shares: number;
  first_vote_at?: string;
  last_vote_at?: string;
  updated_at: string;
}
