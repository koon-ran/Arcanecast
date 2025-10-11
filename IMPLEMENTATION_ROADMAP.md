# VeiledCasts.xyz - Implementation Roadmap

## 🎯 Your Goal vs Current Reality

```
┌─────────────────────────────────────────────────────────────┐
│                  YOUR VISION                                │
├─────────────────────────────────────────────────────────────┤
│  1. Community Recognizer    (member profiles + YES/NO)     │
│  2. General Polls           (5 weekly featured)             │
│  3. Poll Nominations        (community-driven)              │
│  4. Community Awards        (ranked choice voting)          │
│  + Point system across all  (leaderboards, gamification)    │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↓ ↓
┌─────────────────────────────────────────────────────────────┐
│              WHAT YOU HAVE NOW                              │
├─────────────────────────────────────────────────────────────┤
│  ✅ Simple YES/NO voting circuit (works)                    │
│  ✅ Encrypted MPC computation (works)                       │
│  ✅ Basic poll creation UI (works)                          │
│  ❌ Polls only visible to creator (BROKEN)                  │
│  ❌ No database (no metadata, no points)                    │
│  ❌ No multi-choice voting                                  │
│  ❌ No ranked choice voting                                 │
│  ❌ No scheduling/curation                                  │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Feature Compatibility Matrix

| Feature | Current YES/NO Circuit | Needs Multi-Choice | Needs Ranked Choice | Needs Database |
|---------|----------------------|-------------------|-------------------|---------------|
| **Community Recognizer** | ✅ YES | ❌ No | ❌ No | ✅ YES (profiles) |
| **General Polls (YES/NO)** | ✅ YES | ❌ No | ❌ No | ✅ YES (curation) |
| **General Polls (Multi)** | ❌ No | ✅ YES | ❌ No | ✅ YES (curation) |
| **Poll Nominations** | ✅ YES | ❌ No | ❌ No | ✅ YES (workflow) |
| **Community Awards** | ❌ No | ❌ No | ✅ YES | ✅ YES (categories) |
| **Point System** | N/A | N/A | N/A | ✅ YES (tracking) |
| **Leaderboards** | N/A | N/A | N/A | ✅ YES (rankings) |

**Translation:**
- ✅ **Can build TODAY** (after fixing visibility): Recognizer, Nominations, Basic General Polls
- ⚠️ **Need new circuit**: Multi-choice (medium work), Awards (hard work)
- 🔴 **MUST ADD**: Database (critical for everything)

---

## 🛤️ Implementation Paths

### Path A: Fast Launch (Recommended)
**Timeline: 3-4 weeks to MVP**

```
Week 1: Foundation
├─ Fix poll visibility bug
├─ Deploy database (Supabase)
└─ Set up API routes

Week 2: Core Features (Sections 1-3)
├─ Community Recognizer (YES/NO only)
├─ Poll Nominations (YES/NO approval)
├─ General Polls (YES/NO only)
└─ Basic point system

Week 3: Polish
├─ Weekly leaderboard
├─ Member profiles
├─ Admin curation tools
└─ UI improvements

Week 4: Awards (Simple Version)
├─ Design ranked choice circuit
├─ Test and deploy
└─ Build Awards section

✅ LAUNCH with 4 sections working!
```

### Path B: Perfect Before Launch
**Timeline: 6-8 weeks to full vision**

```
Week 1-2: Foundation + Advanced Circuits
├─ Fix poll visibility
├─ Deploy database
├─ Design multi-choice circuit
└─ Design ranked choice circuit

Week 3-4: Build + Test Circuits
├─ Build multi-choice
├─ Build ranked choice
├─ Test both circuits
└─ Deploy both comp defs

Week 5-6: Build All Features
├─ All 4 sections
├─ Point system
├─ Leaderboards
└─ Admin tools

Week 7-8: Polish + Test
└─ End-to-end testing

✅ LAUNCH with everything perfect
```

---

## 🔥 Critical Decision Points

### Decision 1: Multi-Choice for General Polls?

**Option A: Start with YES/NO only**
- ✅ Fast (use existing circuit)
- ✅ Launch in 2-3 weeks
- ⚠️ Some polls might feel limited
- Example: "Should we add dark mode?" (YES/NO)

**Option B: Add multi-choice**
- ⚠️ Slower (2 weeks for circuit)
- ✅ More flexible polls
- ✅ Better UX
- Example: "Which color theme?" (Dark/Light/Auto/Colorful)

**My Recommendation:** Start with YES/NO, add multi-choice in v2 if needed.

---

### Decision 2: Awards Circuit Complexity

**Option A: Simple Ranked (3 choices)**
```typescript
// User votes for 3 nominees, weighted 10/6/3
vote_ranked(first, second, third, scores) {
  scores[first] += 10;
  scores[second] += 6;
  scores[third] += 3;
}
```
- ✅ Simpler circuit (1 week to build)
- ✅ Matches your vision exactly
- ⚠️ Limited to top 3

**Option B: Full Ranked (order all nominees)**
```typescript
// User ranks all nominees 1-10
vote_ranked(ranking[10], scores) {
  for (i in 0..10) {
    scores[ranking[i]] += (10 - i);
  }
}
```
- ⚠️ Complex circuit (2-3 weeks)
- ✅ More sophisticated voting
- ❌ Overkill for your use case

**My Recommendation:** Option A (simple ranked, 3 choices)

---

### Decision 3: Database Hosting

**Option A: Supabase (Recommended)**
- ✅ Free tier (generous)
- ✅ Hosted Postgres + Auth
- ✅ Auto-generated API
- ✅ Real-time subscriptions
- ✅ Easy to set up (10 minutes)
- Example: `https://supabase.com`

