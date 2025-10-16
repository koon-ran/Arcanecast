# Next Steps: Supabase Integration

## ✅ What I've Created For You

1. **`SUPABASE_SETUP.md`** - Complete setup guide with SQL schema
2. **`DATABASE_SCHEMA.md`** - Full database design documentation
3. **`src/lib/supabase.ts`** - Supabase client configuration
4. **`src/app/api/polls/route.ts`** - API for creating/fetching polls
5. **`src/app/api/polls/[id]/vote/route.ts`** - API for recording votes

## 📋 What You Need To Do

### 1. Setup Supabase (15 minutes)

Follow **`SUPABASE_SETUP.md`**:

1. Go to [supabase.com](https://supabase.com) → Create project
2. Get your API keys from Settings → API
3. Create `/voting/app/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Keep existing Solana config
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_PROGRAM_ID=FHuabcvigE645KXLy4KCFCLkLx1jLxi1nwFYs8ajWyYd
```

4. Run the SQL schema in Supabase SQL Editor (copy from `SUPABASE_SETUP.md`)

### 2. Install Supabase Package (1 minute)

```bash
cd /workspaces/Arcanecast/voting/app
npm install @supabase/supabase-js
```

### 3. Update `votingService.ts` (Next - I'll do this)

Once you've completed steps 1-2, let me know and I'll:
- Add `hasVoted()` check before voting
- Add API call to record votes after blockchain transaction
- Add API call to create poll metadata
- Test the complete flow

## 🎯 Expected Flow After Integration

### Creating a Poll:
```
User clicks "Create Poll"
  ↓
Frontend calls votingService.createPoll()
  ↓
Blockchain: Queue poll creation (returns immediately)
  ↓
Database: Store poll metadata + award 5 points
  ↓
Show "Poll created! +5 points" ✅
```

### Casting a Vote:
```
User clicks "Vote YES/NO"
  ↓
Check: GET /api/polls/{id}/vote?wallet={address}
  ↓
If already voted: Show error ❌
  ↓
Blockchain: Queue vote (returns immediately)
  ↓
Database: POST /api/polls/{id}/vote
  ↓
Record vote + award 1 point
  ↓
Show "Vote cast! +1 point" ✅
```

### Viewing Polls:
```
User opens app
  ↓
GET /api/polls?status=active
  ↓
Show list with metadata (descriptions, dates, vote counts)
  ↓
User clicks poll → Show details + "You haven't voted yet" or "You voted on {date}"
```

## 🧪 Testing Plan

After integration, we'll test:

1. **Create poll** → Verify in Supabase Table Editor
2. **Vote from Wallet A** → Check vote_records table
3. **Try voting again** → Should be blocked
4. **Vote from Wallet B** → Should work
5. **Check points** → Verify members table shows correct points
6. **Check point_transactions** → Verify audit trail

## 📦 Files You'll Commit

After setup is complete:
- ✅ `src/lib/supabase.ts`
- ✅ `src/app/api/polls/route.ts`
- ✅ `src/app/api/polls/[id]/vote/route.ts`
- ✅ `DATABASE_SCHEMA.md`
- ✅ `SUPABASE_SETUP.md`
- ❌ `.env.local` (DO NOT COMMIT - in .gitignore)

## 🚀 Ready?

**Let me know when you've:**
1. ✅ Created Supabase project
2. ✅ Added keys to `.env.local`
3. ✅ Run the SQL schema
4. ✅ Installed `@supabase/supabase-js`

**Then I'll:**
1. Update `votingService.ts` with database integration
2. Test the complete flow
3. Fix any issues
4. Move on to building the 4 VeiledCasts sections!

---

## ⏱️ Time Estimate

- Supabase setup: **15 min**
- Install package: **1 min**
- Integration code (me): **20 min**
- Testing: **15 min**

**Total: ~50 minutes to full database integration**

---

## 🆘 If You Run Into Issues

Common problems:
- **"Module not found: @supabase/supabase-js"** → Run `npm install` again
- **"Database not configured"** → Check `.env.local` has all 3 keys
- **"Foreign key constraint fails"** → Run SQL in correct order (members first)
- **API returns 500** → Check Next.js console for detailed error

Just share the error and I'll help fix it!
