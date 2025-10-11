# Arcium Voting App - Devnet Setup

Before using the frontend on devnet, you need to initialize the Arcium accounts ONCE.

## Prerequisites
- Solana CLI installed and configured
- Your wallet has SOL on devnet (get from https://faucet.solana.com)
- Program deployed to devnet via `arcium deploy`

## Initialize Arcium Accounts on Devnet

The MXE account is already initialized when you run `arcium deploy`. However, you need to initialize the three computation definitions. Run the integration tests which will set everything up:

```bash
cd /workspaces/Arcanecast/voting
anchor test --skip-build --skip-deploy --provider.cluster devnet
```

This will initialize:
- ✅ MXE account (already done by `arcium deploy`)
- ✅ `init_vote_stats` computation definition  
- ✅ `vote` computation definition
- ✅ `reveal_result` computation definition

## After Initialization

Once the tests pass, your devnet deployment is ready and the frontend can create polls without any "Unknown action" errors.

## Troubleshooting

If you get "InvalidAuthority" errors, it means the MXE account was created by a different wallet. You need to either:
1. Use the same wallet that ran `arcium deploy`, OR
2. Re-deploy everything with your current wallet:
   ```bash
   arcium deploy --cluster-offset 1078779259 \
     --keypair-path ~/.config/solana/id.json \
     --rpc-url https://api.devnet.solana.com
   ```
