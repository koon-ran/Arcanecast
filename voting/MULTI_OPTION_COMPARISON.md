## Multi-Option Voting: Three Approaches

### Approach 1: Array-Based Circuit (True Multi-Option)

```typescript
// Circuit handles 10 options in one computation
export function vote_multi(optionIndex: SecretInput, voteState: MutableSecretInput): void {
  voteState[optionIndex] = voteState[optionIndex] + 1;
}

// voteState = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
// User votes for option 2
// voteState = [0, 0, 1, 0, 0, 0, 0, 0, 0, 0]
```

**Pros:**
- ✅ Single poll, single computation
- ✅ Clean user experience
- ✅ Efficient (one vote transaction)

**Cons:**
- ❌ Complex circuit changes
- ❌ Larger circuit size (may exceed limits)
- ❌ Need to rebuild and redeploy everything
- ❌ Testing complexity

**When to Use:**
- You need 3-10 options frequently
- Willing to invest in circuit development
- Want professional multi-option polls

---

### Approach 2: Multiple YES/NO Polls (Simple)

```typescript
// Create 4 separate polls
const polls = [
  createPoll("Should we play Chess?"),
  createPoll("Should we play Go?"),
  createPoll("Should we play Checkers?"),
  createPoll("Should we play Backgammon?")
];

// User votes YES on one, NO on others (or just YES on one)
```

**Pros:**
- ✅ No code changes needed (works now!)
- ✅ Reuse existing circuits
- ✅ Simple to implement

**Cons:**
- ❌ Creates 4x the polls
- ❌ User can cheat (vote YES on multiple)
- ❌ Messy UX (4 separate polls in list)
- ❌ More expensive (4x transactions)

**When to Use:**
- Quick prototype
- One-time use case
- Don't want to change circuits

---

### Approach 3: Hybrid (Metadata + YES/NO Circuit)

```typescript
// Database stores: "Poll 123 has options: [Chess, Go, Checkers, Backgammon]"
// User sees: "Which game? [Radio buttons]"
// Behind scenes: User selects "Go", votes YES on "Poll 123, Option 1"

interface PollWithOptions {
  pollId: string;
  question: string;
  options: string[];        // Stored in DB, not on-chain
  
  // On-chain: Still just YES/NO circuit per option
  onChainPolls: {
    "Chess": PollAccount,
    "Go": PollAccount,
    "Checkers": PollAccount,
    "Backgammon": PollAccount
  }
}
```

**How it Works:**

1. **Create Poll (Frontend)**
   ```typescript
   // User creates poll with question and options
   const pollGroup = await createPollGroup({
     question: "Which game?",
     options: ["Chess", "Go", "Checkers", "Backgammon"]
   });
   
   // Behind scenes:
   // 1. Store metadata in database
   // 2. Create 4 separate on-chain polls
   // 3. Link them with a group_id
   ```

2. **Vote (Frontend)**
   ```typescript
   // User sees one poll with 4 radio buttons
   // User selects "Go"
   // Behind scenes: Vote YES on "Go" poll, vote NO on others
   
   async function voteOnOption(groupId: string, selectedOption: string) {
     const pollGroup = await db.getPollGroup(groupId);
     
     // Only vote YES on selected option
     await votingService.castVote(
       pollGroup.onChainPolls[selectedOption],
       true  // YES
     );
     
     // Record in DB: "User voted for 'Go'"
     await db.recordMultiOptionVote(groupId, wallet, selectedOption);
   }
   ```

3. **Results (Frontend)**
   ```typescript
   // Aggregate results from all 4 polls
   const results = await Promise.all(
     pollGroup.options.map(async (option) => {
       const poll = pollGroup.onChainPolls[option];
       const revealed = await votingService.getPoll(poll.id);
       return {
         option,
         votes: revealed.yesCount  // Only count YES votes
       };
     })
   );
   
   // Display: "Go: 23 votes, Chess: 15 votes, ..."
   ```

**Pros:**
- ✅ No circuit changes (use existing YES/NO)
- ✅ Clean UX (looks like one poll)
- ✅ Prevent cheating (DB tracks one vote per user)
- ✅ Flexible (can add options dynamically)

**Cons:**
- ⚠️ Need backend database
- ⚠️ More on-chain polls (but grouped)
- ⚠️ Slightly more complex frontend logic

**When to Use:**
- You already have (or willing to add) a backend
- Want multi-option without circuit changes
- Need flexibility to add options later

---

## Visual Comparison

### User Perspective (All Look Similar)

```
╔══════════════════════════════════════╗
║  Which game should we play?          ║
║                                      ║
║  ○ Chess                             ║
║  ○ Go                                ║
║  ○ Checkers                          ║
║  ○ Backgammon                        ║
║                                      ║
║  [Submit Vote]                       ║
╚══════════════════════════════════════╝
```

