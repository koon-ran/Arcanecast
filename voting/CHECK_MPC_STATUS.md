# How to Check if MPC Computations Are Working

## The Problem

MPC computations on Arcium devnet can be slow or fail silently. You might not see results because:

1. **MPC network is slow** - Can take minutes or even timeout
2. **Circuit files not loaded** - Arcium nodes need to download from GitHub
3. **Devnet instability** - Devnet cluster can be unreliable
4. **No feedback** - MPC fails silently without clear errors

## How to Verify MPC Status

### 1. Check Poll Account State

After creating a poll, the `vote_state` should change from all zeros to encrypted ciphertexts.

**Before MPC completes:**
```
vote_state: [[0,0,0,...,0], [0,0,0,...,0]]  // Two arrays of 32 zeros
```

**After MPC completes:**
```
vote_state: [[234,12,89,...], [156,234,78,...]]  // Non-zero encrypted data
```

### 2. Use Solana Explorer

1. Get your poll PDA address (shown in console after creation)
2. Go to: https://explorer.solana.com/address/YOUR_POLL_PDA?cluster=devnet
3. Click "Account Data"
4. Look at the raw bytes - `vote_state` starts at byte offset ~100

### 3. Check Arcium Logs (If Available)

Arcium MPC nodes log computation progress, but these aren't publicly accessible on devnet.

## Common Issues & Solutions

### Issue 1: Vote State Stays All Zeros

**Symptom:** Poll created but `vote_state` never updates

**Causes:**
- MPC network didn't pick up the computation
- Circuit file download failed
- Computation definition not properly initialized

**Solution:**
```bash
# Re-initialize computation definitions
cd /workspaces/Arcanecast/voting
anchor test --skip-build --skip-deploy --provider.cluster devnet
```

### Issue 2: "Computation Not Found" Errors

**Symptom:** Voting fails with "computation not found" or similar

**Cause:** MPC computation didn't complete before vote was attempted

**Solution:**
- Wait longer after poll creation (30-60 seconds)
- Poll the account until `vote_state` is non-zero
- Or remove the check and let MPC process asynchronously

### Issue 3: GitHub URLs Not Accessible

**Symptom:** MPC can't download circuits

**Test:**
```bash
curl -I https://raw.githubusercontent.com/koon-ran/Arcanecast/main/voting/build/vote_testnet.arcis
```

Should return `HTTP/2 200`

**Solution if 404:**
- Push circuits to GitHub: `git add voting/build/*.arcis && git commit && git push`
- Make repo public (Arcium nodes need access)
- Or use different hosting (IPFS, S3, etc.)

### Issue 4: Timeouts

**Symptom:** `awaitComputationFinalization` times out

**Cause:** MPC is slow or stuck

**Solution (Arcanehands Pattern):**
```typescript
// Don't wait for finalization - use short timeout and ignore errors
try {
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('timeout')), 3000)
  );
  await Promise.race([
    awaitComputationFinalization(...),
    timeoutPromise
  ]);
} catch (error) {
  // Ignore timeout - MPC processes in background
  console.warn('Finalization timed out, but computation queued');
}

// Return immediately - poll account later for results
```

## Testing MPC Without Frontend

### Test 1: Create Poll & Check State

```bash
cd /workspaces/Arcanecast/voting

# Run test to create a poll
anchor test --skip-build --skip-deploy --provider.cluster devnet

# Check the poll account (get address from test output)
solana account <POLL_PDA_ADDRESS> --url devnet
```

### Test 2: Monitor Computation

```typescript
// In your test file
const pollPda = derivePollPDA(pollId);

// Poll every 5 seconds for 1 minute
for (let i = 0; i < 12; i++) {
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const account = await program.account.pollAccount.fetch(pollPda);
  const hasData = account.voteState[0].some(b => b !== 0);
  
  console.log(`Attempt ${i+1}: Vote state initialized = ${hasData}`);
  
  if (hasData) {
    console.log("✅ MPC computation completed!");
    break;
  }
}
```

## Alternative: Use Localnet

If devnet MPC is unreliable, you can:

1. **Run local Arcium nodes** (requires Docker)
2. **Use testnet** instead of devnet (more stable)
3. **Wait for mainnet** (most reliable but costs SOL)

### Switch to Testnet

```bash
# Update .env.local
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_RPC_ENDPOINT=https://api.testnet.solana.com

# Update program URLs in lib.rs
init_vote_stats_testnet.arcis  # Already using testnet files!
vote_testnet.arcis
reveal_result_testnet.arcis

# Redeploy
anchor build
anchor deploy --provider.cluster testnet
```

## Expected Behavior

### Normal Flow (When MPC Works):

1. **Create Poll**
   - Transaction confirms: ~2-5 seconds
   - MPC computation: ~10-30 seconds
   - `vote_state` updates: Visible after computation

2. **Cast Vote**
   - Transaction confirms: ~2-5 seconds
   - MPC computation: ~10-60 seconds
   - Vote tally updates: Silent (encrypted)

3. **Reveal Results**
   - Transaction confirms: ~2-5 seconds
   - MPC computation: ~10-30 seconds
   - Results visible: After computation

### Arcanehands Flow (Works Around MPC):

1. **Create Poll** - Return immediately, don't wait
2. **Cast Vote** - Return immediately, don't wait
3. **Get Results** - Poll database/account for updates

## Debugging Commands

```bash
# Check if circuits are committed
ls -lh /workspaces/Arcanecast/voting/build/*.arcis

# Verify GitHub URLs work
curl -I https://raw.githubusercontent.com/koon-ran/Arcanecast/main/voting/build/init_vote_stats_testnet.arcis
curl -I https://raw.githubusercontent.com/koon-ran/Arcanecast/main/voting/build/vote_testnet.arcis
curl -I https://raw.githubusercontent.com/koon-ran/Arcanecast/main/voting/build/reveal_result_testnet.arcis

# Check program deployment
solana program show FHuabcvigE645KXLy4KCFCLkLx1jLxi1nwFYs8ajWyYd --url devnet

# Check Arcium accounts
solana account <MXE_ACCOUNT> --url devnet
solana account <COMP_DEF_ACCOUNT> --url devnet
```

## Current Status

Based on your comment "still not getting the MPC computation results":

**Most Likely Cause:** Devnet MPC network is slow/unreliable

**Quick Fix:** Implement polling pattern like arcanehands:
1. Return immediately after queueing
2. Show "Processing..." in UI
3. Poll the poll account every 3-5 seconds
4. Show results when `vote_state` updates

**Long-term Fix:** 
- Use testnet (more reliable)
- Or wait for mainnet
- Or run local Arcium nodes

## Next Steps

Would you like me to:
1. **Implement polling pattern** in the frontend to check when MPC completes?
2. **Add diagnostic tools** to check account state?
3. **Switch to testnet** for better reliability?
4. **Add better error messages** showing what's happening?

Let me know what you'd prefer!
