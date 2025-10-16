-- DAO Voting System Schema
-- Date: 2025-10-16
-- Purpose: Multi-section DAO with nominations, voting, and completed polls

-- ============================================================================
-- 1. DAO POLLS TABLE
-- ============================================================================
-- Stores all polls across nomination, voting, and completed sections
CREATE TABLE dao_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  options TEXT[] NOT NULL CHECK (array_length(options, 1) BETWEEN 2 AND 4), -- Max 4 options
  creator_wallet TEXT NOT NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'nomination' CHECK (status IN ('nomination', 'voting', 'completed', 'archived')),
  section TEXT NOT NULL DEFAULT 'nomination' CHECK (section IN ('nomination', 'voting', 'completed', 'archived')),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  voting_starts_at TIMESTAMP, -- When moved to voting section
  voting_ends_at TIMESTAMP,   -- 1 week after voting_starts_at
  revealed_at TIMESTAMP,      -- When results revealed
  archived_at TIMESTAMP,      -- If archived from nomination (30 days old)
  
  -- Metadata
  selection_count INTEGER DEFAULT 0, -- How many users selected this (hidden from UI)
  on_chain_poll_id INTEGER,          -- null until moved to voting section
  
  -- Results (populated after reveal)
  vote_counts INTEGER[],             -- [count1, count2, count3, count4] from MPC reveal
  total_votes INTEGER,               -- Sum of vote_counts
  
  -- Indexes
  created_at_idx TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_dao_polls_status ON dao_polls(status);
CREATE INDEX idx_dao_polls_section ON dao_polls(section);
CREATE INDEX idx_dao_polls_creator ON dao_polls(creator_wallet);
CREATE INDEX idx_dao_polls_created_at ON dao_polls(created_at DESC);
CREATE INDEX idx_dao_polls_selection_count ON dao_polls(selection_count DESC); -- For popularity sort

-- Composite indexes for common queries (performance boost)
CREATE INDEX idx_dao_polls_section_status ON dao_polls(section, status);
CREATE INDEX idx_dao_polls_weekly_sort ON dao_polls(section, selection_count DESC, created_at DESC);

-- Comments
COMMENT ON TABLE dao_polls IS 'All DAO polls across nomination, voting, and completed sections';
COMMENT ON COLUMN dao_polls.options IS 'Array of 2-4 option strings that users can vote on';
COMMENT ON COLUMN dao_polls.selection_count IS 'Count of users who selected this poll in nomination (hidden from UI, used for sorting)';
COMMENT ON COLUMN dao_polls.vote_counts IS 'Decrypted vote counts from MPC reveal: [option1_count, option2_count, ...]';


-- ============================================================================
-- 2. SELECTIONS TABLE (Nomination Section)
-- ============================================================================
-- Tracks which wallets selected which polls in nomination section
-- Users can select up to 5 polls per week
CREATE TABLE selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES dao_polls(id) ON DELETE CASCADE,
  wallet TEXT NOT NULL,
  week_id INTEGER NOT NULL, -- Format: YYYYWW (e.g., 202443 = year 2024, week 43)
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(poll_id, wallet, week_id) -- One selection per poll per wallet per week
);

-- Indexes
CREATE INDEX idx_selections_wallet_week ON selections(wallet, week_id);
CREATE INDEX idx_selections_poll ON selections(poll_id);

-- Comments
COMMENT ON TABLE selections IS 'User selections in nomination section (max 5 per wallet per week)';
COMMENT ON COLUMN selections.week_id IS 'ISO week number in format YYYYWW (e.g., 202443)';


-- ============================================================================
-- 3. VOTING RECORDS TABLE (Voting Section)
-- ============================================================================
-- Tracks participation in voting section (actual votes are encrypted on-chain)
CREATE TABLE dao_voting_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES dao_polls(id) ON DELETE CASCADE,
  wallet TEXT NOT NULL,
  tx_signature TEXT NOT NULL, -- On-chain transaction proof
  voted_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(poll_id, wallet) -- One vote per poll per wallet
);

-- Indexes
CREATE INDEX idx_dao_voting_wallet ON dao_voting_records(wallet);
CREATE INDEX idx_dao_voting_poll ON dao_voting_records(poll_id);

-- Comments
COMMENT ON TABLE dao_voting_records IS 'Voting participation tracking (actual votes encrypted on-chain)';


-- ============================================================================
-- 4. AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamp on any poll update
CREATE TRIGGER trg_update_timestamp
BEFORE UPDATE ON dao_polls
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();


-- ============================================================================
-- 5. HELPER FUNCTIONS
-- ============================================================================

