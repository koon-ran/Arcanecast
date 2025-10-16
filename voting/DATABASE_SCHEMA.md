# VeiledCasts Database Schema

## Overview
Database for managing community voting, member profiles, point system, and poll metadata.

---

## Tables

### 1. **members**
Stores community member profiles and points.

```sql
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
```

**Purpose:**
- Track community members (wallet → profile mapping)
- Store reputation points
- Enable social features (username, bio, avatar)

---

### 2. **polls**
Stores poll metadata (question, description, dates, etc.)

```sql
CREATE TABLE polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id TEXT UNIQUE NOT NULL,  -- Matches on-chain poll ID
  chain_address TEXT UNIQUE NOT NULL,  -- PDA address
  creator_wallet TEXT NOT NULL,
  
  -- Poll details
  question TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,  -- 'recognizer', 'general', 'nomination', 'award'
  
  -- Timing
  created_at TIMESTAMP DEFAULT NOW(),
  starts_at TIMESTAMP DEFAULT NOW(),
  ends_at TIMESTAMP,
  revealed_at TIMESTAMP,
  
  -- State
  status TEXT DEFAULT 'active',  -- 'active', 'closed', 'revealed'
  is_featured BOOLEAN DEFAULT FALSE,
  
  -- Results (populated after reveal)
  yes_votes INTEGER,
  no_votes INTEGER,
  total_participants INTEGER DEFAULT 0,
  
  -- Metadata
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
```

**Purpose:**
- Store rich metadata not on-chain (description, tags, images)
- Track poll lifecycle (active, closed, revealed)
- Enable filtering by category, date, status
- Cache revealed results for quick access

---

### 3. **vote_records**
Tracks WHO voted (not WHAT they voted) for enforcing one-vote-per-wallet.

```sql
CREATE TABLE vote_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id TEXT NOT NULL,
  voter_wallet TEXT NOT NULL,
  voted_at TIMESTAMP DEFAULT NOW(),
  transaction_signature TEXT,
  
  -- Prevent duplicate votes
  UNIQUE(poll_id, voter_wallet),
  
  FOREIGN KEY (poll_id) REFERENCES polls(poll_id),
  FOREIGN KEY (voter_wallet) REFERENCES members(wallet_address)
);

CREATE INDEX idx_vote_records_poll ON vote_records(poll_id);
CREATE INDEX idx_vote_records_voter ON vote_records(voter_wallet);
CREATE INDEX idx_vote_records_voted_at ON vote_records(voted_at DESC);
```

