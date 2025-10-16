-- Combined Migration: Full Confidentiality Model
-- Date: 2025-10-15
-- Purpose: Store only winner after reveal, not vote counts (aligns with MPC privacy)

-- Step 1: Add winner column (stores MPC result: which side won)
ALTER TABLE polls 
ADD COLUMN IF NOT EXISTS winner TEXT 
CHECK (winner IN ('yes', 'no'));

-- Step 2: Remove vote count columns (they leak confidential data)
ALTER TABLE polls DROP COLUMN IF EXISTS yes_votes;
ALTER TABLE polls DROP COLUMN IF EXISTS no_votes;

-- Step 3: Add index for winner queries
CREATE INDEX IF NOT EXISTS idx_polls_winner ON polls(winner);

-- Step 4: Add comments for clarity
COMMENT ON COLUMN polls.winner IS 'MPC reveal result: which side won (yes or no). Vote counts remain confidential.';
COMMENT ON COLUMN polls.total_participants IS 'Count of unique voters (safe to reveal - does not show vote distribution)';
