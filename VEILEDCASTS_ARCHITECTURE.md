# VeiledCasts.xyz - Technical Architecture Analysis

## Vision Summary
A community-powered app with 4 sections:
1. **Community Recognizer** - Vote on whether you recognize members (YES/NO)
2. **General Polls** - 5 featured weekly polls (YES/NO or multi-choice)
3. **Poll Nominations** - Propose and vote on poll ideas (YES/NO votes)
4. **Community Awards** - Ranked choice voting (1st/2nd/3rd place)

**Unified by:** Point system, encrypted voting, weekly cycles, leaderboards

---

## 🔍 Feature Requirements Analysis

### Section 1: Community Recognizer
**Technical Needs:**
- ✅ **Simple YES/NO voting** (current circuit works!)
- ✅ **Multiple concurrent polls** (one per member featured)
- ⚠️ **Member metadata** (pfp, discord/twitter ID) → Database needed
- ⚠️ **"Recognize count"** tracking → Need to store per-member stats
- ⚠️ **Point tracking** (+1 per vote, +2 per recognition)

**Current Implementation Gap:**
- ✅ Voting works
- ❌ No member profiles/metadata storage
- ❌ No point system
- ❌ No recognition counter

---

### Section 2: General Polls (5 per week)
**Technical Needs:**
- ✅ **YES/NO or multi-choice** 
- ⚠️ **Multi-choice** requires new circuit OR hybrid approach
- ⚠️ **Poll curation** (selecting 5 from nominations) → Admin functionality
- ⚠️ **Weekly schedule** (polls active Mon-Sun, reveal Sunday night)
- ⚠️ **"Featured" status** → Database needed
- ⚠️ **Point tracking** (+1 per vote, +5 for creator, +2 bonus for most popular)

**Current Implementation Gap:**
- ✅ Basic voting works
- ❌ No multi-choice (if needed)
- ❌ No admin curation system
- ❌ No scheduling/time-based reveals
- ❌ No featured status

---

### Section 3: Poll Nominations
**Technical Needs:**
- ✅ **Simple YES/NO voting** (vote to approve nomination)
- ⚠️ **Poll proposal submission** → Database needed
- ⚠️ **Nomination status** (pending → voting → approved/rejected)
- ⚠️ **Top 5 selection logic** → Backend needed
- ⚠️ **Point tracking** (+2 per suggestion, +10 if selected)

**Current Implementation Gap:**
- ✅ Voting mechanism works
- ❌ No proposal submission system
- ❌ No status workflow
- ❌ No selection logic

---

### Section 4: Community Awards (Veiled Awards)
**Technical Needs:**
- ❌ **Ranked choice voting** (1st/2nd/3rd) → **NEW CIRCUIT REQUIRED**
- ⚠️ **Self-nomination system** → Database needed
- ⚠️ **Multiple categories** (Most Active, Best Meme, etc.)
- ⚠️ **Weighted scoring** (10/6/3 points for ranks)
- ⚠️ **Top 3 results** per category
- ⚠️ **Point tracking** (+1 per vote, +10/5/3 for winners)

**Current Implementation Gap:**
- ❌ No ranked choice circuit (most complex requirement!)
- ❌ No category system
- ❌ No nomination system
- ❌ No weighted scoring

---

## 🧩 What Your Current Implementation Provides

| Feature | Status | Notes |
|---------|--------|-------|
| **Simple YES/NO voting** | ✅ Working | Perfect for Recognizer & Nominations |
| **Encrypted votes** | ✅ Working | MPC computation functional |
| **Results reveal** | ✅ Working | Shows YES > NO comparison |
| **Multi-user voting** | ❌ Broken | PDA includes creator wallet |
| **Poll discovery** | ❌ Missing | Can't list all polls |
| **Metadata storage** | ❌ Missing | No place for pfps, IDs, descriptions |
| **Point system** | ❌ Missing | No tracking at all |
| **Multi-choice voting** | ❌ Missing | Only YES/NO |
| **Ranked choice voting** | ❌ Missing | Completely new circuit needed |
| **Scheduling** | ❌ Missing | No time-based features |
| **Admin tools** | ❌ Missing | No curation/moderation |

