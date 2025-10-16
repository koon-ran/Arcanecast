-- ============================================
-- VeiledCasts Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. MEMBERS TABLE
-- ============================================
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  bio TEXT,
  avatar_url TEXT,
  points INTEGER DEFAULT 0,
  member_since TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW(),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_members_wallet ON members(wallet_address);
CREATE INDEX idx_members_points ON members(points DESC);
CREATE INDEX idx_members_username ON members(username);

-- ============================================
-- 2. POLLS TABLE
-- ============================================
CREATE TABLE polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id TEXT UNIQUE NOT NULL,
  chain_address TEXT UNIQUE NOT NULL,
  creator_wallet TEXT NOT NULL,
  
  question TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  
  created_at TIMESTAMP DEFAULT NOW(),
  starts_at TIMESTAMP DEFAULT NOW(),
  ends_at TIMESTAMP,
  revealed_at TIMESTAMP,
  
  status TEXT DEFAULT 'active',
  is_featured BOOLEAN DEFAULT FALSE,
  
  yes_votes INTEGER,
  no_votes INTEGER,
  total_participants INTEGER DEFAULT 0,
  
  tags TEXT[],
  image_url TEXT,
  external_url TEXT,
  
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (creator_wallet) REFERENCES members(wallet_address)
);

CREATE INDEX idx_polls_poll_id ON polls(poll_id);
CREATE INDEX idx_polls_creator ON polls(creator_wallet);
CREATE INDEX idx_polls_category ON polls(category);
CREATE INDEX idx_polls_status ON polls(status);
CREATE INDEX idx_polls_created_at ON polls(created_at DESC);
CREATE INDEX idx_polls_ends_at ON polls(ends_at);

-- ============================================
-- 3. VOTE RECORDS TABLE
-- ============================================
CREATE TABLE vote_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id TEXT NOT NULL,
  voter_wallet TEXT NOT NULL,
  voted_at TIMESTAMP DEFAULT NOW(),
  transaction_signature TEXT,
  
  UNIQUE(poll_id, voter_wallet),
  
  FOREIGN KEY (poll_id) REFERENCES polls(poll_id),
  FOREIGN KEY (voter_wallet) REFERENCES members(wallet_address)
);

CREATE INDEX idx_vote_records_poll ON vote_records(poll_id);
CREATE INDEX idx_vote_records_voter ON vote_records(voter_wallet);
CREATE INDEX idx_vote_records_voted_at ON vote_records(voted_at DESC);

-- ============================================
-- 4. POINT TRANSACTIONS TABLE
-- ============================================
CREATE TABLE point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_wallet TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (member_wallet) REFERENCES members(wallet_address)
);

CREATE INDEX idx_point_txns_member ON point_transactions(member_wallet);
CREATE INDEX idx_point_txns_created_at ON point_transactions(created_at DESC);
CREATE INDEX idx_point_txns_reason ON point_transactions(reason);

-- ============================================
-- 5. POLL STATS TABLE
-- ============================================
CREATE TABLE poll_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id TEXT UNIQUE NOT NULL,
  
  total_votes INTEGER DEFAULT 0,
  unique_voters INTEGER DEFAULT 0,
  
  views INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  
  first_vote_at TIMESTAMP,
  last_vote_at TIMESTAMP,
  
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (poll_id) REFERENCES polls(poll_id)
);

CREATE INDEX idx_poll_stats_poll ON poll_stats(poll_id);

-- ============================================
-- 6. DATABASE FUNCTIONS
-- ============================================

-- Check if user has voted on a poll
CREATE OR REPLACE FUNCTION has_voted(
  p_poll_id TEXT,
  p_voter_wallet TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM vote_records
    WHERE poll_id = p_poll_id
      AND voter_wallet = p_voter_wallet
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record a vote with point rewards
CREATE OR REPLACE FUNCTION record_vote(
  p_poll_id TEXT,
  p_voter_wallet TEXT,
  p_transaction_signature TEXT
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Ensure member exists
  INSERT INTO members (wallet_address)
  VALUES (p_voter_wallet)
  ON CONFLICT (wallet_address) DO UPDATE
  SET last_active = NOW();
  
  -- Insert vote record
  INSERT INTO vote_records (poll_id, voter_wallet, transaction_signature)
  VALUES (p_poll_id, p_voter_wallet, p_transaction_signature);
  
  -- Award points (1 point per vote)
  UPDATE members 
  SET points = points + 1, last_active = NOW()
  WHERE wallet_address = p_voter_wallet;
  
  -- Record transaction
  INSERT INTO point_transactions (member_wallet, amount, reason, reference_id)
  VALUES (p_voter_wallet, 1, 'vote_cast', p_poll_id);
  
  -- Update stats
  UPDATE poll_stats 
  SET 
    total_votes = total_votes + 1,
    unique_voters = unique_voters + 1,
    last_vote_at = NOW(),
    first_vote_at = COALESCE(first_vote_at, NOW())
  WHERE poll_id = p_poll_id;
  
  -- Update poll
  UPDATE polls
  SET total_participants = total_participants + 1
  WHERE poll_id = p_poll_id;
  
  -- Return success with new point total
  SELECT json_build_object(
    'success', true,
    'points_awarded', 1,
    'total_points', points
  ) INTO v_result
  FROM members
  WHERE wallet_address = p_voter_wallet;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create poll with metadata
CREATE OR REPLACE FUNCTION create_poll(
  p_poll_id TEXT,
  p_chain_address TEXT,
  p_creator_wallet TEXT,
  p_question TEXT,
  p_description TEXT DEFAULT NULL,
  p_category TEXT DEFAULT 'general',
  p_ends_at TIMESTAMP DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_new_poll_id UUID;
BEGIN
  -- Ensure member exists
  INSERT INTO members (wallet_address)
  VALUES (p_creator_wallet)
  ON CONFLICT (wallet_address) DO UPDATE
  SET last_active = NOW();
  
  -- Create poll
  INSERT INTO polls (
    poll_id, chain_address, creator_wallet, 
    question, description, category, ends_at
  ) VALUES (
    p_poll_id, p_chain_address, p_creator_wallet,
    p_question, p_description, p_category, p_ends_at
  ) RETURNING id INTO v_new_poll_id;
  
  -- Initialize stats
  INSERT INTO poll_stats (poll_id) VALUES (p_poll_id);
  
  -- Award points to creator (5 points)
  UPDATE members 
  SET points = points + 5, last_active = NOW()
  WHERE wallet_address = p_creator_wallet;
  
  INSERT INTO point_transactions (member_wallet, amount, reason, reference_id)
  VALUES (p_creator_wallet, 5, 'poll_created', p_poll_id);
  
  RETURN v_new_poll_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. TEST DATA
-- ============================================

-- Create a test member
INSERT INTO members (wallet_address, username, bio, points)
VALUES (
  'TestWallet123',
  'testuser',
  'Test user for development',
  0
) ON CONFLICT (wallet_address) DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Database schema created successfully!';
  RAISE NOTICE '📊 Tables: members, polls, vote_records, point_transactions, poll_stats';
  RAISE NOTICE '🔧 Functions: has_voted(), record_vote(), create_poll()';
  RAISE NOTICE '👤 Test member created: TestWallet123';
END $$;
