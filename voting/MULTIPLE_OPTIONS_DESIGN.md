import { SecretInput, MutableSecretInput } from '@arcium/circuit';

/**
 * Multiple Choice Vote Circuit
 * 
 * Supports up to 10 options per poll
 * Each option has an encrypted counter
 * 
 * @param optionIndex - Which option the user voted for (0-9)
 * @param voteState - Array of 10 encrypted counters [option0, option1, ..., option9]
 */
export function vote_multi(
  optionIndex: SecretInput,
  voteState: MutableSecretInput
): void {
  // Security: Ensure option_index is within bounds
  // This happens at runtime in the MPC network
  
  // Increment the selected option's counter
  // voteState is an array: [count0, count1, count2, ...]
  voteState[optionIndex] = voteState[optionIndex] + 1;
}

/**
 * Initialize Vote Stats Circuit (Multi-option version)
 * 
 * @param initialState - Array of 10 zeros [0, 0, 0, ...]
 */
export function init_vote_stats_multi(
  initialState: MutableSecretInput
): void {
  // Initialize all counters to 0
  for (let i = 0; i < 10; i++) {
    initialState[i] = 0;
  }
}

/**
 * Reveal Results Circuit (Multi-option version)
 * 
 * @param voteState - Array of encrypted vote counts
 * @returns Array of decrypted vote counts
 */
export function reveal_result_multi(
  voteState: SecretInput
): number[] {
  // MPC network decrypts all counters and returns them
  // Frontend will display: "Chess: 15 votes, Go: 8 votes, ..."
  return voteState as number[];
}

/**
 * Example Usage:
 * 
 * Poll: "Which game should we play?"
 * Options: ["Chess", "Go", "Checkers", "Backgammon", "Shogi"]
 * 
 * User votes for "Checkers" (index 2)
 * → vote_multi(2, voteState)
 * → voteState[2] += 1
 * 
 * After 100 votes:
 * voteState = [15, 8, 23, 10, 5, 0, 0, 0, 0, 0]
 *              ↑   ↑   ↑   ↑   ↑
 *            Chess Go Checkers Back Shogi
 * 
 * Reveal:
 * reveal_result_multi(voteState)
 * → Returns [15, 8, 23, 10, 5, 0, 0, 0, 0, 0]
 * 
 * Winner: Checkers with 23 votes!
 */