---

## 🚧 Critical Blockers

### 1. **Poll Visibility Bug** 🔴 CRITICAL
**Problem:** Other wallets can't see/vote on polls
**Impact:** Breaks Sections 1, 2, and 3 entirely
**Fix:** Redeploy with PDA seeds = `["poll", poll_id]` (remove authority)
**Priority:** **MUST FIX FIRST**

### 2. **No Backend/Database** 🟠 CRITICAL
**Problem:** No place to store:
- Member profiles (pfps, IDs)
- Poll metadata (descriptions, categories)
- Point balances
- Leaderboards
- Nomination status

**Impact:** Can't build 90% of your features
**Fix:** Add PostgreSQL + API (I showed you the hybrid storage approach)
**Priority:** **REQUIRED**

### 3. **No Multi-Choice/Ranked Voting** 🟡 HIGH
**Problem:** Only YES/NO voting exists
**Impact:** 
- Section 2: May need multi-choice for some polls
- Section 4: **Cannot work at all** without ranked choice
**Fix:** New circuits or hybrid approach
**Priority:** **HIGH** (especially for Awards)

---

## 🎯 Recommended Implementation Path

### Phase 1: Fix Foundation (Week 1-2) 🔴
**Goal:** Make basic voting work for multiple users

1. **Fix poll visibility**
   - Change PDA derivation (remove authority)
   - Redeploy program
   - Update frontend
   - ✅ **Enables:** Multi-user voting

2. **Add backend + database**
   - Set up PostgreSQL
   - Create API endpoints
   - Implement hybrid storage
   - ✅ **Enables:** Metadata, points, leaderboards

3. **Add poll discovery**
   - List all active polls
   - Filter by category/section
   - ✅ **Enables:** Browse polls, feature curation

**Deliverable:** Basic voting app where users can see and vote on each other's polls

---

### Phase 2: Build Core Features (Week 3-4) 🟠
**Goal:** Implement Sections 1, 2, 3

4. **Community Recognizer**
   - Member profile system
   - Auto-create polls for featured members
   - Track recognition counts
   - Point awards (+1 vote, +2 recognition)
   - ✅ **Uses:** Current YES/NO circuit

5. **General Polls**
   - Featured status flag
   - Weekly scheduling (cron jobs)
   - Auto-reveal on Sunday
   - Point awards (+1 vote, +5 featured, +2 popular)
   - ✅ **Uses:** Current YES/NO circuit (start simple)

6. **Poll Nominations**
   - Proposal submission form
   - Voting on nominations
   - Top 5 selection algorithm
   - Admin approval workflow
   - Point awards (+2 suggest, +10 selected)
   - ✅ **Uses:** Current YES/NO circuit

**Deliverable:** 3 of 4 sections working, basic point system

---

### Phase 3: Advanced Features (Week 5-6) 🟡
**Goal:** Add ranked choice voting for Awards

7. **Design ranked choice circuit**
   ```typescript
   // New circuit needed
   export function vote_ranked(
     nominee1: SecretInput,  // 1st choice
     nominee2: SecretInput,  // 2nd choice  
     nominee3: SecretInput,  // 3rd choice
     voteState: MutableSecretInput  // Array of scores per nominee
   ): void {
     voteState[nominee1] += 10;
     voteState[nominee2] += 6;
     voteState[nominee3] += 3;
   }
   ```

8. **Build & test circuit**
   - Write circuit code
   - Test with `arcium build`
   - Upload to GitHub
   - Deploy new comp def

9. **Community Awards**
   - Category system
   - Self-nomination
   - Ranked voting UI
   - Top 3 reveal per category
   - Point awards (+1 vote, +10/5/3 winners)
   - ✅ **Uses:** New ranked choice circuit

**Deliverable:** All 4 sections working

---

### Phase 4: Polish (Week 7-8) 🟢
**Goal:** Leaderboards, gamification, UX

