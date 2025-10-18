-- DAO Tables Schema Migration
-- Run this in Supabase SQL Editor

-- 1. Add missing columns to dao_polls
ALTER TABLE dao_polls ADD COLUMN IF NOT EXISTS week_id INTEGER;
ALTER TABLE dao_polls ADD COLUMN IF NOT EXISTS deadline TIMESTAMP WITH TIME ZONE;
ALTER TABLE dao_polls ADD COLUMN IF NOT EXISTS onchain_id INTEGER;
ALTER TABLE dao_polls ADD COLUMN IF NOT EXISTS vote_counts INTEGER[];
ALTER TABLE dao_polls ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE dao_polls ADD COLUMN IF NOT EXISTS revealed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE dao_polls ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE dao_polls ADD COLUMN IF NOT EXISTS reveal_tx_signature TEXT;

-- 2. Update existing polls with current week_id
UPDATE dao_polls 
SET week_id = EXTRACT(WEEK FROM created_at)
WHERE week_id IS NULL;

-- 3. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_dao_polls_week_id ON dao_polls(week_id);
CREATE INDEX IF NOT EXISTS idx_dao_polls_status_section ON dao_polls(status, section);
CREATE INDEX IF NOT EXISTS idx_dao_polls_creator ON dao_polls(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_dao_polls_deadline ON dao_polls(deadline);

-- 4. Ensure selections table has week_id
ALTER TABLE selections ADD COLUMN IF NOT EXISTS week_id INTEGER;

-- 5. Update existing selections with week_id from created_at
UPDATE selections 
SET week_id = EXTRACT(WEEK FROM created_at)
WHERE week_id IS NULL;

-- 6. Add indexes for selections
CREATE INDEX IF NOT EXISTS idx_selections_wallet_week ON selections(wallet, week_id);
CREATE INDEX IF NOT EXISTS idx_selections_poll ON selections(poll_id);

-- 7. Ensure dao_voting_records table exists
CREATE TABLE IF NOT EXISTS dao_voting_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID REFERENCES dao_polls(id) ON DELETE CASCADE,
  wallet TEXT NOT NULL,
  tx_signature TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(poll_id, wallet)
);

-- 8. Add indexes for voting records
CREATE INDEX IF NOT EXISTS idx_dao_voting_records_wallet ON dao_voting_records(wallet);
CREATE INDEX IF NOT EXISTS idx_dao_voting_records_poll ON dao_voting_records(poll_id);

-- 9. Ensure user_points table exists with RPC function
CREATE TABLE IF NOT EXISTS user_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet TEXT UNIQUE NOT NULL,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Create or replace add_points RPC function
CREATE OR REPLACE FUNCTION add_points(p_wallet TEXT, p_points INTEGER)
RETURNS void AS $$
BEGIN
  INSERT INTO user_points (wallet, points)
  VALUES (p_wallet, p_points)
  ON CONFLICT (wallet)
  DO UPDATE SET 
    points = user_points.points + p_points,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 11. Verify schema
SELECT 
  'dao_polls' as table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'dao_polls' 
ORDER BY ordinal_position;