**Purpose:**
- Enforce one vote per wallet per poll
- Track participation history
- Generate user voting analytics
- **CRITICAL:** Does NOT store vote choice (that's encrypted on-chain)

---

### 4. **nominations**
Stores nominee data for "Poll Nominations" and "Community Awards" sections.

```sql
CREATE TABLE nominations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id TEXT NOT NULL,
  nominated_wallet TEXT NOT NULL,
  nominator_wallet TEXT NOT NULL,
  
  -- Nomination details
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Prevent duplicate nominations
  UNIQUE(poll_id, nominated_wallet, nominator_wallet),
  
  FOREIGN KEY (poll_id) REFERENCES polls(poll_id),
  FOREIGN KEY (nominated_wallet) REFERENCES members(wallet_address),
  FOREIGN KEY (nominator_wallet) REFERENCES members(wallet_address)
);

CREATE INDEX idx_nominations_poll ON nominations(poll_id);
CREATE INDEX idx_nominations_nominated ON nominations(nominated_wallet);
CREATE INDEX idx_nominations_nominator ON nominations(nominator_wallet);
```

**Purpose:**
- Track who nominated whom
- Enable multi-choice polls (winner = most nominations)
- Show nomination history on member profiles

---

### 5. **point_transactions**
Records all point gains/losses for transparency and audit.

```sql
CREATE TABLE point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_wallet TEXT NOT NULL,
  amount INTEGER NOT NULL,  -- Positive for gains, negative for spending
  reason TEXT NOT NULL,  -- 'vote_cast', 'poll_created', 'recognition_won', 'award_won'
  reference_id TEXT,  -- poll_id or nomination_id
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (member_wallet) REFERENCES members(wallet_address)
);

CREATE INDEX idx_point_txns_member ON point_transactions(member_wallet);
CREATE INDEX idx_point_txns_created_at ON point_transactions(created_at DESC);
CREATE INDEX idx_point_txns_reason ON point_transactions(reason);
```

**Purpose:**
- Transparent point history
- Enable leaderboards ("Most active voters", "Top earners")
- Audit trail for disputes

---

### 6. **poll_stats**
Aggregated statistics for analytics dashboard.

```sql
CREATE TABLE poll_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id TEXT UNIQUE NOT NULL,
  
  -- Participation
  total_votes INTEGER DEFAULT 0,
  unique_voters INTEGER DEFAULT 0,
  
  -- Engagement
  views INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  
  -- Timing
  first_vote_at TIMESTAMP,
  last_vote_at TIMESTAMP,
  average_vote_time INTERVAL,  -- Time from poll creation to vote
  
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (poll_id) REFERENCES polls(poll_id)
);

CREATE INDEX idx_poll_stats_poll ON poll_stats(poll_id);
```

**Purpose:**
- Analytics dashboard ("Highest participation", "Trending polls")
- A/B testing (which poll formats get more engagement)
- Community insights

---

### 7. **comments** (Optional - Future Enhancement)
Community discussion on polls.

```sql
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id TEXT NOT NULL,
  author_wallet TEXT NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID,  -- For threaded replies
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  
  FOREIGN KEY (poll_id) REFERENCES polls(poll_id),
  FOREIGN KEY (author_wallet) REFERENCES members(wallet_address),
  FOREIGN KEY (parent_id) REFERENCES comments(id)
);

CREATE INDEX idx_comments_poll ON comments(poll_id);
CREATE INDEX idx_comments_author ON comments(author_wallet);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);
```

---

## Views (Computed Queries)

### Active Polls View
```sql
CREATE VIEW active_polls AS
SELECT 
  p.*,
  m.username as creator_username,
  m.avatar_url as creator_avatar,
  COALESCE(ps.total_votes, 0) as vote_count
FROM polls p
LEFT JOIN members m ON p.creator_wallet = m.wallet_address
LEFT JOIN poll_stats ps ON p.poll_id = ps.poll_id
WHERE p.status = 'active'
  AND (p.ends_at IS NULL OR p.ends_at > NOW())
ORDER BY p.created_at DESC;
```

### Member Leaderboard View
```sql
CREATE VIEW member_leaderboard AS
SELECT 
  m.wallet_address,
  m.username,
  m.avatar_url,
  m.points,
  COUNT(DISTINCT vr.poll_id) as polls_voted,
  COUNT(DISTINCT p.poll_id) as polls_created
FROM members m
LEFT JOIN vote_records vr ON m.wallet_address = vr.voter_wallet
LEFT JOIN polls p ON m.wallet_address = p.creator_wallet
GROUP BY m.wallet_address, m.username, m.avatar_url, m.points
ORDER BY m.points DESC;
```

---

## Row Level Security (RLS) Policies

### Members Table
```sql
-- Anyone can view profiles
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members are viewable by everyone" 
  ON members FOR SELECT 
  USING (true);

CREATE POLICY "Members can update own profile" 
  ON members FOR UPDATE 
  USING (auth.uid() = id);
```

### Vote Records Table
```sql
-- Hide vote records from public (privacy)
ALTER TABLE vote_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vote records are private" 
  ON vote_records FOR SELECT 
  USING (false);  -- Only accessible via backend functions

CREATE POLICY "System can insert vote records" 
  ON vote_records FOR INSERT 
  WITH CHECK (true);  -- Backend service role only
```

---

## Database Functions

### 1. Check if user has voted
```sql
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
```

### 2. Record a vote (with points)
```sql
CREATE OR REPLACE FUNCTION record_vote(
  p_poll_id TEXT,
  p_voter_wallet TEXT,
  p_transaction_signature TEXT
) RETURNS VOID AS $$
DECLARE
  v_poll_category TEXT;
BEGIN
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
    last_vote_at = NOW()
  WHERE poll_id = p_poll_id;
  
  -- Update poll
  UPDATE polls
  SET total_participants = total_participants + 1
  WHERE poll_id = p_poll_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. Create poll with stats
```sql
CREATE OR REPLACE FUNCTION create_poll(
  p_poll_id TEXT,
  p_chain_address TEXT,
  p_creator_wallet TEXT,
  p_question TEXT,
  p_description TEXT,
  p_category TEXT,
  p_ends_at TIMESTAMP
) RETURNS UUID AS $$
DECLARE
  v_new_poll_id UUID;
BEGIN
  -- Ensure member exists
  INSERT INTO members (wallet_address)
  VALUES (p_creator_wallet)
  ON CONFLICT (wallet_address) DO NOTHING;
  
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
  
  -- Award points to creator (5 points for creating poll)
  UPDATE members 
  SET points = points + 5
  WHERE wallet_address = p_creator_wallet;
  
  INSERT INTO point_transactions (member_wallet, amount, reason, reference_id)
  VALUES (p_creator_wallet, 5, 'poll_created', p_poll_id);
  
  RETURN v_new_poll_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Point System Rules

| Action | Points Awarded | Notes |
|--------|----------------|-------|
| **Cast Vote** | +1 | Per vote (enforced: 1 per poll) |
| **Create Poll** | +5 | Creating quality content |
| **Win Recognition** | +10 | Poll category: "recognizer" |
| **Win Award** | +25 | Poll category: "award" |
| **Get Nominated** | +2 | Someone recognizes you |
| **Poll Reaches 100 Votes** | +10 | Bonus for popular polls |

---

## Setup Instructions

### 1. Create Supabase Project
```bash
# Visit supabase.com
# Create new project: "veiledcasts"
# Note: Project URL and anon key
```

### 2. Run SQL Schema
Copy all CREATE TABLE statements into Supabase SQL Editor and run.

### 3. Enable Realtime (Optional)
```sql
-- Enable realtime for live vote counts
ALTER PUBLICATION supabase_realtime ADD TABLE polls;
ALTER PUBLICATION supabase_realtime ADD TABLE poll_stats;
```

### 4. Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Backend only
```

---

## API Endpoints Structure

### Frontend (Next.js API Routes)

```
/api/polls
  GET    - List polls (filter by category, status)
  POST   - Create poll metadata

/api/polls/[id]
  GET    - Get poll details
  PATCH  - Update poll (creator only)

/api/polls/[id]/vote
  POST   - Record vote (check eligibility first)

/api/polls/[id]/reveal
  POST   - Update with revealed results

/api/members/[wallet]
  GET    - Get member profile
  PATCH  - Update profile

/api/members/[wallet]/votes
  GET    - Get vote history (list of polls voted on)

/api/leaderboard
  GET    - Top members by points
```

---

## Data Flow Example

### User Casts Vote:
1. **Frontend** calls `hasVoted(pollId, wallet)` → Check eligibility
2. **Frontend** calls blockchain `castVote()` → Get tx signature
3. **Frontend** calls `/api/polls/[id]/vote` with signature
4. **Backend** calls `record_vote()` function → Awards points, updates stats
5. **Frontend** polls for MPC completion
6. **Frontend** shows "Vote recorded! +1 point"

---

## Estimated Setup Time
- Schema creation: **30 minutes**
- RLS policies: **20 minutes**
- Database functions: **40 minutes**
- API routes: **2-3 hours**
- Testing: **1 hour**

**Total: ~5 hours for complete database + API layer**

---

## Next Steps After Database
1. ✅ Setup Supabase project
2. ✅ Run schema SQL
3. ✅ Create API routes
4. ✅ Update votingService.ts to call API
5. ✅ Add point display to UI
6. ✅ Build member profile page
7. ✅ Implement leaderboard
8. ✅ Build each of 4 sections
