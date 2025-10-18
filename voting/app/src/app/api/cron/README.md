# DAO Cron Jobs

This directory contains automated cron jobs that manage the weekly DAO voting cycle.

## Overview

The DAO voting system operates on a weekly cycle with three automated jobs:

1. **promote-polls** - Promotes top nominated polls to voting
2. **auto-reveal** - Reveals completed poll results
3. **archive-nominations** - Cleans up old nominations

## Cron Jobs

### 1. Promote Polls (`/api/cron/promote-polls`)

**Schedule:** Every Monday at 00:00 UTC  
**Cron Expression:** `0 0 * * 1`

**What it does:**
- Fetches top 5 nominated polls by `selection_count` for the current week
- Promotes them to the voting section
- Sets a 7-day deadline (expires next Monday)
- Awards 10 bonus points to poll creators

**Flow:**
```
1. Calculate current week_id (ISO week number)
2. Query top 5 polls: status='nomination', order by selection_count DESC
3. Update polls: status='voting', section='voting', deadline=+7 days
4. Award 10 points to each creator via add_points RPC
5. Log promotion summary
```

**Example Response:**
```json
{
  "success": true,
  "weekId": 42,
  "promoted": 5,
  "polls": [
    {
      "id": "uuid",
      "question": "Should we...",
      "selections": 23,
      "creator": "wallet_address"
    }
  ],
  "pointsAwarded": {
    "wallet1": 10,
    "wallet2": 20
  },
  "deadline": "2025-10-24T00:00:00Z"
}
```

### 2. Auto-Reveal (`/api/cron/auto-reveal`)

**Schedule:** Every hour  
**Cron Expression:** `0 * * * *`

**What it does:**
- Finds voting polls past their deadline but not yet revealed
- Calls `revealMultiOptionResult` on-chain for each poll
- Parses the `RevealMultiOptionResultEvent` to get vote counts
- Updates database with results and marks as completed

**Flow:**
```
1. Query polls: status='voting', deadline < NOW, revealed_at IS NULL
2. For each poll:
   a. Derive poll PDA
   b. Call program.methods.revealMultiOptionResult()
   c. Wait for transaction confirmation
   d. Parse event logs to extract vote_counts
   e. Update database: vote_counts=[...], revealed_at=NOW, status='completed'
3. Return summary of revealed polls
```

**Requirements:**
- `AUTHORITY_KEYPAIR` must be set in environment variables
- Authority wallet must have SOL for transaction fees
- On-chain poll must exist (onchain_id not null)

**Example Response:**
```json
{
  "success": true,
  "revealed": 3,
  "polls": [
    {
      "id": "uuid",
      "question": "Should we...",
      "voteCounts": [45, 23, 12, 8],
      "txSignature": "5x..."
    }
  ],
  "errors": []
}
```

### 3. Archive Nominations (`/api/cron/archive-nominations`)

**Schedule:** Daily at 02:00 UTC  
**Cron Expression:** `0 2 * * *`

**What it does:**
- Archives nomination polls older than 30 days
- Cleans up associated selections
- Keeps database tidy by removing stale data

**Flow:**
```
1. Calculate cutoff date: NOW - 30 days
2. Query polls: status='nomination', created_at < cutoff
3. Update polls: status='archived', section='archived', archived_at=NOW
4. Delete selections for archived polls
5. Return summary of archived polls
```

**Example Response:**
```json
{
  "success": true,
  "archived": 12,
  "polls": [
    {
      "id": "uuid",
      "question": "Should we...",
      "created_at": "2025-09-01T10:30:00Z",
      "selections": 3
    }
  ],
  "cutoffDate": "2025-09-17T02:00:00Z"
}
```

## Security

All cron endpoints require authentication via the `CRON_SECRET` environment variable:

```typescript
const authHeader = request.headers.get('authorization');
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

When deploying to Vercel, this secret is automatically included in cron job requests.

## Environment Variables

Required for cron jobs to function:

```bash
# Cron authentication
CRON_SECRET=your_random_secret

# Supabase access
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# For auto-reveal only
AUTHORITY_KEYPAIR=[1,2,3,...] # or base58 string
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_VOTING_PROGRAM_ID=your_program_id
```

## Testing Locally

You can test cron endpoints manually:

```bash
# Promote polls
curl -X GET http://localhost:3000/api/cron/promote-polls \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Auto-reveal
curl -X GET http://localhost:3000/api/cron/auto-reveal \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Archive nominations
curl -X GET http://localhost:3000/api/cron/archive-nominations \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Deployment

The cron jobs are configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/promote-polls",
      "schedule": "0 0 * * 1"
    },
    {
      "path": "/api/cron/auto-reveal",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/archive-nominations",
      "schedule": "0 2 * * *"
    }
  ]
}
```

After deploying to Vercel, cron jobs will run automatically. You can monitor them in:
- **Vercel Dashboard** → Your Project → Cron Jobs
- Check logs for execution history and errors

## Monitoring

Check cron job logs in your deployment:

```bash
vercel logs --follow
```

Look for log entries starting with `[CRON]`:
```
[CRON] Starting promote-polls job...
[CRON] Current week: 42
[CRON] Found 5 polls to promote
[CRON] Promoted 5 polls to voting
[CRON] Promotion complete
```

## Troubleshooting

**Promote-polls not finding polls:**
- Check that polls have `status='nomination'` and correct `week_id`
- Verify `selection_count` is greater than 0

**Auto-reveal failing:**
- Ensure `AUTHORITY_KEYPAIR` is correctly formatted
- Check authority wallet has SOL for transaction fees
- Verify `onchain_id` is not null for voting polls
- Check Solana RPC is accessible

**Archive-nominations not running:**
- Verify cron secret is correct
- Check that polls are actually older than 30 days
- Review Vercel cron logs for errors

## Weekly Cycle Timeline

```
Monday 00:00 UTC    → promote-polls runs
                      Top 5 nominations → Voting section
                      Voting period starts (7 days)

During week         → auto-reveal runs hourly
                      No polls to reveal yet

Next Monday 00:00   → Voting deadline passes
Next Monday 01:00   → auto-reveal runs
                      Results revealed and displayed

Daily 02:00 UTC     → archive-nominations runs
                      Old nominations (30+ days) archived
```

## Notes

- Cron jobs use service role key for elevated Supabase access
- All times are in UTC
- Vercel cron has a 10-second timeout per job
- For long-running reveals, consider breaking into smaller batches
