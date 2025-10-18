# DAO Voting System - Complete Guide

## Overview

The VeiledCasts DAO voting system enables confidential community governance through MPC-encrypted voting on multi-option polls. The system operates on a weekly cycle with automated promotion, reveal, and archival processes.

## Architecture

### Tech Stack
- **Frontend**: Next.js 14, React 18, TypeScript, TailwindCSS
- **Blockchain**: Solana (devnet), Anchor Framework
- **MPC**: Arcium Protocol for confidential computation
- **Database**: Supabase (PostgreSQL)
- **Wallet**: Solana Wallet Adapter
- **Automation**: Vercel Cron Jobs

### Program ID
```
DZDFeQuWe8ULjVUjhY7qvPMHo4D2h8YCetv4VwwwE96X (devnet)
```

## Weekly Cycle

### Phase 1: Nomination (Continuous)
- **Duration**: Ongoing
- **Who**: Any connected wallet
- **Actions**:
  - Create poll proposals (2-4 options, 10-100 char question)
  - Select up to 5 proposals per week
- **Points**:
  - +5 points for creating a proposal
  - +1 point for each selection (max 5/week)

### Phase 2: Selection Period (Week Start → Monday 00:00 UTC)
- Community selects their favorite proposals
- Each wallet can select up to 5 different proposals per calendar week
- Proposals accumulate `selection_count`

### Phase 3: Promotion (Monday 00:00 UTC - Automated)
- **Cron Job**: `/api/cron/promote-polls`
- Top 5 proposals by `selection_count` promoted to voting
- 7-day voting deadline set (expires next Monday)
- Creators awarded +10 bonus points

### Phase 4: Voting (Monday → Monday, 7 days)
- **Duration**: 7 days
- **Who**: Any connected wallet
- **Actions**:
  - Cast one vote per poll (choose A, B, C, or D)
  - Vote is encrypted using MPC
- **Points**: +3 points per vote
- **Privacy**: Individual votes never revealed, only totals

### Phase 5: Reveal (Hourly - Automated)
- **Cron Job**: `/api/cron/auto-reveal`
- Runs every hour to check for expired polls
- Calls `revealMultiOptionResult` on-chain
- Decrypts vote counts and updates database

### Phase 6: Results (After Reveal)
- Results displayed in Completed section
- Percentage breakdown for each option
- Winner highlighted with crown emoji 👑
- Vote counts visible to all

### Phase 7: Archival (Daily 02:00 UTC - Automated)
- **Cron Job**: `/api/cron/archive-nominations`
- Archives nominations older than 30 days
- Cleans up database

## Database Schema

### `dao_polls` Table
```sql
CREATE TABLE dao_polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  options TEXT[] NOT NULL CHECK (array_length(options, 1) BETWEEN 2 AND 4),
  creator_wallet TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nomination',
  section TEXT NOT NULL DEFAULT 'nomination',
  week_id INTEGER NOT NULL,
  selection_count INTEGER DEFAULT 0,
  onchain_id INTEGER,
  deadline TIMESTAMP WITH TIME ZONE,
  vote_counts INTEGER[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  promoted_at TIMESTAMP WITH TIME ZONE,
  revealed_at TIMESTAMP WITH TIME ZONE,
  reveal_tx_signature TEXT,
  archived_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_dao_polls_status_section ON dao_polls(status, section);
CREATE INDEX idx_dao_polls_week_id ON dao_polls(week_id);
CREATE INDEX idx_dao_polls_creator ON dao_polls(creator_wallet);
```

### `selections` Table
```sql
CREATE TABLE selections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID REFERENCES dao_polls(id) ON DELETE CASCADE,
  wallet TEXT NOT NULL,
  week_id INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(poll_id, wallet)
);

-- Indexes
CREATE INDEX idx_selections_wallet_week ON selections(wallet, week_id);
CREATE INDEX idx_selections_poll ON selections(poll_id);
```

### `dao_voting_records` Table
```sql
CREATE TABLE dao_voting_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID REFERENCES dao_polls(id) ON DELETE CASCADE,
  wallet TEXT NOT NULL,
  tx_signature TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(poll_id, wallet)
);

-- Indexes
CREATE INDEX idx_dao_voting_records_wallet ON dao_voting_records(wallet);
CREATE INDEX idx_dao_voting_records_poll ON dao_voting_records(poll_id);
```

### `user_points` Table
```sql
CREATE TABLE user_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet TEXT UNIQUE NOT NULL,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RPC function to add points
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
```

### Triggers
```sql
-- Increment selection_count when selection created
CREATE OR REPLACE FUNCTION increment_selection_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE dao_polls 
  SET selection_count = selection_count + 1 
  WHERE id = NEW.poll_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER selection_count_increment
AFTER INSERT ON selections
FOR EACH ROW
EXECUTE FUNCTION increment_selection_count();

-- Decrement selection_count when selection deleted
CREATE OR REPLACE FUNCTION decrement_selection_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE dao_polls 
  SET selection_count = GREATEST(0, selection_count - 1)
  WHERE id = OLD.poll_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER selection_count_decrement
AFTER DELETE ON selections
FOR EACH ROW
EXECUTE FUNCTION decrement_selection_count();
```

