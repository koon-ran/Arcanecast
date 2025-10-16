-- Migration: Remove vote count columns for full confidentiality
-- Date: 2025-10-15
-- Reason: Vote counts undermine MPC privacy model
-- Only winner (yes/no) should be revealed, not actual counts

-- Drop the vote count columns
ALTER TABLE polls DROP COLUMN IF EXISTS yes_votes;
ALTER TABLE polls DROP COLUMN IF EXISTS no_votes;

-- Add comment to winner column for clarity
COMMENT ON COLUMN polls.winner IS 'Result after MPC reveal: which side won (yes or no), not vote counts';
