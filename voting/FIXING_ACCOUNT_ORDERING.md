# Fix: Account Ordering in VotingService

## Problem
The voting app was failing with "Unknown action 'undefined'" error when creating polls because the account ordering in `votingService.ts` didn't match what the Rust program expected.

## Root Cause Analysis

### What We Learned from Working Dapps

By analyzing the working Arcanecast dapp files (`arcium-client.ts`, `poll-client.ts`), we discovered:

1. **Explicit Account Ordering**: Working dapps use `TransactionInstruction` with explicit `keys` array, ensuring exact account order
2. **SignerAccount PDA**: All working implementations derive and include a `signPdaAccount` with seed `"SignerAccount"`
3. **Complete Account Set**: Every Arcium transaction requires all these accounts in order:
   - payer
   - signPdaAccount
   - mxeAccount
   - mempoolAccount
   - executingPool
   - computationAccount
   - compDefAccount
   - clusterAccount
   - poolAccount (fee pool)
   - clockAccount
   - systemProgram
   - arciumProgram
   - (program-specific accounts like pollAcc)

### Rust Program Requirements

The Rust program in `programs/voting/src/lib.rs` defines the `CreateNewPoll` account context with this exact structure:

```rust
#[derive(Accounts)]
pub struct CreateNewPoll<'info> {
    pub payer: Signer<'info>,
    pub sign_pda_account: Account<'info, SignerAccount>,
    pub mxe_account: Account<'info, MXEAccount>,
    pub mempool_account: UncheckedAccount<'info>,
    pub executing_pool: UncheckedAccount<'info>,
    pub computation_account: UncheckedAccount<'info>,
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    pub cluster_account: Account<'info, Cluster>,
    pub pool_account: Account<'info, FeePool>,
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
    pub poll_acc: Account<'info, PollAccount>,
}
```

## The Fix

### Before (Incorrect)
```typescript
const signature = await this.program.methods
  .createNewPoll(computationOffset, pollId, question, nonce)
  .accountsPartial({
    payer: authority,
    pollAcc: pollPDA,
    ...arciumAccounts,  // Spread operator - unclear ordering
  })
  .rpc({ skipPreflight: true, commitment: "confirmed" });
```

**Problem**: Using spread operator (`...arciumAccounts`) doesn't guarantee the correct account order that Anchor expects.

### After (Correct)
```typescript
const signature = await this.program.methods
  .createNewPoll(computationOffset, pollId, question, nonce)
  .accountsPartial({
    payer: authority,
    signPdaAccount: arciumAccounts.signPdaAccount,
    mxeAccount: arciumAccounts.mxeAccount,
    mempoolAccount: arciumAccounts.mempoolAccount,
    executingPool: arciumAccounts.executingPool,
    computationAccount: arciumAccounts.computationAccount,
    compDefAccount: arciumAccounts.compDefAccount,
    clusterAccount: arciumAccounts.clusterAccount,
    poolAccount: arciumAccounts.poolAccount,
    clockAccount: arciumAccounts.clockAccount,
    systemProgram: arciumAccounts.systemProgram,
    arciumProgram: arciumAccounts.arciumProgram,
    pollAcc: pollPDA,
  })
  .rpc({ skipPreflight: true, commitment: "confirmed" });
```

**Solution**: Explicitly list all accounts in the exact order the Rust program expects, ensuring `signPdaAccount` is included.

## Changes Made

Updated three methods in `voting/app/src/services/votingService.ts`:

1. **`createPoll()`** - Fixed account ordering for poll creation
2. **`castVote()`** - Fixed account ordering for voting
3. **`revealResults()`** - Fixed account ordering for result revelation

All three methods now:
- Explicitly list each account instead of using spread operator
- Include `signPdaAccount` which was previously missing
- Match the exact order defined in the Rust program structs

## Key Takeaways

1. **Don't rely on spread operators** for Anchor account ordering - be explicit
2. **SignerAccount PDA is required** for Arcium programs - always include it
3. **Account order matters** - must match the Rust program's account struct exactly
4. **Working examples are valuable** - the poll-client.ts showed the correct pattern

## Testing

After the fix:
- ✅ Lint passes successfully
- ✅ All accounts are properly ordered
- ✅ signPdaAccount is included in all transactions
- Ready for testing poll creation in the UI

## Next Steps

1. Test poll creation in the UI
2. Verify that all three operations (create, vote, reveal) work correctly
3. Monitor transaction logs for any remaining issues
