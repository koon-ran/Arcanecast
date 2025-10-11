/**
 * Hybrid Storage Service
 * 
 * Combines on-chain confidential voting with off-chain metadata storage
 * 
 * Architecture:
 * 1. On-chain: Encrypted votes, MPC computation, verifiable results
 * 2. Off-chain: Poll metadata, user participation tracking, fast queries
 */

export interface PollMetadata {
  pollId: string;
  authority: string; // Creator's wallet
  question: string;
  createdAt: number; // timestamp
  txSignature: string; // Creation transaction
  status: "active" | "revealed" | "closed";
}

export interface VoteRecord {
  pollId: string;
  wallet: string;
  timestamp: number;
  txSignature: string; // Vote transaction (proof)
  // NOTE: Actual vote choice is encrypted on-chain, not stored here
}

export class PollDatabaseService {
  private apiUrl: string;

  constructor(apiUrl: string = "/api") {
    this.apiUrl = apiUrl;
  }

  /**
   * Store poll metadata after on-chain creation
   */
  async storePollMetadata(metadata: PollMetadata): Promise<void> {
    const response = await fetch(`${this.apiUrl}/polls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metadata),
    });

    if (!response.ok) {
      throw new Error("Failed to store poll metadata");
    }
  }

  /**
   * Record that a user voted (without revealing their choice)
   */
  async recordVoteParticipation(record: VoteRecord): Promise<void> {
    const response = await fetch(`${this.apiUrl}/votes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });

    if (!response.ok) {
      throw new Error("Failed to record vote");
    }
  }

  /**
   * Check if user has voted on a poll
   */
  async hasUserVoted(pollId: string, wallet: string): Promise<boolean> {
    const response = await fetch(
      `${this.apiUrl}/votes/${pollId}/${wallet}`
    );
    
    if (response.status === 404) {
      return false;
    }

    if (!response.ok) {
      throw new Error("Failed to check vote status");
    }

    const data = await response.json();
    return data.hasVoted;
  }

  /**
   * Get all active polls (fast query, no blockchain scanning)
   */
  async getActivePolls(): Promise<PollMetadata[]> {
    const response = await fetch(`${this.apiUrl}/polls?status=active`);
    
    if (!response.ok) {
      throw new Error("Failed to fetch polls");
    }

    return response.json();
  }

  /**
   * Get polls created by a specific user
   */
  async getPollsByCreator(wallet: string): Promise<PollMetadata[]> {
    const response = await fetch(`${this.apiUrl}/polls?creator=${wallet}`);
    
    if (!response.ok) {
      throw new Error("Failed to fetch creator polls");
    }

    return response.json();
  }

  /**
   * Get polls a user has participated in
   */
  async getUserVotingHistory(wallet: string): Promise<VoteRecord[]> {
    const response = await fetch(`${this.apiUrl}/votes/history/${wallet}`);
    
    if (!response.ok) {
      throw new Error("Failed to fetch voting history");
    }

    return response.json();
  }

  /**
   * Update poll status after reveal
   */
  async updatePollStatus(
    pollId: string,
    status: "revealed" | "closed"
  ): Promise<void> {
    const response = await fetch(`${this.apiUrl}/polls/${pollId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      throw new Error("Failed to update poll status");
    }
  }
}

/**
 * Usage Example:
 * 
 * const dbService = new PollDatabaseService();
 * 
 * // After creating poll on-chain
 * await dbService.storePollMetadata({
 *   pollId: "12345",
 *   authority: wallet.publicKey.toString(),
 *   question: "Should we...",
 *   createdAt: Date.now(),
 *   txSignature: signature,
 *   status: "active"
 * });
 * 
 * // After voting on-chain
 * await dbService.recordVoteParticipation({
 *   pollId: "12345",
 *   wallet: wallet.publicKey.toString(),
 *   timestamp: Date.now(),
 *   txSignature: voteSignature
 * });
 * 
 * // Check if user voted
 * const hasVoted = await dbService.hasUserVoted("12345", wallet.toString());
 * 
 * // Get all active polls (no blockchain scan needed!)
 * const polls = await dbService.getActivePolls();
 */
