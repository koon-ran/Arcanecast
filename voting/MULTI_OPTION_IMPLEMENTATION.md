/**
 * MULTI-OPTION VOTING DESIGN
 * 
 * Changes needed to support multiple options (not just YES/NO)
 */

// ============================================================================
// 1. CIRCUIT CHANGES (build/vote_multi.ts)
// ============================================================================

/**
 * Current: vote(choice: boolean, voteState: [yes_count, no_count])
 * New: vote_multi(optionIndex: number, voteState: [count0, count1, ...])
 */

export function vote_multi(
  optionIndex: SecretInput,     // Which option (0, 1, 2, ...)
  voteState: MutableSecretInput  // Array of encrypted counters
): void {
  // MPC increments the selected counter
  voteState[optionIndex] = voteState[optionIndex] + 1;
}

// ============================================================================
// 2. RUST PROGRAM CHANGES (programs/voting/src/lib.rs)
// ============================================================================

/**
 * Update Poll struct to include options and vote counts
 */
#[account]
pub struct Poll {
    pub id: u32,
    pub authority: Pubkey,
    pub question: String,
    pub num_options: u8,                    // NEW: How many options (2-10)
    pub option_labels: Vec<String>,          // NEW: ["Chess", "Go", "Checkers"]
    pub vote_state_computation_acc: Pubkey,
    pub is_revealed: bool,
    pub revealed_counts: Vec<u64>,           // NEW: [15, 8, 23] instead of yes_count/no_count
    pub bump: u8,
}

/**
 * Update CreatePoll instruction
 */
pub fn create_poll(
    ctx: Context<CreatePoll>,
    computation_offset: u64,
    poll_id: u32,
    question: String,
    num_options: u8,                         // NEW
    option_labels: Vec<String>,              // NEW
    nonce: u128,
) -> Result<()> {
    require!(num_options >= 2 && num_options <= 10, ErrorCode::InvalidOptionCount);
    require!(option_labels.len() == num_options as usize, ErrorCode::LabelCountMismatch);
    
    let poll = &mut ctx.accounts.poll;
    poll.id = poll_id;
    poll.authority = ctx.accounts.authority.key();
    poll.question = question;
    poll.num_options = num_options;          // NEW
    poll.option_labels = option_labels;      // NEW
    poll.is_revealed = false;
    poll.revealed_counts = vec![0; num_options as usize]; // NEW
    poll.bump = ctx.bumps.poll;

    // Queue init_vote_stats_multi computation
    // This will create an encrypted array of `num_options` counters
    // ...
    
    Ok(())
}

/**
 * Update CastVote instruction
 */
pub fn cast_vote(
    ctx: Context<CastVote>,
    computation_offset: u64,
    poll_id: u32,
    option_index: u8,                        // NEW: Instead of boolean vote
    nonce: u128,
) -> Result<()> {
    let poll = &ctx.accounts.poll;
    
    // Validate option_index is within bounds
    require!(
        option_index < poll.num_options, 
        ErrorCode::InvalidOptionIndex
    );
    
    // Encrypt the option_index
    let encrypted_option = encrypt_io(
        &ctx.accounts.mxe.key(),
        &[option_index as u64],              // Encrypt which option
        nonce
    )?;
    
    // Queue vote_multi computation
    // This will increment voteState[option_index]
    // ...
    
    Ok(())
}

/**
 * Update RevealResults instruction
 */
pub fn reveal_results(
    ctx: Context<RevealResults>,
    computation_offset: u64,
    poll_id: u32,
    nonce: u128,
) -> Result<()> {
    // Queue reveal_result_multi computation
    // Will return array of decrypted counts
    // ...
    
    // Callback will store counts in poll.revealed_counts
    // poll.revealed_counts = [15, 8, 23, 10, 5] etc.
    
    Ok(())
}

/**
 * Update Callback instruction
 */
pub fn handle_reveal_callback(
    ctx: Context<RevealCallback>,
    decrypted_counts: Vec<u64>,              // NEW: Array instead of boolean
) -> Result<()> {
    let poll = &mut ctx.accounts.poll;
    
    require!(
        decrypted_counts.len() == poll.num_options as usize,
        ErrorCode::CountMismatch
    );
    
    poll.is_revealed = true;
    poll.revealed_counts = decrypted_counts; // NEW: Store all counts
    
    // Emit event with all results
    emit!(RevealResultEvent {
        poll_id: poll.id,
        counts: decrypted_counts,
        winner_index: get_winner_index(&decrypted_counts),
    });
    
    Ok(())
}

fn get_winner_index(counts: &[u64]) -> u8 {
    counts.iter()
        .enumerate()
        .max_by_key(|(_, &count)| count)
        .map(|(index, _)| index as u8)
        .unwrap_or(0)
}

// ============================================================================
// 3. FRONTEND CHANGES
// ============================================================================

/**
 * Update Poll interface (types/index.ts)
 */
export interface Poll {
  id: number;
  authority: PublicKey;
  question: string;
  numOptions: number;                        // NEW
  optionLabels: string[];                    // NEW: ["Chess", "Go", "Checkers"]
  voteStateComputationAcc: PublicKey;
  isRevealed: boolean;
  revealedCounts: number[];                  // NEW: [15, 8, 23]
  bump: number;
}

/**
 * Update CreatePollForm component
 */
