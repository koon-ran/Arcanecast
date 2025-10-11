# Hybrid Storage Architecture Example

## Overview

Combine on-chain confidential voting with off-chain metadata for the best of both worlds:
- **On-chain**: Encrypted votes, MPC computation, censorship-resistant results
- **Off-chain**: Fast queries, poll discovery, metadata storage

## Backend API Example (Node.js + PostgreSQL)

### Database Schema

```sql
-- Polls table
CREATE TABLE polls (
  id VARCHAR(255) PRIMARY KEY,
  authority VARCHAR(255) NOT NULL,  -- Creator's wallet address
  question TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  tx_signature VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'active',  -- 'active', 'revealed', 'closed'
  yes_count INTEGER DEFAULT 0,  -- Updated after reveal
  no_count INTEGER DEFAULT 0,   -- Updated after reveal
  revealed_at TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_authority (authority),
  INDEX idx_created_at (created_at)
);

-- Vote participation records (NOT the actual vote choice!)
CREATE TABLE vote_records (
  id SERIAL PRIMARY KEY,
  poll_id VARCHAR(255) REFERENCES polls(id),
  wallet VARCHAR(255) NOT NULL,
  voted_at TIMESTAMP DEFAULT NOW(),
  tx_signature VARCHAR(255) UNIQUE NOT NULL,
  UNIQUE(poll_id, wallet),  -- One vote per wallet per poll
  INDEX idx_poll_id (poll_id),
  INDEX idx_wallet (wallet)
);
```

### API Endpoints (Express.js)

```typescript
import express from 'express';
import { Pool } from 'pg';

const app = express();
const db = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(express.json());

// Create poll metadata
app.post('/api/polls', async (req, res) => {
  const { pollId, authority, question, txSignature } = req.body;
  
  try {
    await db.query(
      'INSERT INTO polls (id, authority, question, tx_signature) VALUES ($1, $2, $3, $4)',
      [pollId, authority, question, txSignature]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to store poll' });
  }
});

// Get all active polls (FAST - no blockchain scan!)
app.get('/api/polls', async (req, res) => {
  const { status = 'active', creator } = req.query;
  
  try {
    let query = 'SELECT * FROM polls WHERE status = $1';
    const params = [status];
    
    if (creator) {
      query += ' AND authority = $2';
      params.push(creator as string);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch polls' });
  }
});

// Record vote participation (NOT the actual vote!)
app.post('/api/votes', async (req, res) => {
  const { pollId, wallet, txSignature } = req.body;
  
  try {
    await db.query(
      'INSERT INTO vote_records (poll_id, wallet, tx_signature) VALUES ($1, $2, $3)',
      [pollId, wallet, txSignature]
    );
    res.json({ success: true });
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Already voted' });
    } else {
      res.status(500).json({ error: 'Failed to record vote' });
    }
  }
});

// Check if user voted on a poll
app.get('/api/votes/:pollId/:wallet', async (req, res) => {
  const { pollId, wallet } = req.params;
  
  try {
    const result = await db.query(
      'SELECT * FROM vote_records WHERE poll_id = $1 AND wallet = $2',
      [pollId, wallet]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ hasVoted: false });
    } else {
      res.json({ 
        hasVoted: true, 
        votedAt: result.rows[0].voted_at,
        txSignature: result.rows[0].tx_signature
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to check vote status' });
  }
});

// Get user's voting history
app.get('/api/votes/history/:wallet', async (req, res) => {
  const { wallet } = req.params;
  
  try {
    const result = await db.query(
      `SELECT vr.*, p.question, p.status 
       FROM vote_records vr 
       JOIN polls p ON vr.poll_id = p.id 
       WHERE vr.wallet = $1 
       ORDER BY vr.voted_at DESC`,
      [wallet]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Update poll after reveal (store final results)
app.patch('/api/polls/:pollId/reveal', async (req, res) => {
  const { pollId } = req.params;
  const { yesCount, noCount } = req.body;
  
  try {
    await db.query(
      'UPDATE polls SET status = $1, yes_count = $2, no_count = $3, revealed_at = NOW() WHERE id = $4',
      ['revealed', yesCount, noCount, pollId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update poll' });
  }
});

app.listen(3001, () => console.log('API running on port 3001'));
```

