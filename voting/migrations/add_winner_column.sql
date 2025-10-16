-- Add winner field to polls table
-- Run this in Supabase SQL Editor

ALTER TABLE polls 
ADD COLUMN IF NOT EXISTS winner TEXT CHECK (winner IN ('yes', 'no'));

-- Add comment
COMMENT ON COLUMN polls.winner IS 'Which option won after reveal (yes or no)';

-- Create index for querying by winner
CREATE INDEX IF NOT EXISTS idx_polls_winner ON polls(winner) WHERE winner IS NOT NULL;