<form onSubmit={handleCreatePoll}>
  <input 
    value={question}
    onChange={(e) => setQuestion(e.target.value)}
    placeholder="Enter poll question"
  />
  
  {/* NEW: Dynamic option inputs */}
  <div>
    <label>Number of options (2-10):</label>
    <input 
      type="number" 
      min="2" 
      max="10"
      value={numOptions}
      onChange={(e) => setNumOptions(parseInt(e.target.value))}
    />
  </div>
  
  {Array.from({ length: numOptions }).map((_, i) => (
    <input
      key={i}
      value={optionLabels[i] || ''}
      onChange={(e) => {
        const newLabels = [...optionLabels];
        newLabels[i] = e.target.value;
        setOptionLabels(newLabels);
      }}
      placeholder={`Option ${i + 1}`}
    />
  ))}
  
  <button type="submit">Create Poll</button>
</form>

/**
 * Update VoteButtons component
 */
<div className="vote-options">
  {poll.optionLabels.map((label, index) => (
    <button
      key={index}
      onClick={() => handleVote(index)}
      disabled={hasVoted}
      className={userVote === index ? 'selected' : ''}
    >
      {label}
    </button>
  ))}
</div>

{poll.isRevealed && (
  <div className="results">
    <h3>Results:</h3>
    {poll.optionLabels.map((label, index) => {
      const count = poll.revealedCounts[index];
      const total = poll.revealedCounts.reduce((a, b) => a + b, 0);
      const percentage = total > 0 ? (count / total * 100).toFixed(1) : 0;
      
      return (
        <div key={index} className="result-bar">
          <span>{label}</span>
          <div className="bar">
            <div 
              className="fill" 
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span>{count} votes ({percentage}%)</span>
        </div>
      );
    })}
  </div>
)}

/**
 * Update votingService.ts
 */
async castVote(
  pollId: string, 
  optionIndex: number              // NEW: Instead of boolean
): Promise<string> {
  // Fetch poll to validate option_index
  const poll = await this.fetchPoll(pollId);
  
  if (optionIndex >= poll.numOptions) {
    throw new Error(`Invalid option index: ${optionIndex}`);
  }
  
  // Encrypt the option index
  const encryptedOption = await encryptIO(
    mxeAccount,
    [BigInt(optionIndex)],
    nonce
  );
  
  // Call cast_vote with option_index
  const tx = await this.program.methods
    .castVote(
      computationOffset,
      pollId,
      optionIndex,              // NEW
      nonce
    )
    .accounts({ /* ... */ })
    .rpc();
  
  return tx;
}

// ============================================================================
// 4. EXAMPLE USAGE
// ============================================================================

// Create a poll with multiple options
await votingService.createPoll(
  "Which game should we play this week?",
  4,  // num_options
  ["Chess", "Go", "Checkers", "Backgammon"]  // option_labels
);

// User votes for "Go" (index 1)
await votingService.castVote(pollId, 1);

// Reveal results
await votingService.revealResults(pollId);
// → Returns: [15, 23, 8, 10]
//            Chess: 15, Go: 23 (winner), Checkers: 8, Backgammon: 10

// ============================================================================
// 5. CHALLENGES & CONSIDERATIONS
// ============================================================================

/**
 * Challenge 1: Circuit Size
 * - More options = larger circuits
 * - 10 options might push beyond 1MB limit
 * - Solution: Test with arcium build, optimize circuit
 */

/**
 * Challenge 2: Account Size
 * - option_labels and revealed_counts grow with num_options
 * - 10 options with 50-char labels = ~500 bytes just for labels
 * - Solution: Limit to 10 options max, or use fixed-size arrays
 */

/**
 * Challenge 3: MPC Computation Cost
 * - Larger voteState = more compute in MPC network
 * - May need higher compute budget
 * - Solution: Test on devnet, adjust compute units
 */

/**
 * Challenge 4: UI Complexity
 * - 10 buttons is cluttered
 * - Solution: Use dropdown for >5 options, or grid layout
 */

// ============================================================================
// 6. ALTERNATIVE: HYBRID APPROACH
// ============================================================================

/**
 * Keep circuits simple (YES/NO), use multiple polls for multi-choice
 * 
 * Example: "Which game?" becomes 4 separate polls:
 * - "Should we play Chess?"
 * - "Should we play Go?"
 * - "Should we play Checkers?"
 * - "Should we play Backgammon?"
 * 
 * Each user votes YES on one poll.
 * 
 * Pros:
 * - No circuit changes needed
 * - Simpler implementation
 * - Reuse existing code
 * 
 * Cons:
 * - User can vote YES on multiple (need to prevent in UI)
 * - More polls = more storage
 * - Doesn't feel like "one poll"
 */

// ============================================================================
// RECOMMENDATION
// ============================================================================

/**
 * START: Keep YES/NO, use it for binary decisions
 * - "Should we implement feature X?"
 * - "Do you agree with proposal Y?"
 * 
 * LATER: Add multi-option support if needed
 * - Requires new circuits (vote_multi.ts)
 * - Requires program changes (Poll struct, instructions)
 * - More complex but more flexible
 * 
 * CONSIDER: Use hybrid storage for "option polls"
 * - Store options in database
 * - Use YES/NO circuit for each option
 * - Frontend groups them visually
 */