### Behind the Scenes

**Approach 1 (True Multi-Option):**
```
Poll Account:
  question: "Which game?"
  options: ["Chess", "Go", "Checkers", "Backgammon"]
  voteState: [15, 23, 8, 10]  ← Single encrypted array
  
Vote: encrypt(optionIndex=1) → MPC increments voteState[1]
```

**Approach 2 (Separate Polls):**
```
Poll 1: "Should we play Chess?"     → YES: 15, NO: 46
Poll 2: "Should we play Go?"        → YES: 23, NO: 38
Poll 3: "Should we play Checkers?"  → YES: 8,  NO: 53
Poll 4: "Should we play Backgammon?"→ YES: 10, NO: 51
```

**Approach 3 (Hybrid):**
```
Database:
  poll_groups table:
    id: "abc123"
    question: "Which game?"
    options: ["Chess", "Go", "Checkers", "Backgammon"]
    linked_polls: ["poll1", "poll2", "poll3", "poll4"]

Blockchain (4 separate polls):
  Poll 1: voteState: [15, 46]  (YES=15, NO=46)
  Poll 2: voteState: [23, 38]  (YES=23, NO=38)
  Poll 3: voteState: [8,  53]  (YES=8,  NO=53)
  Poll 4: voteState: [10, 51]  (YES=10, NO=51)

Frontend: Aggregates YES counts → "Go: 23, Chess: 15, ..."
```

---

## Recommendation for Your Project

### If You Want to Implement NOW:

**Use Approach 3 (Hybrid)** because:
- ✅ Works with your existing circuits
- ✅ Just need to add database service (I showed you how)
- ✅ Clean UX with grouped polls
- ✅ Can implement in a few hours

### If You Want to Invest Time:

**Use Approach 1 (True Multi-Option)** because:
- ✅ Most professional solution
- ✅ More efficient (single computation)
- ✅ Better for long-term scalability
- ⚠️ Requires 1-2 weeks of work:
  - Write new circuit (`vote_multi.ts`)
  - Test circuit with `arcium build`
  - Update Rust program (Poll struct, instructions)
  - Update frontend (UI, types, services)
  - Test end-to-end
  - Redeploy everything

### For Quick Prototype:

**Use Approach 2 (Separate Polls)** because:
- ✅ Zero code changes
- ✅ Works in 5 minutes
- ⚠️ Messy but functional

---

## Code Example: Approach 3 (Hybrid) Implementation

```typescript
// pollGroupService.ts
export class PollGroupService {
  private dbService: PollDatabaseService;
  private votingService: VotingService;

  async createPollGroup(
    question: string,
    options: string[]
  ): Promise<PollGroup> {
    // 1. Create on-chain polls for each option
    const onChainPolls: Record<string, string> = {};
    
    for (const option of options) {
      const pollQuestion = `${question} - ${option}`;
      const signature = await this.votingService.createPoll(pollQuestion);
      onChainPolls[option] = signature;
    }
    
    // 2. Store metadata in database
    const groupId = generateUUID();
    await this.dbService.createPollGroup({
      id: groupId,
      question,
      options,
      linkedPolls: onChainPolls,
      createdAt: Date.now()
    });
    
    return { id: groupId, question, options, onChainPolls };
  }

  async voteOnOption(
    groupId: string,
    selectedOption: string
  ): Promise<void> {
    // 1. Get poll group from database
    const group = await this.dbService.getPollGroup(groupId);
    
    // 2. Validate option
    if (!group.options.includes(selectedOption)) {
      throw new Error("Invalid option");
    }
    
    // 3. Check if user already voted
    const hasVoted = await this.dbService.hasVotedInGroup(
      groupId,
      this.wallet.publicKey.toString()
    );
    
    if (hasVoted) {
      throw new Error("Already voted in this poll");
    }
    
    // 4. Vote YES on selected option's poll
    const pollId = group.linkedPolls[selectedOption];
    await this.votingService.castVote(pollId, true);
    
    // 5. Record in database
    await this.dbService.recordGroupVote(
      groupId,
      this.wallet.publicKey.toString(),
      selectedOption
    );
  }

  async getResults(groupId: string): Promise<MultiOptionResult[]> {
    const group = await this.dbService.getPollGroup(groupId);
    
    const results = await Promise.all(
      group.options.map(async (option) => {
        const pollId = group.linkedPolls[option];
        const poll = await this.votingService.fetchPoll(pollId);
        
        return {
          option,
          votes: poll.isRevealed ? poll.yesCount : null
        };
      })
    );
    
    return results;
  }
}
```

Would you like me to help implement any of these approaches?