10. **Point system dashboard**
    - Weekly leaderboard (resets)
    - Lifetime totals
    - Badges/achievements
    - Point history

11. **Admin panel**
    - Feature members for Recognizer
    - Curate polls for General Polls
    - Manage award categories
    - Moderate nominations

12. **UX improvements**
    - Real-time updates
    - Notifications
    - Mobile responsive
    - Animations

**Deliverable:** Production-ready dapp

---

## 📊 Technology Stack Recommendation

### Current Stack
- ✅ Solana + Anchor
- ✅ Arcium MPC
- ✅ React + Next.js
- ✅ TypeScript

### What You MUST Add
- 🔴 **PostgreSQL** (database)
- 🔴 **Node.js API** (backend)
- 🟠 **Redis** (caching, leaderboards)
- 🟡 **Cron jobs** (weekly scheduling)

### Optional But Recommended
- 🟢 **Prisma** (type-safe DB queries)
- 🟢 **tRPC** (type-safe API)
- 🟢 **Supabase** (hosted Postgres + Auth)
- 🟢 **Vercel** (hosting)

---

## 🎨 Database Schema (Essential)

```sql
-- Users/Members
CREATE TABLE members (
  wallet_address VARCHAR(255) PRIMARY KEY,
  discord_id VARCHAR(255),
  twitter_id VARCHAR(255),
  pfp_url TEXT,
  bio TEXT,
  points_weekly INTEGER DEFAULT 0,
  points_lifetime INTEGER DEFAULT 0,
  recognition_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Polls (all types)
CREATE TABLE polls (
  id VARCHAR(255) PRIMARY KEY,
  creator_wallet VARCHAR(255) REFERENCES members(wallet_address),
  section VARCHAR(50), -- 'recognizer' | 'general' | 'nomination' | 'awards'
  category VARCHAR(100), -- For awards: 'Most Active', 'Best Meme', etc.
  question TEXT NOT NULL,
  status VARCHAR(20), -- 'active' | 'revealed' | 'closed'
  featured BOOLEAN DEFAULT false,
  nomination_votes INTEGER DEFAULT 0,
  tx_signature VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  reveal_at TIMESTAMP,
  INDEX idx_section (section),
  INDEX idx_status (status),
  INDEX idx_featured (featured)
);

-- Vote participation (NOT the actual vote!)
CREATE TABLE vote_records (
  id SERIAL PRIMARY KEY,
  poll_id VARCHAR(255) REFERENCES polls(id),
  voter_wallet VARCHAR(255) REFERENCES members(wallet_address),
  voted_at TIMESTAMP DEFAULT NOW(),
  tx_signature VARCHAR(255),
  UNIQUE(poll_id, voter_wallet)
);

-- Poll nominations (Section 3)
CREATE TABLE nominations (
  id SERIAL PRIMARY KEY,
  proposer_wallet VARCHAR(255) REFERENCES members(wallet_address),
  question TEXT NOT NULL,
  description TEXT,
  status VARCHAR(20), -- 'pending' | 'voting' | 'approved' | 'rejected'
  approval_votes INTEGER DEFAULT 0,
  poll_id VARCHAR(255) REFERENCES polls(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Award nominations (Section 4)
CREATE TABLE award_nominations (
  id SERIAL PRIMARY KEY,
  award_category VARCHAR(100),
  nominee_wallet VARCHAR(255) REFERENCES members(wallet_address),
  self_description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(award_category, nominee_wallet)
);

-- Point transactions (audit log)
CREATE TABLE point_transactions (
  id SERIAL PRIMARY KEY,
  wallet VARCHAR(255) REFERENCES members(wallet_address),
  amount INTEGER NOT NULL,
  reason VARCHAR(255),
  poll_id VARCHAR(255) REFERENCES polls(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Leaderboards (cached)
CREATE TABLE leaderboard_weekly (
  wallet VARCHAR(255) REFERENCES members(wallet_address),
  points INTEGER,
  rank INTEGER,
  week_start DATE,
  PRIMARY KEY (wallet, week_start)
);
```

---

## 🔮 Circuit Requirements Summary

