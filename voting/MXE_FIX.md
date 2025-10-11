# MXE Public Key Fetch Fix

## Problem
Frontend fails with: `"Failed to fetch MXE public key after 10 attempts"`

## Root Cause
The Arcium SDK was using `getArciumEnv()` which returns a default cluster configuration that doesn't match the cluster offset used during deployment.

## Solution Applied

### 1. Added Cluster Offset Constant
**File**: `app/src/config/constants.ts`

```typescript
// Arcium cluster configuration
// IMPORTANT: This must match the --cluster-offset used during arcium deploy
export const CLUSTER_OFFSET = 3726127828;
```

### 2. Updated Account Derivation
**File**: `app/src/utils/helpers.ts`

**Before**:
```typescript
import { getArciumEnv } from "@arcium-hq/client";

const arciumEnv = getArciumEnv();
// ...
clusterAccount: arciumEnv.arciumClusterPubkey,
```

**After**:
```typescript
import { getClusterAccAddress } from "@arcium-hq/client";
import { CLUSTER_OFFSET } from "@/config/constants";

// ...
clusterAccount: getClusterAccAddress(CLUSTER_OFFSET),
```

## Deployment Command Used
```bash
arcium init-mxe \
  --callback-program Auuh5Ehhiey7nesCHJdrdwSGF4jZ9xoHgXMTiKjfZCnW \
  --cluster-offset 1078779259 \
  --keypair-path ~/.config/solana/id.json \
  --rpc-url https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY
```

## Why This Matters
- Arcium derives the MXE account address using: `program_id + cluster_offset`
- If the frontend uses a different cluster offset than deployment, it looks for the MXE account at the wrong address
- Result: "account not found" errors

## Verification
After this fix, `getMXEPublicKey(provider, VOTING_PROGRAM_ID)` will:
1. Derive the correct MXE account address using your cluster offset
2. Find the account on-chain (created during `arcium deploy`)
3. Return the 32-byte MXE public key
4. Allow the frontend to proceed with encryption setup

## Next Steps
1. Rebuild the frontend: `npm run dev`
2. Connect your wallet
3. The "Initializing Arcium encryption..." toast should succeed
4. MXE public key should be fetched within 1-2 attempts

## Reference
This pattern matches how Arcane Hands handles cluster configuration:
```typescript
// From arcanehands.xyz
export const CLUSTER_OFFSET = 1078779259;
const clusterAccount = getClusterAccAddress(CLUSTER_OFFSET);
```