## Integration with Your Frontend

### Updated VotingService

```typescript
import { PollDatabaseService } from './pollDatabase';

export class VotingService {
  private dbService: PollDatabaseService;
  
  constructor(connection: Connection, wallet: any) {
    // ... existing code
    this.dbService = new PollDatabaseService();
  }

  async createPoll(question: string): Promise<string> {
    // 1. Create poll on-chain (existing code)
    const signature = await this.createPollOnChain(question);
    
    // 2. Store metadata in database (NEW!)
    try {
      await this.dbService.storePollMetadata({
        pollId: pollId.toString(),
        authority: this.provider.wallet.publicKey.toString(),
        question,
        createdAt: Date.now(),
        txSignature: signature,
        status: "active"
      });
    } catch (error) {
      console.error("Failed to store metadata:", error);
      // Continue even if DB fails - poll exists on-chain
    }
    
    return signature;
  }

  async castVote(pollId: string, vote: boolean): Promise<string> {
    // 1. Check database first (faster than blockchain)
    const hasVoted = await this.dbService.hasUserVoted(
      pollId, 
      this.provider.wallet.publicKey.toString()
    );
    
    if (hasVoted) {
      throw new Error("You have already voted on this poll");
    }
    
    // 2. Cast vote on-chain (existing encrypted voting)
    const signature = await this.castVoteOnChain(pollId, vote);
    
    // 3. Record participation in database (NOT the vote choice!)
    try {
      await this.dbService.recordVoteParticipation({
        pollId,
        wallet: this.provider.wallet.publicKey.toString(),
        timestamp: Date.now(),
        txSignature: signature
      });
    } catch (error) {
      console.error("Failed to record vote:", error);
      // Continue - vote is on-chain, DB is just for convenience
    }
    
    return signature;
  }

  async getAllPolls(): Promise<PollMetadata[]> {
    // Fast database query instead of scanning blockchain!
    return this.dbService.getActivePolls();
  }
}
```

## Benefits

### 1. **Fast Poll Discovery**
```typescript
// Without DB: Scan entire blockchain (slow, expensive)
const allAccounts = await connection.getProgramAccounts(programId);

// With DB: Simple query (milliseconds)
const polls = await db.query('SELECT * FROM polls WHERE status = $1', ['active']);
```

### 2. **User History**
```typescript
// Easy to show "Your Votes" page
const myVotes = await dbService.getUserVotingHistory(wallet.toString());
```

### 3. **Vote Verification**
```typescript
// Database says user voted at timestamp X with tx Y
// User can verify on Solana Explorer that tx Y exists
// This proves participation without revealing the vote!
```

### 4. **Still Confidential!**
- Database only knows: "Wallet A voted on Poll B at time C"
- Database does NOT know: "Wallet A voted YES" ← This is encrypted on-chain!
- Results come from MPC reveal, not from counting database records

## Trade-offs

| Aspect | Pure On-Chain | Hybrid Storage |
|--------|---------------|----------------|
| **Privacy** | ✅ Perfect | ⚠️ Participation visible |
| **Censorship** | ✅ Unstoppable | ⚠️ API can be blocked |
| **Speed** | ❌ Slow queries | ✅ Instant queries |
| **Cost** | ⚠️ More RPC calls | ✅ Fewer RPC calls |
| **Complexity** | ✅ Simple | ❌ Need backend |
| **Trust** | ✅ Trustless | ⚠️ Trust API for metadata |

## Recommendation

Use hybrid storage if you need:
- ✅ Fast poll listing ("Browse all polls")
- ✅ User history ("Your votes")
- ✅ Search/filter functionality
- ✅ Mobile app (reduce blockchain queries)

Keep pure on-chain if:
- ✅ Maximum censorship resistance
- ✅ No backend infrastructure
- ✅ Small number of polls
- ✅ Don't need complex queries
