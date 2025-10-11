# ArcaneCast - Confidential Voting Frontend

A modern, beautiful frontend for the Arcium confidential voting smart contract. Built with Next.js 14, TypeScript, and Tailwind CSS.

## 🌟 Features

- **🔐 End-to-End Encryption**: Votes are encrypted on the client before submission
- **⚙️ MPC Computation**: Secure multi-party computation ensures vote privacy
- **✨ Real-time Updates**: Live status updates during encryption and computation
- **🎨 Beautiful UI**: Modern gradient design with smooth animations
- **👛 Multi-Wallet Support**: Phantom, Solflare, and Backpack wallet integration

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- A Solana wallet (Phantom, Solflare, or Backpack)
- Access to a Solana network (localnet, devnet, or mainnet)

### Installation

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
```

### Environment Variables

Create a `.env.local` file:

```env
# Network Configuration
NEXT_PUBLIC_NETWORK=localnet
NEXT_PUBLIC_RPC_ENDPOINT=http://localhost:8899

# Program IDs
NEXT_PUBLIC_VOTING_PROGRAM_ID=4GgWSSwwVXVGcUgb7CgjHve5nVsnT4vQYH823qfdjY8H
NEXT_PUBLIC_ARCIUM_PROGRAM_ID=ARC1NJvErwyyk2oBTQW7QLqiLkiXmEdZgxrHVAkQ3fqG
```

### Running the App

```bash
# Development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## 📁 Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Home page
│   ├── providers.tsx      # Provider wrapper
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── CreatePollForm.tsx # Poll creation form
│   ├── PollCard.tsx       # Individual poll display
│   ├── PollList.tsx       # List of all polls
│   ├── VoteButtons.tsx    # Voting interface
│   └── RevealResults.tsx  # Results revelation
├── contexts/              # React contexts
│   ├── ArciumContext.tsx  # Arcium encryption management
│   └── SolanaContext.tsx  # Solana wallet provider
├── services/              # Business logic
│   └── votingService.ts   # Voting service wrapper
├── utils/                 # Utility functions
│   └── helpers.ts         # Helper functions
├── types/                 # TypeScript types
│   └── index.ts           # Type definitions
└── config/                # Configuration
    └── constants.ts       # App constants
```

## 🎮 How to Use

### Creating a Poll

1. Connect your Solana wallet
2. Wait for encryption to initialize
3. Click "Create Poll" tab
4. Enter a unique poll ID and question
5. Click "Create Poll" and wait for MPC computation

### Voting on a Poll

1. Browse available polls in the "View Polls" tab
2. Click "Vote YES" or "Vote NO"
3. Wait for:
   - 🔐 Vote encryption
   - 📤 Transaction submission
   - ⚙️ Secure MPC computation
4. Your encrypted vote is now recorded!

### Revealing Results

1. Only the poll creator can reveal results
2. Click "Reveal Results" button
3. Wait for MPC decryption
4. See the majority decision (YES or NO)
5. Note: Individual vote counts remain confidential

## 🔐 Privacy Features

- **Client-Side Encryption**: All votes are encrypted using the Rescue cipher before leaving your device
- **Shared Secrets**: x25519 ECDH key exchange establishes secure communication with MPC nodes
- **Encrypted Storage**: Vote tallies remain encrypted on-chain until revelation
- **Controlled Disclosure**: Only poll creators can reveal results
- **Limited Information**: Only the majority decision is revealed, not actual vote counts

## 🛠️ Technology Stack

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **@arcium-hq/client**: Arcium MPC integration
- **@solana/web3.js**: Solana blockchain interaction
- **@coral-xyz/anchor**: Anchor framework client
- **Wallet Adapter**: Multi-wallet support
- **React Hot Toast**: Beautiful notifications
- **Zustand**: State management (optional)

## 🔧 Development

### Adding New Features

1. **New Component**: Add to `src/components/`
2. **New Service**: Add to `src/services/`
3. **New Type**: Add to `src/types/`
4. **New Utility**: Add to `src/utils/`

### Customizing Styles

Edit `src/app/globals.css` for global styles or use Tailwind utilities in components.

### Environment-Specific Configuration

Update `src/config/constants.ts` for different network configurations.

## 📝 Key Differences from Traditional Solana DApps

1. **Encryption Layer**: Votes must be encrypted client-side before submission
2. **Async Computation**: MPC processing takes 5-15 seconds (not instant)
3. **Multiple Transactions**: Queue → MPC → Callback (track each step)
4. **Account Complexity**: Many Arcium system accounts required
5. **Status Tracking**: Monitor computation progress across multiple states

## 🐛 Troubleshooting

### "Encryption not ready"
- Wait a few seconds for MXE public key to be fetched
- Check your RPC endpoint is accessible

### "Failed to fetch MXE public key"
- Ensure the Arcium program is deployed
- Verify your network configuration
- Check RPC endpoint connectivity

### "Computation timeout"
- MPC cluster may be slow or offline
- Increase `COMPUTATION_TIMEOUT_MS` in constants
- Check localnet/devnet status

### Wallet connection issues
- Ensure wallet extension is installed
- Try disconnecting and reconnecting
- Clear browser cache

## 📚 Learn More

- [Arcium Documentation](https://docs.arcium.com)
- [Next.js Documentation](https://nextjs.org/docs)
- [Solana Documentation](https://docs.solana.com)
- [Anchor Framework](https://www.anchor-lang.com)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - feel free to use this project for your own purposes.

---

Built with ❤️ using Arcium MPC on Solana