**Option B: Self-hosted Postgres**
- ✅ Full control
- ⚠️ Need to manage server
- ⚠️ More setup time
- $ Hosting costs

**Option C: Vercel Postgres**
- ✅ Integrates with Next.js
- ✅ Serverless (pay per query)
- ⚠️ Free tier is small

**My Recommendation:** Supabase for MVP, migrate later if needed.

---

## 📋 Step-by-Step: Next 24 Hours

### Hour 1-2: Fix Poll Visibility

```bash
# 1. Update Rust program
# programs/voting/src/lib.rs
# Change all poll PDA seeds from:
seeds = [b"poll", payer.key().as_ref(), id.to_le_bytes().as_ref()]
# To:
seeds = [b"poll", id.to_le_bytes().as_ref()]

# 2. Update frontend helper
# app/src/utils/helpers.ts
export function derivePollPDA(pollId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("poll"),
      new BN(pollId).toArrayLike(Buffer, "le", 4),
    ],
    VOTING_PROGRAM_ID
  );
}

# 3. Generate new program keypair
solana-keygen new -o new-voting-program.json

# 4. Rebuild and deploy
arcium build
arcium deploy --keypair new-voting-program.json --network devnet

# 5. Update all config files with new program ID
```

### Hour 3-4: Set Up Database

```bash
# Option 1: Supabase (easiest)
# 1. Go to https://supabase.com
# 2. Create new project
# 3. Copy connection string
# 4. Run SQL to create tables (I'll provide schema)

# Option 2: Local Postgres
docker run -d \
  --name veiledcasts-db \
  -e POSTGRES_PASSWORD=secret \
  -e POSTGRES_DB=veiledcasts \
  -p 5432:5432 \
  postgres:15
```

### Hour 5-8: Implement Hybrid Storage

```bash
# 1. Install dependencies
cd app
npm install @supabase/supabase-js

# 2. Create database service (I'll help)
# 3. Update votingService to use database
# 4. Test poll creation + voting with metadata
```

**After 8 hours:** You'll have:
- ✅ Multi-user voting working
- ✅ Database storing metadata
- ✅ Foundation for all features

---

## 💰 Cost Estimate

| Service | Cost | Notes |
|---------|------|-------|
| **Solana Devnet** | Free | Testing |
| **Solana Mainnet** | ~$5-10/month | Transaction fees |
| **Arcium MPC** | Free (devnet) | Check mainnet pricing |
| **Supabase** | Free | Up to 500MB DB, 2GB bandwidth |
| **Vercel Hosting** | Free | Frontend hosting |
| **Domain** | $12/year | veiledcasts.xyz |

**Total for MVP: ~$0-5/month** (mainnet optional)

---

## 🎯 My Strong Recommendation

### Do This Now:

1. **Fix poll visibility** (1 day)
2. **Set up Supabase** (1 day)  
3. **Build Sections 1-3** (1-2 weeks)
   - All using YES/NO circuit
   - Store metadata in database
   - Implement point system

### Launch MVP (3 weeks total)
- ✅ Community Recognizer
- ✅ General Polls (YES/NO)
- ✅ Poll Nominations
- ✅ Points + Weekly Leaderboard
- ⏳ Awards coming soon

### Add Later (v1.1 - Week 4-5)
- Community Awards (ranked choice circuit)
- Multi-choice for General Polls (if needed)

### Why?
- ✅ Get feedback early
- ✅ Validate concept with 75% of features
- ✅ Build community before Awards launch
- ✅ Less risk (shorter dev time)

---

## ❓ Questions?

**Want me to:**
1. Help fix the poll visibility bug right now?
2. Set up Supabase and create the database schema?
3. Build the hybrid storage service?
4. Design the ranked choice circuit for Awards?

**Or tell me:**
- Your timeline (launch date goal?)
- Backend preference (Supabase vs self-hosted?)
- Feature priority (which section MUST be ready first?)

I'm ready to help you build this! 🚀
