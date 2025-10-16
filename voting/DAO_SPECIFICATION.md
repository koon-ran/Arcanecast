# DAO Voting System - Technical Specification
**Date:** October 16, 2025  
**Version:** 1.0

---

## Table of Contents
1. [Overview](#overview)
2. [User Flow](#user-flow)
3. [Database Architecture](#database-architecture)
4. [API Routes](#api-routes)
5. [MPC Circuit Design](#mpc-circuit-design)
6. [Cron Jobs](#cron-jobs)
7. [Points System](#points-system)
8. [UI Components](#ui-components)

---

## Overview

### DAO Structure
The DAO voting system has **4 main sections**:
1. **Nomination Section** - Community proposes and selects polls
2. **Voting Section** - Top 5 polls are voted on with encrypted votes
3. **Completed Section** - Polls with revealed results
4. **Archived Section** - Old nominations (30+ days)

### Weekly Cycle
```
Week 1: Nomination only (collecting top 5 for week 2)
Week 2+: Nomination (for week 3) + Voting (on week 1's top 5)

Timeline:
├─ Monday 00:00 UTC: New week starts
│   ├─ Top 5 nominations promoted to voting
│   ├─ Previous week's votes auto-revealed
│   └─ Users get 5 new selections
├─ Sunday 23:59 UTC: Week ends
    ├─ Voting deadline
    └─ Nomination cutoff
```

---

## User Flow

### 1. Nomination Phase (Database Only - No Blockchain)

**Propose Poll:**
```typescript
1. User fills form: question + 2-4 options
2. POST /api/dao/polls
3. Poll stored in database (section: 'nomination')
4. User gets +5 points
```

**Select Polls:**
```typescript
1. User browses nomination section
2. Clicks "Select" button (max 5 per week)
3. POST /api/dao/selections
4. Database checks: selections < 5 for current week
5. User gets +1 point per selection
6. Can swap selections (deselect + select another)
```

**Sorting Options:**
- Newest (created_at DESC)
- Popular (selection_count DESC) - count hidden from users
- Oldest (created_at ASC)

---

### 2. Promotion to Voting (Automated Cron)

**Every Monday 00:00 UTC:**
```sql
-- Find top 5 nominations from last week
SELECT * FROM dao_polls
WHERE section = 'nomination'
  AND created_at >= last_week_start
  AND created_at < this_week_start
ORDER BY selection_count DESC
LIMIT 5;

-- For each poll:
1. Create on-chain poll (encrypted voting)
2. Update: section='voting', status='voting'
3. Set voting_starts_at=NOW(), voting_ends_at=NOW()+7days
4. Award creator +10 points (poll_selected)
```

---

### 3. Voting Phase (Encrypted On-Chain)

**Vote on Poll:**
```typescript
1. User selects option (1-4)
2. Frontend encrypts vote using Arcium MPC
3. Transaction submitted to blockchain
4. POST /api/dao/voting-records (record participation)
5. User gets +3 points
```

**Vote Encryption (On-Chain):**
```rust
// User votes for option #2
let mut encrypted_votes = vec![0u8; 4];
encrypted_votes[user_choice] = 1; // Homomorphic addition

// Store in PollAccount
poll.vote_state = encrypt(encrypted_votes);
```

---

### 4. Results Reveal (Automated + Manual Fallback)

**Auto-Reveal (Cron - Every Hour):**
```typescript
// Find polls past deadline
const pollsToReveal = await db.query(`
  SELECT * FROM dao_polls
  WHERE section = 'voting'
    AND voting_ends_at < NOW()
    AND status != 'completed'
`);

// Trigger MPC reveal for each
for (const poll of pollsToReveal) {
  const counts = await mpcReveal(poll.on_chain_poll_id);
  // counts = [45, 123, 89, 67]
  
  await db.update('dao_polls', {
    vote_counts: counts,
    total_votes: counts.reduce((a,b) => a+b),
    status: 'completed',
    section: 'completed',
    revealed_at: new Date()
  });
}
```

**Manual Fallback:**
- If auto-reveal fails, any wallet can click "Reveal Results"
- No incentive (no bonus points)
- Same reveal process

---

## Database Architecture

### Core Tables

#### `dao_polls`
```sql
id UUID
question TEXT
options TEXT[] (2-4 items)
creator_wallet TEXT
status TEXT ('nomination', 'voting', 'completed', 'archived')
section TEXT ('nomination', 'voting', 'completed', 'archived')
created_at TIMESTAMP
voting_starts_at TIMESTAMP
voting_ends_at TIMESTAMP
revealed_at TIMESTAMP
archived_at TIMESTAMP
selection_count INTEGER (hidden from users)
on_chain_poll_id INTEGER (null until promoted)
vote_counts INTEGER[] (from MPC reveal)
total_votes INTEGER
```

#### `selections`
```sql
id UUID
poll_id UUID (FK)
wallet TEXT
week_id INTEGER (YYYYWW format)
created_at TIMESTAMP
UNIQUE(poll_id, wallet, week_id)
```

#### `dao_voting_records`
```sql
id UUID
poll_id UUID (FK)
wallet TEXT
tx_signature TEXT
voted_at TIMESTAMP
UNIQUE(poll_id, wallet)
```

### Helper Functions

**`get_current_week_id()`** - Returns YYYYWW (e.g., 202443)

**`check_selection_limit(wallet, week_id)`** - Returns true if user has < 5 selections

**`increment_selection_count()`** - Trigger on INSERT selections

**`decrement_selection_count()`** - Trigger on DELETE selections

---

## API Routes

### Nomination Section

**POST /api/dao/polls**
```typescript
// Create poll proposal
Body: { question, options[], creator_wallet }
Returns: { poll_id, pointsAwarded: 5 }
```

**GET /api/dao/polls?section=nomination&sort=popular**
```typescript
// List polls
Query: section, sort (newest|popular|oldest)
Returns: Poll[]
```

**POST /api/dao/selections**
```typescript
// Select poll
Body: { poll_id, wallet }
Validates: selections < 5 for current week
Returns: { success, pointsAwarded: 1, remainingSelections }
```

**DELETE /api/dao/selections/:id**
```typescript
// Deselect poll
Returns: { success, remainingSelections }
```

**GET /api/dao/selections/me?wallet=**
```typescript
// Get user's selections this week
Returns: Selection[] (max 5)
```

### Voting Section

**GET /api/dao/polls?section=voting**
```typescript
// List current week's voting polls
Returns: Poll[] (max 5)
```

**POST /api/dao/voting-records**
```typescript
// Record vote participation
Body: { poll_id, wallet, tx_signature }
Returns: { success, pointsAwarded: 3 }
```

**POST /api/dao/reveal**
```typescript
// Trigger reveal (auto or manual)
Body: { poll_id }
Returns: { vote_counts, percentages }
```

### Completed Section

**GET /api/dao/polls?section=completed**
```typescript
// List completed polls
Returns: Poll[] with vote_counts
```

---

## MPC Circuit Design

### Current Circuit (Binary YES/NO)
```
Input: [encrypted_yes, encrypted_no]
Output: boolean (yes > no)
Size: 82KB
Speed: 2-5 seconds
```

### New Circuit (Multi-Option)
```rust
// reveal_result_multi.arcis

#[arcium_mpc]
fn reveal_result_multi(
    poll_nonce: u128,
    encrypted_votes: [[u8; 32]; 4] // Max 4 options
) -> [u64; 4] {
    // Decrypt each option's vote count
    let mut counts = [0u64; 4];
    
    for i in 0..4 {
        counts[i] = decrypt_counter(poll_nonce, encrypted_votes[i]);
    }
    
    counts // Return raw counts
}
```

**Output Example:**
```typescript
// MPC returns: [45, 123, 89, 67]
// Total: 324 votes

// Frontend calculates percentages:
const percentages = counts.map(c => 
  ((c / total) * 100).toFixed(1)
);
// ["13.9%", "38.0%", "27.5%", "20.7%"]
```

**Estimated Size:** 100-120KB  
**Estimated Speed:** 2-5 seconds (same as binary)

---

## Cron Jobs

### 1. Weekly Promotion (Mondays 00:00 UTC)
```typescript
// /api/cron/promote-polls

export async function GET() {
  // Find top 5 nominations from last week
  const top5 = await db.query(`
    SELECT * FROM dao_polls
    WHERE section = 'nomination'
      AND created_at >= $1
      AND created_at < $2
    ORDER BY selection_count DESC
    LIMIT 5
  `, [lastWeekStart, thisWeekStart]);
  
  // Create on-chain polls
  for (const poll of top5) {
    const onChainId = await createOnChainPoll(poll);
    
    await db.update('dao_polls', poll.id, {
      on_chain_poll_id: onChainId,
      section: 'voting',
      status: 'voting',
      voting_starts_at: new Date(),
      voting_ends_at: addDays(new Date(), 7)
    });
    
    // Award creator
    await awardPoints(poll.creator_wallet, 10, 'poll_selected');
  }
}
```

### 2. Auto-Reveal (Hourly)
```typescript
// /api/cron/auto-reveal

export async function GET() {
  // Find polls past deadline
  const pollsToReveal = await db.query(`
    SELECT * FROM dao_polls
    WHERE section = 'voting'
      AND voting_ends_at < NOW()
      AND status != 'completed'
  `);
  
  for (const poll of pollsToReveal) {
    try {
      const counts = await triggerMPCReveal(poll.on_chain_poll_id);
      
      await db.update('dao_polls', poll.id, {
        vote_counts: counts,
        total_votes: counts.reduce((a,b) => a+b),
        status: 'completed',
        section: 'completed',
        revealed_at: new Date()
      });
    } catch (error) {
      console.error(`Failed to reveal poll ${poll.id}:`, error);
      // Will retry next hour
    }
  }
}
```

### 3. Archive Old Nominations (Daily 00:00 UTC)
```typescript
// /api/cron/archive-nominations

export async function GET() {
  await db.query(`
    UPDATE dao_polls
    SET status = 'archived',
        section = 'archived',
        archived_at = NOW()
    WHERE section = 'nomination'
      AND status = 'nomination'
      AND created_at < NOW() - INTERVAL '30 days'
  `);
}
```

### Vercel Configuration
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/promote-polls",
      "schedule": "0 0 * * 1" // Mondays 00:00 UTC
    },
    {
      "path": "/api/cron/auto-reveal",
      "schedule": "0 * * * *" // Every hour
    },
    {
      "path": "/api/cron/archive-nominations",
      "schedule": "0 0 * * *" // Daily 00:00 UTC
    }
  ]
}
```

---

## Points System

| Action | Points | Reason |
|--------|--------|--------|
| Propose poll | +5 | `poll_created` |
| Select in nomination | +1 | `selection_made` |
| Vote in voting section | +3 | `dao_vote_cast` |
| Your poll gets selected | +10 | `poll_selected` |
| Reveal results | 0 | No incentive |

### Leaderboard Query
```sql
SELECT 
  m.wallet_address,
  SUM(pt.amount) as total_points,
  RANK() OVER (ORDER BY SUM(pt.amount) DESC) as rank
FROM members m
JOIN point_transactions pt ON m.wallet_address = pt.member_wallet
GROUP BY m.wallet_address
ORDER BY total_points DESC
LIMIT 100;
```

---

## UI Components

### 1. DAO Navigation
```tsx
<DAONavigation>
  <Tab href="/dao/nomination">Nomination</Tab>
  <Tab href="/dao/voting">Voting (5 polls)</Tab>
  <Tab href="/dao/completed">Completed</Tab>
  <Tab href="/dao/archived">Archived</Tab>
  
  <CountdownTimer 
    label="Voting ends in"
    deadline={votingDeadline}
  />
</DAONavigation>
```

### 2. Nomination Section
```tsx
<NominationSection>
  <ProposePollButton /> {/* Opens modal */}
  
  <SortControls>
    <Button>Newest</Button>
    <Button>Popular</Button>
    <Button>Oldest</Button>
  </SortControls>
  
  <PollGrid>
    {polls.map(poll => (
      <NominationCard 
        poll={poll}
        selected={userSelections.includes(poll.id)}
        onSelect={handleSelect}
        onDeselect={handleDeselect}
      />
    ))}
  </PollGrid>
  
  <SelectionStatus>
    Selected: {userSelections.length}/5
  </SelectionStatus>
</NominationSection>
```

### 3. Voting Section
```tsx
<VotingSection>
  <h2>This Week's Featured Polls (Top 5)</h2>
  
  {votingPolls.map(poll => (
    <VotingCard
      poll={poll}
      options={poll.options}
      onVote={handleVote}
      hasVoted={checkIfVoted(poll.id)}
    />
  ))}
  
  <CountdownTimer 
    deadline={votingDeadline}
    onExpire={enableReveal}
  />
</VotingSection>
```

### 4. Completed Section
```tsx
<CompletedSection>
  {completedPolls.map(poll => (
    <ResultsCard
      poll={poll}
      voteCounts={poll.vote_counts}
      percentages={calculatePercentages(poll.vote_counts)}
      totalVotes={poll.total_votes}
      revealedAt={poll.revealed_at}
    />
  ))}
</CompletedSection>
```

---

## Implementation Checklist

### Phase 1: Database (Today)
- [x] Create dao_schema.sql
- [ ] Run migration in Supabase
- [ ] Test helper functions
- [ ] Verify triggers work

### Phase 2: API Routes (Tomorrow)
- [ ] POST /api/dao/polls
- [ ] GET /api/dao/polls
- [ ] POST /api/dao/selections
- [ ] DELETE /api/dao/selections/:id
- [ ] GET /api/dao/selections/me
- [ ] POST /api/dao/voting-records

### Phase 3: MPC Circuit (2 days)
- [ ] Design reveal_result_multi.arcis
- [ ] Test with 2-4 options
- [ ] Deploy circuit to devnet
- [ ] Update Rust program

### Phase 4: Cron Jobs (1 day)
- [ ] /api/cron/promote-polls
- [ ] /api/cron/auto-reveal
- [ ] /api/cron/archive-nominations
- [ ] Configure vercel.json

### Phase 5: UI Components (3 days)
- [ ] DAONavigation
- [ ] NominationSection
- [ ] VotingSection
- [ ] CompletedSection
- [ ] ProposePollModal
- [ ] SelectionManager
- [ ] CountdownTimer
- [ ] ResultsCard

### Phase 6: Testing & Deployment
- [ ] End-to-end testing
- [ ] Deploy new program ID
- [ ] Run database migration
- [ ] Deploy frontend
- [ ] Monitor cron jobs

---

## Next Steps

**Ready to start?**

1. Run database migration (`dao_schema.sql`)
2. Build API routes
3. Design MPC circuit
4. Build UI components

Let me know when to proceed! 🚀