-- Get current ISO week ID (YYYYWW format)
CREATE OR REPLACE FUNCTION get_current_week_id()
RETURNS INTEGER AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM NOW())::INTEGER * 100 + EXTRACT(WEEK FROM NOW())::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Check if user has reached selection limit (5 per week)
CREATE OR REPLACE FUNCTION check_selection_limit(p_wallet TEXT, p_week_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  selection_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO selection_count
  FROM selections
  WHERE wallet = p_wallet AND week_id = p_week_id;
  
  RETURN selection_count < 5;
END;
$$ LANGUAGE plpgsql;

-- ENFORCED selection limit (prevents exceeding 5 in database)
CREATE OR REPLACE FUNCTION enforce_selection_limit()
RETURNS TRIGGER AS $$
DECLARE
  selection_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO selection_count
  FROM selections
  WHERE wallet = NEW.wallet AND week_id = NEW.week_id;
  
  IF selection_count >= 5 THEN
    RAISE EXCEPTION 'Selection limit reached: wallet % already has 5 selections in week %', NEW.wallet, NEW.week_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce 5-selection limit at database level
CREATE TRIGGER trg_enforce_selection_limit
BEFORE INSERT ON selections
FOR EACH ROW
EXECUTE FUNCTION enforce_selection_limit();

-- Increment selection count on poll
CREATE OR REPLACE FUNCTION increment_selection_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE dao_polls
  SET selection_count = selection_count + 1
  WHERE id = NEW.poll_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Decrement selection count on poll
CREATE OR REPLACE FUNCTION decrement_selection_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE dao_polls
  SET selection_count = selection_count - 1
  WHERE id = OLD.poll_id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER trg_selection_insert
  AFTER INSERT ON selections
  FOR EACH ROW
  EXECUTE FUNCTION increment_selection_count();

CREATE TRIGGER trg_selection_delete
  AFTER DELETE ON selections
  FOR EACH ROW
  EXECUTE FUNCTION decrement_selection_count();


-- ============================================================================
-- 5. POINT TRANSACTIONS (Updated for DAO)
-- ============================================================================
-- Add new reason types for DAO actions
ALTER TABLE point_transactions 
DROP CONSTRAINT IF EXISTS point_transactions_reason_check;

ALTER TABLE point_transactions
ADD CONSTRAINT point_transactions_reason_check 
CHECK (reason IN (
  'vote_cast',           -- Old: 1 point
  'poll_created',        -- Old: 5 points
  'recognition_won',     -- Old
  'award_won',          -- Old
  'selection_made',      -- New: 1 point per selection in nomination
  'dao_vote_cast',       -- New: 3 points per vote in voting section
  'poll_selected'        -- New: 10 points if your poll gets into top 5
));


-- ============================================================================
-- 6. ARCHIVE CLEANUP FUNCTION
-- ============================================================================
-- Reset selection_count for archived polls (consistency)
CREATE OR REPLACE FUNCTION archive_old_nominations()
RETURNS void AS $$
BEGIN
  UPDATE dao_polls
  SET status = 'archived',
      section = 'archived',
      archived_at = NOW(),
      selection_count = 0  -- Reset count for archived polls
  WHERE section = 'nomination'
    AND status = 'nomination'
    AND created_at < NOW() - INTERVAL '30 days';
  
  RAISE NOTICE 'Archived old nominations and reset selection counts';
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 7. WEEKLY RESET FUNCTION (for cron job)
-- ============================================================================
-- This moves old selections to history and resets for new week
CREATE TABLE IF NOT EXISTS selection_history (
  LIKE selections INCLUDING ALL
);

CREATE OR REPLACE FUNCTION reset_weekly_selections()
RETURNS void AS $$
DECLARE
  last_week_id INTEGER;
BEGIN
  -- Calculate last week's ID
  last_week_id := get_current_week_id() - 1;
  
  -- Archive last week's selections
  INSERT INTO selection_history
  SELECT * FROM selections WHERE week_id = last_week_id;
  
  -- Reset doesn't delete - selections naturally expire when week_id changes
  -- Users get fresh 5 selections each week based on current week_id
  
  RAISE NOTICE 'Weekly selection reset completed for week %', last_week_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 8. VIEWS FOR CONVENIENCE
-- ============================================================================

-- Active nomination polls (not archived, in nomination section)
CREATE OR REPLACE VIEW active_nominations AS
SELECT * FROM dao_polls
WHERE section = 'nomination' AND status != 'archived'
ORDER BY selection_count DESC, created_at DESC;

-- Current week's voting polls
CREATE OR REPLACE VIEW current_voting_polls AS
SELECT * FROM dao_polls
WHERE section = 'voting' AND status = 'voting'
  AND voting_ends_at > NOW()
ORDER BY voting_starts_at DESC;

-- Completed polls (revealed results)
CREATE OR REPLACE VIEW completed_polls AS
SELECT * FROM dao_polls
WHERE section = 'completed' AND status = 'completed'
ORDER BY revealed_at DESC;


-- ============================================================================
-- 9. SAMPLE DATA (for testing)
-- ============================================================================

-- Uncomment to insert sample polls for testing:
/*
INSERT INTO dao_polls (question, options, creator_wallet, section, status) VALUES
  ('Should we implement governance rewards?', ARRAY['Yes', 'No', 'Needs discussion', 'Defer'], 'sample_wallet_1', 'nomination', 'nomination'),
  ('Which feature should we prioritize?', ARRAY['Mobile app', 'API', 'Dashboard', 'Docs'], 'sample_wallet_2', 'nomination', 'nomination'),
  ('Treasury allocation for Q4?', ARRAY['Development', 'Marketing', 'Operations', 'Reserve'], 'sample_wallet_3', 'nomination', 'nomination');
*/