| Section | Circuit Type | Status | Complexity |
|---------|-------------|--------|------------|
| **Recognizer** | YES/NO | ✅ Exists | Simple |
| **General Polls** | YES/NO or Multi-choice | ⚠️ Multi-choice missing | Medium |
| **Nominations** | YES/NO | ✅ Exists | Simple |
| **Awards** | Ranked choice (1st/2nd/3rd) | ❌ Missing | **Complex** |

### New Circuit Needed: Ranked Choice Voting

```typescript
// awards_vote.arc (pseudocode)
pub struct AwardVote {
    first_choice: u8,   // Nominee index (0-9)
    second_choice: u8,
    third_choice: u8,
}

pub struct AwardScores {
    scores: [u64; 10],  // Up to 10 nominees per category
}

pub fn vote_ranked(
    vote: Enc<Shared, AwardVote>,
    scores: Enc<Mxe, AwardScores>
) -> Enc<Mxe, AwardScores> {
    let v = vote.to_arcis();
    let mut s = scores.to_arcis();
    
    s.scores[v.first_choice] += 10;
    s.scores[v.second_choice] += 6;
    s.scores[v.third_choice] += 3;
    
    scores.owner.from_arcis(s)
}

pub fn reveal_top3(
    scores: Enc<Mxe, AwardScores>
) -> [u8; 3] {
    let s = scores.to_arcis();
    // Return indices of top 3 highest scores
    get_top_three_indices(s.scores)
}
```

---

## 💡 Key Insights

### What Works NOW With Your Current Code:
1. ✅ **Community Recognizer** (after fixing visibility)
   - Simple YES/NO recognition votes
   - Just need database for member profiles

2. ✅ **Poll Nominations** (after fixing visibility)
   - Vote YES/NO on proposed poll ideas
   - Just need database for proposal workflow

3. ⚠️ **General Polls** (after fixing visibility)
   - Can do YES/NO questions
   - Need database for curation/featured status
   - Multi-choice is optional (can start without it)

### What CANNOT Work Without Major Changes:
4. ❌ **Community Awards**
   - Requires ranked choice circuit (doesn't exist)
   - 1-2 weeks to design, build, test, deploy
   - Most complex feature

---

## 🎯 My Honest Recommendation

### Start With MVP (Minimum Viable Product)

**Phase 1: Fix + Database (THIS WEEK)**
1. Fix poll visibility bug (redeploy)
2. Set up PostgreSQL + API
3. Implement hybrid storage

**Phase 2: Build 3 of 4 Sections (NEXT 2 WEEKS)**
4. Community Recognizer (YES/NO)
5. Poll Nominations (YES/NO)
6. General Polls (YES/NO only, no multi-choice)
7. Point system + weekly leaderboard

**Phase 3: Add Awards Later (WEEK 4-5)**
8. Design ranked choice circuit
9. Test and deploy
10. Build Awards section

**Why This Order?**
- ✅ Sections 1-3 can use your existing circuit (faster)
- ✅ 75% of features working in 2-3 weeks
- ✅ Validates concept before investing in complex circuit
- ✅ Community can start using it while you build Awards

---

## 🚀 Next Steps

**Immediate Priority:**
1. **Fix poll visibility** (1 day)
   - Remove authority from PDA
   - Redeploy
   
2. **Set up database** (2-3 days)
   - I can help you set up Supabase (easiest)
   - Or PostgreSQL on your server
   
3. **Implement hybrid storage** (2 days)
   - Use the `PollDatabaseService` I showed you
   - Store metadata, points, etc.

**Then:** Start building features in order above.

---

## ❓ Questions for You

1. **Timeline?** When do you want to launch?
2. **Backend hosting?** Do you have a server, or should we use Supabase/Vercel?
3. **Multi-choice?** Do General Polls really need multi-choice, or can they start YES/NO?
4. **Admin role?** Who curates the featured polls? You? DAO vote?
5. **Awards priority?** Can Awards wait for Phase 3, or is it critical for launch?

Let me know and I'll help you implement this properly! 🎉