## API Routes

### Poll Management

**GET /api/dao/polls**
- Query parameters:
  - `section`: 'nomination' | 'voting' | 'completed'
  - `sort`: 'newest' | 'popular' | 'oldest' (nomination only)
- Returns: List of polls for the specified section

**POST /api/dao/polls**
- Body: `{ question: string, options: string[], wallet: string }`
- Validates: question (10-100 chars), options (2-4, max 50 chars each)
- Awards: +5 points
- Returns: Created poll object

### Selection Management

**GET /api/dao/selections**
- Query parameters:
  - `wallet`: User's wallet address
- Returns: List of user's selections for current week

**POST /api/dao/selections**
- Body: `{ poll_id: string, wallet: string }`
- Validates: Max 5 selections per week, one per poll
- Awards: +1 point
- Returns: Created selection object

**DELETE /api/dao/selections/:id**
- Removes selection
- Decrements poll's `selection_count`
- Returns: Success message

### Voting Management

**GET /api/dao/voting-records**
- Query parameters:
  - `poll_id`: Poll ID
  - `wallet`: User's wallet address
- Returns: `{ has_voted: boolean }`

**POST /api/dao/voting-records**
- Body: `{ poll_id: string, wallet: string, tx_signature: string }`
- Validates: One vote per poll per wallet
- Awards: +3 points
- Returns: Created voting record

### Cron Jobs (Authenticated)

**GET /api/cron/promote-polls**
- Auth: `Bearer ${CRON_SECRET}`
- Schedule: Monday 00:00 UTC
- Returns: Promotion summary with promoted polls and points awarded

**GET /api/cron/auto-reveal**
- Auth: `Bearer ${CRON_SECRET}`
- Schedule: Hourly
- Returns: Reveal summary with vote counts and transaction signatures

**GET /api/cron/archive-nominations**
- Auth: `Bearer ${CRON_SECRET}`
- Schedule: Daily 02:00 UTC
- Returns: Archive summary with archived poll count

## UI Components

### 1. DAOPage (`/app/dao/page.tsx`)
Main DAO interface with 3-tab navigation:
- Nomination tab (selection interface)
- Voting tab (active polls)
- Completed tab (results)
- "Propose Poll" button (opens modal)
- "How It Works" info banner

### 2. ProposePollModal (`/components/ProposePollModal.tsx`)
Poll creation modal:
- Question input (10-100 chars)
- Dynamic options array (2-4 options, add/remove buttons)
- Character counters
- Form validation
- Awards 5 points on submission

### 3. NominationSection (`/components/NominationSection.tsx`)
Nomination display and selection:
- Selection counter (X/5 remaining)
- Sort buttons (newest, popular, oldest)
- Select/Deselect actions
- Real-time selection_count updates
- Visual feedback (purple border for selected)
- Awards 1 point per selection

### 4. VotingSection (`/components/VotingSection.tsx`)
Active voting polls:
- Countdown timer for each poll
- Multi-option vote buttons (A, B, C, D)
- Confidential voting banner
- Vote tracking (prevents duplicate votes)
- **TODO**: Integrate MPC on-chain voting
- Awards 3 points per vote

### 5. CompletedSection (`/components/CompletedSection.tsx`)
Results display:
- Percentage calculations
- Progress bar visualizations
- Winner highlighting (crown emoji, green styling)
- Vote count breakdown
- Pending state for unrevealed polls

## Point System

| Action | Points | Notes |
|--------|--------|-------|
| Create proposal | +5 | One-time per proposal |
| Select proposal | +1 | Max 5 per week |
| Proposal promoted | +10 | Bonus for creator |
| Cast vote | +3 | One per poll |

**Total potential per week:**
- Create 10 proposals: 50 points
- Select 5 proposals: 5 points
- 5 proposals promoted: 50 points bonus
- Vote on 5 polls: 15 points
- **Maximum: ~120 points/week**

## MPC Integration

### Circuit Files (Built)
- `init_multi_option_vote_stats.arcis` (28KB)
- `vote_multi_option.arcis` (45KB)
- `reveal_multi_option_result.arcis` (19KB)

### On-Chain Instructions

**createMultiOptionPoll**
```rust
pub fn create_multi_option_poll(
    ctx: Context<CreateMultiOptionPoll>,
    id: u32,
    question: String,
    options: Vec<String>,
) -> Result<()>
```

**voteMultiOption**
```rust
pub fn vote_multi_option(
    ctx: Context<VoteMultiOption>,
    computation_offset: u32,
    id: u32,
    selected_option_encrypted: Vec<u8>,
    vote_encryption_pubkey: Vec<u8>,
    vote_nonce: Vec<u8>,
) -> Result<()>
```

