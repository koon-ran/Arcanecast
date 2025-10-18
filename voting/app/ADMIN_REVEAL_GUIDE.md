# Admin Reveal Button - Testing Guide

## What Was Added

An **Admin Reveal Button** that allows the admin wallet to instantly reveal poll results without waiting for the deadline or cron job.

### Admin Wallet
```
5sQaKhsTc8RvgnNgLCYB2Y44dirFBZxQWKZy7nVomYe4
```

## How It Works

### 1. **Admin Detection**
When you connect with the admin wallet, you'll see:
- 👑 **Admin Mode Active** banner at the top of the Voting section
- 🔓 **"Admin: Reveal Now"** button on each poll (orange/red gradient)

### 2. **Reveal Process**
Click the "Admin: Reveal Now" button:
1. Calls the `/api/cron/auto-reveal` endpoint
2. Auto-reveal processes the poll (calls on-chain reveal)
3. Updates database with vote counts
4. Moves poll to "Completed" section
5. You can view results immediately in the Completed tab

### 3. **UI Features**
- **Admin badge**: Shows you're in admin mode
- **Orange button**: Clearly visible "Admin: Reveal Now" on each poll
- **Loading state**: Shows spinner while revealing
- **Toast notifications**: Success/error feedback
- **Auto-refresh**: Polls list refreshes after 2 seconds

## Usage Instructions

### Step 1: Delete Test Polls (Optional)
If you want to clean up existing test polls:

**Option A: Supabase Dashboard**
```
1. Go to Supabase → Table Editor → dao_polls
2. Delete test polls manually
```

**Option B: SQL Query**
```sql
-- Delete all voting polls
DELETE FROM dao_polls WHERE section = 'voting';

-- Or reset to nomination
UPDATE dao_polls 
SET status = 'nomination', 
    section = 'nomination', 
    deadline = NULL 
WHERE section = 'voting';
```

### Step 2: Test the Reveal Button

1. **Connect with Admin Wallet**
   - Use wallet: `5sQaKhsTc8RvgnNgLCYB2Y44dirFBZxQWKZy7nVomYe4`
   - You'll see the admin badge appear

2. **Create Test Polls** (or use existing)
   - Go to Nomination section
   - Create a few test proposals
   - Select them to get votes

3. **Promote to Voting**
   - Manually trigger: `bash test-cron.sh promote`
   - Or use SQL: 
   ```sql
   UPDATE dao_polls 
   SET status = 'voting', 
       section = 'voting', 
       deadline = NOW() + INTERVAL '7 days'
   WHERE status = 'nomination' 
   ORDER BY selection_count DESC 
   LIMIT 5;
   ```

4. **Vote on Polls** (optional)
   - Test the MPC voting flow
   - Cast votes from different wallets

5. **Reveal Results**
   - Go to Voting tab
   - Click **"Admin: Reveal Now"** on any poll
   - Wait for success message
   - Switch to **Completed** tab to see results

## Testing Scenarios

### Scenario 1: Instant Reveal
```
1. Create poll → Promote → Vote → Admin Reveal → View Results
   Time: ~5 minutes (no waiting!)
```

### Scenario 2: Test Auto-Reveal Cron
```
1. Create poll → Promote → Set deadline to past
2. Run: bash test-cron.sh reveal
3. Check Completed section
```

### Scenario 3: Test Full Weekly Cycle
```
1. Create polls (Mon-Sun)
2. Wait for Monday 00:00 UTC (or trigger promote cron)
3. Vote during week
4. Use admin reveal or wait for auto-reveal
```

## Removing the Admin Button (Later)

When you're ready for production, you can:

### Option 1: Remove Code
Delete these lines from `VotingSection.tsx`:
- Admin wallet constant
- `isAdmin` check
- Admin badge
- Admin reveal button
- `handleAdminReveal` function

### Option 2: Environment Variable Toggle
Replace hardcoded wallet with:
```typescript
const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET;
const isAdmin = connected && ADMIN_WALLET && publicKey?.toString() === ADMIN_WALLET;
```

Then remove `NEXT_PUBLIC_ADMIN_WALLET` from production env vars.

## Troubleshooting

**"Only admin can reveal results"**
- Make sure you're connected with the correct admin wallet
- Check wallet address matches exactly

**"Failed to reveal results"**
- Check browser console for errors
- Verify poll has `onchain_id` set
- Make sure `NEXT_PUBLIC_CRON_SECRET` is set correctly
- Check if `AUTHORITY_KEYPAIR` is set (needed for on-chain reveal)

**Button doesn't appear**
- Disconnect and reconnect wallet
- Refresh the page
- Check browser console for React errors

**Poll doesn't move to Completed**
- Check browser network tab for API errors
- Look at cron endpoint response
- Verify poll `onchain_id` exists
- Check Supabase logs

## Notes

- **AUTHORITY_KEYPAIR still needed**: The auto-reveal endpoint needs this to sign the on-chain reveal transaction
- **No deadline check**: Admin reveal works regardless of deadline
- **Safe for production**: Button only shows for admin wallet
- **Easy to remove**: Simply delete admin-related code when done testing

## Summary

You now have a convenient way to test the entire DAO flow without waiting:
- ✅ Create proposals instantly
- ✅ Promote to voting instantly (cron test)
- ✅ Vote with MPC encryption
- ✅ **Reveal results instantly (admin button)** ← NEW!
- ✅ View results in Completed section

Happy testing! 🎉
