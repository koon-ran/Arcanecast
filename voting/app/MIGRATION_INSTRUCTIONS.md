# Database Migration Instructions

## Run this migration to add missing columns for DAO functionality

### Steps:

1. **Open Supabase Dashboard**
   - Go to: https://fgyhqvkxgbgahmpcvrpu.supabase.co
   - Navigate to: SQL Editor

2. **Run the migration**
   - Copy the contents of `database-migration.sql`
   - Paste into a new query
   - Click "Run" or press Cmd/Ctrl + Enter

3. **Verify the migration**
   The last query will show all columns in the `dao_polls` table. You should see:
   - `week_id` (integer)
   - `promoted_at` (timestamp)
   - `archived_at` (timestamp)
   - `reveal_tx_signature` (text)

4. **Restart the dev server**
   ```bash
   # Press Ctrl+C in the terminal running npm run dev
   npm run dev
   ```

5. **Test the cron endpoints**
   ```bash
   bash test-cron.sh
   ```

## What this migration does:

- ✅ Adds `week_id` column to `dao_polls` (for weekly cycle tracking)
- ✅ Adds `promoted_at`, `archived_at`, `reveal_tx_signature` columns
- ✅ Updates existing polls with calculated week_id
- ✅ Creates indexes for better query performance
- ✅ Ensures `selections` table has `week_id` column
- ✅ Creates `dao_voting_records` table if missing
- ✅ Creates `user_points` table if missing
- ✅ Creates/updates `add_points()` RPC function

## After migration:

Once complete, you can:
1. Create polls (they'll automatically get current week_id)
2. Test cron endpoints:
   - `bash test-cron.sh promote` - Promotes top 5 to voting
   - `bash test-cron.sh archive` - Archives old polls
   - `bash test-cron.sh reveal` - Reveals completed polls
3. Continue with end-to-end testing