**revealMultiOptionResult**
```rust
pub fn reveal_multi_option_result(
    ctx: Context<RevealMultiOptionResult>,
    id: u32,
) -> Result<RevealMultiOptionResultEvent>
```

### Account Structure
```rust
pub struct MultiOptionPollAccount {
    pub bump: u8,
    pub vote_state: [[u8; 32]; 5], // 4 options + num_options
    pub id: u32,
    pub authority: Pubkey,
    pub nonce: u128,
    pub question: String,
    pub options: Vec<String>,
    pub num_options: u8,
}
```

## Environment Variables

### Required for App
```bash
NEXT_PUBLIC_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_VOTING_PROGRAM_ID=DZDFeQuWe8ULjVUjhY7qvPMHo4D2h8YCetv4VwwwE96X
NEXT_PUBLIC_ARCIUM_PROGRAM_ID=BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
```

### Required for Cron Jobs
```bash
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CRON_SECRET=random_secret_here
AUTHORITY_KEYPAIR=[1,2,3,...] # JSON array or base58
```

## Deployment

### 1. Setup Supabase
```sql
-- Run all table creation scripts
-- Run trigger creation scripts
-- Run RPC function scripts
```

### 2. Deploy Solana Program
```bash
cd voting
arcium build
anchor build
anchor deploy --provider.cluster devnet
```

### 3. Deploy Next.js App
```bash
cd voting/app
npm install
npm run build
vercel deploy --prod
```

### 4. Configure Environment
- Add all required env vars in Vercel dashboard
- Generate and set `CRON_SECRET`
- Set `AUTHORITY_KEYPAIR` for auto-reveal

### 5. Verify Cron Jobs
- Check Vercel dashboard → Cron Jobs
- Manually trigger test runs
- Monitor logs for errors

## Testing

### Manual Testing Checklist

**Nomination Phase:**
- [ ] Connect wallet
- [ ] Create proposal with 2 options
- [ ] Create proposal with 4 options
- [ ] Verify 5 points awarded
- [ ] Select 5 different proposals
- [ ] Verify 1 point per selection
- [ ] Try selecting 6th (should fail)
- [ ] Deselect one proposal
- [ ] Verify selection_count decrements

**Promotion:**
- [ ] Manually trigger `/api/cron/promote-polls`
- [ ] Verify top 5 moved to voting
- [ ] Verify 10 bonus points awarded to creators
- [ ] Check deadline is +7 days

**Voting Phase:**
- [ ] See active polls in Voting tab
- [ ] Cast vote on one poll
- [ ] Verify 3 points awarded
- [ ] Try voting again (should fail)
- [ ] Check countdown timer updates

**Reveal:**
- [ ] Wait for deadline or mock date
- [ ] Manually trigger `/api/cron/auto-reveal`
- [ ] Verify vote_counts populated
- [ ] Check transaction signature saved
- [ ] View results in Completed tab

**Results:**
- [ ] See percentage breakdown
- [ ] Verify winner highlighted
- [ ] Check progress bars accurate
- [ ] Verify vote counts match on-chain

## Troubleshooting

### Common Issues

**"Please connect your wallet"**
- Solution: Install and connect a Solana wallet (Phantom, Solflare, etc.)

**"You can only select 5 proposals per week"**
- Solution: Deselect an existing proposal first, or wait for next Monday

**"Failed to create poll"**
- Check: Question length (10-100 chars)
- Check: Number of options (2-4)
- Check: Option lengths (max 50 chars each)
- Check: Wallet connected

**Cron job not running**
- Check: `CRON_SECRET` matches in env vars
- Check: Vercel cron jobs enabled
- Check: No syntax errors in cron endpoints

**Auto-reveal failing**
- Check: `AUTHORITY_KEYPAIR` is valid
- Check: Authority wallet has SOL
- Check: `onchain_id` exists for poll
- Check: Solana RPC accessible

## Future Enhancements

### Priority 1: MPC On-Chain Voting
- Integrate Arcium encryption in VotingSection
- Call `voteMultiOption` instruction
- Handle MPC computation callbacks

### Priority 2: Point Leaderboard
- Display top contributors
- Weekly/all-time rankings
- Point rewards or badges

### Priority 3: Proposal Comments
- Allow discussion on proposals
- Threaded comments
- Upvote/downvote system

### Priority 4: Advanced Analytics
- Participation metrics
- Voting patterns
- Proposal success rates

### Priority 5: Governance Integration
- Use points for voting weight
- Quadratic voting option
- Delegation system

## Support

For issues or questions:
- Check this documentation
- Review API route handlers for error messages
- Check Vercel logs for cron job errors
- Review Supabase logs for database errors
- Check Solana Explorer for transaction details

## License

[Your License Here]
