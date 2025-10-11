# Arcium Voting dApp - Deployment Guide

This guide explains how to deploy the confidential voting application to devnet.

## Prerequisites

- Solana CLI installed and configured
- Arcium CLI installed (`npm install -g @arcium-hq/arcium-cli`)
- A funded Solana wallet on devnet
- Node.js 18+ and npm

## Step 1: Build the Solana Program

```bash
cd voting
anchor build
```

Note your program ID from the build output or check `target/deploy/voting-keypair.json`.

## Step 2: Update Program IDs

Update `Anchor.toml` and `programs/voting/src/lib.rs` with your program ID if it changed.

## Step 3: Deploy to Solana Devnet

```bash
anchor deploy --provider.cluster devnet
```

## Step 4: Deploy Arcium Computations

This is the **critical step** that creates the MXE account. You must use a specific cluster offset and remember it.

```bash
# Using official Arcium devnet cluster offset
CLUSTER_OFFSET=1078779259

arcium deploy \
  --cluster-offset 1078779259 \
  --keypair-path ~/.config/solana/id.json \
  --rpc-url https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY
```

**⚠️ IMPORTANT**: Save the cluster offset you used! You'll need it in the next step.

## Step 5: Configure Frontend

Update `app/src/config/constants.ts`:

```typescript
// In app/src/config/constants.ts
export const CLUSTER_OFFSET = 1078779259;
```

If your program ID changed, also update:
- `NEXT_PUBLIC_VOTING_PROGRAM_ID` in `app/.env.local`
- Or update the default in `app/src/config/constants.ts`

## Step 6: Build and Run Frontend

```bash
cd app
npm install
npm run dev
```

The app will be available at `http://localhost:3000`.

## Troubleshooting

### "Failed to fetch MXE public key after 10 attempts"

This means the MXE account doesn't exist on-chain. Common causes:

1. **Wrong cluster offset**: The `CLUSTER_OFFSET` in `constants.ts` doesn't match what you used in `arcium deploy`.
2. **Computations not deployed**: You skipped Step 4 or it failed silently.
3. **Wrong network**: Your RPC endpoint doesn't match where you deployed (localnet vs devnet).
4. **Wrong program ID**: The frontend is pointing at a different program than what you deployed.

**Solution**: Re-run Step 4 with the correct cluster offset, then update `constants.ts` to match.

### How to verify MXE account exists

```bash
# Install Arcium CLI helpers
npm install -g @arcium-hq/client

# Check if MXE account exists (replace with your program ID)
solana account $(arcium derive-address mxe --program-id YOUR_PROGRAM_ID) --url devnet
```

If the account exists, you should see account data. If not, re-run `arcium deploy`.

## Architecture Notes

The cluster offset is used to derive the Arcium cluster account address:

```
clusterAccount = getClusterAccAddress(CLUSTER_OFFSET)
```

All Arcium computations for your program must use the same cluster. The SDK derives account addresses based on:
- Your program ID
- The cluster offset
- Computation definition offsets (derived from instruction names)

This is why the cluster offset must match between deployment and runtime.

## Production Deployment

For production (mainnet):

1. Use a dedicated cluster offset (not a random one)
2. Document it in your deployment scripts
3. Consider using environment variables for the cluster offset
4. Keep deployment logs that record which offset was used
5. Use mainnet RPC endpoints and program IDs

## References

- [Arcium Documentation](https://docs.arcium.com)
- [Solana Documentation](https://docs.solana.com)
- [Anchor Framework](https://www.anchor-lang.com)
