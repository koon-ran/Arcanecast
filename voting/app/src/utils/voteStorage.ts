/**
 * Client-side storage for tracking votes
 * Since the on-chain program doesn't track individual voters,
 * we use localStorage as a workaround
 */

interface VoteRecord {
  pollId: number;
  pollAuthority: string;
  vote: "yes" | "no";
  timestamp: number;
  signature: string;
}

const STORAGE_KEY = "arcanecast_votes";

export function hasVoted(pollAuthority: string, pollId: number): boolean {
  const votes = getVotes();
  return votes.some(
    (v) => v.pollAuthority === pollAuthority && v.pollId === pollId
  );
}

export function getVote(pollAuthority: string, pollId: number): VoteRecord | null {
  const votes = getVotes();
  return votes.find(
    (v) => v.pollAuthority === pollAuthority && v.pollId === pollId
  ) || null;
}

export function saveVote(
  pollAuthority: string,
  pollId: number,
  vote: "yes" | "no",
  signature: string
): void {
  const votes = getVotes();
  
  // Remove any existing vote for this poll
  const filtered = votes.filter(
    (v) => !(v.pollAuthority === pollAuthority && v.pollId === pollId)
  );
  
  // Add new vote
  filtered.push({
    pollAuthority,
    pollId,
    vote,
    timestamp: Date.now(),
    signature,
  });
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function getVotes(): VoteRecord[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function clearVotes(): void {
  localStorage.removeItem(STORAGE_KEY);
}
