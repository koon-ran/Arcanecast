'use client';

import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useArcium } from '@/contexts/ArciumContext';
import { DAOVotingService, MultiOptionVoteState } from '@/services/daoVotingService';
import toast from 'react-hot-toast';

interface DAOPoll {
  id: string;
  question: string;
  options: string[];
  onchain_id: number | null;
  deadline: string;
  created_at: string;
}

// Admin wallet for testing reveal functionality
const ADMIN_WALLET = '5sQaKhsTc8RvgnNgLCYB2Y44dirFBZxQWKZy7nVomYe4';

export default function VotingSection() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const { cipher, isReady, clientPublicKey } = useArcium();
  const [polls, setPolls] = useState<DAOPoll[]>([]);
  const [votedPolls, setVotedPolls] = useState<Set<string>>(new Set());
  const [votingPollId, setVotingPollId] = useState<string | null>(null);
  const [voteStatus, setVoteStatus] = useState<MultiOptionVoteState | null>(null);
  const [revealingPollId, setRevealingPollId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if connected wallet is admin
  const isAdmin = connected && publicKey?.toString() === ADMIN_WALLET;

  useEffect(() => {
    fetchPolls();
  }, []);

  useEffect(() => {
    if (connected && publicKey) {
      checkVotedPolls();
    } else {
      setVotedPolls(new Set());
    }
  }, [connected, publicKey, polls]);

  const fetchPolls = async () => {
    try {
      const response = await fetch('/api/dao/polls?section=voting');
      if (!response.ok) throw new Error('Failed to fetch polls');
      const data = await response.json();
      setPolls(data.polls || []);
    } catch (error) {
      console.error('Error fetching polls:', error);
      toast.error('Failed to load voting polls');
    } finally {
      setIsLoading(false);
    }
  };

  const checkVotedPolls = async () => {
    if (!publicKey || polls.length === 0) return;

    try {
      const voted = new Set<string>();
      for (const poll of polls) {
        const response = await fetch(
          `/api/dao/voting-records?poll_id=${poll.id}&wallet=${publicKey.toString()}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.has_voted) {
            voted.add(poll.id);
          }
        }
      }
      setVotedPolls(voted);
    } catch (error) {
      console.error('Error checking voted polls:', error);
    }
  };

  const handleVote = async (pollId: string, optionIndex: number) => {
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!cipher || !isReady || !clientPublicKey) {
      toast.error('Encryption not ready. Please wait a moment and try again.');
      return;
    }

    // Find the poll to get onchain_id
    const poll = polls.find(p => p.id === pollId);
    if (!poll || !poll.onchain_id) {
      toast.error('Poll not found on-chain. Please try another poll.');
      return;
    }

    setVotingPollId(pollId);
    const toastId = toast.loading('Encrypting your vote...');

    try {
      // Initialize voting service
      const votingService = new DAOVotingService(connection, { publicKey });

      // Cast encrypted vote with status updates
      const signature = await votingService.castMultiOptionVote(
        poll.onchain_id,
        optionIndex,
        cipher,
        clientPublicKey,
        (status: MultiOptionVoteState) => {
          setVoteStatus(status);
          
          // Update toast based on status
          switch (status.status) {
            case 'encrypting':
              toast.loading('Encrypting your vote...', { id: toastId });
              break;
            case 'queued':
              toast.loading('Submitting to blockchain...', { id: toastId });
              break;
            case 'processing':
              toast.loading('Processing with MPC...', { id: toastId });
              break;
            case 'confirmed':
              toast.success(`Vote cast! +3 points`, { id: toastId, duration: 4000 });
              break;
            case 'error':
              toast.error(status.error || 'Failed to cast vote', { id: toastId });
              break;
          }
        }
      );

      console.log(`[Vote] Transaction signature: ${signature}`);

      // Record vote in database and award points
      const response = await fetch('/api/dao/voting-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poll_id: pollId,
          wallet: publicKey.toString(),
          tx_signature: signature,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.warn('Failed to record vote in database:', error);
        // Don't fail - vote is on-chain, DB is supplementary
      } else {
        console.log('[Vote] Recorded in database and points awarded');
      }

      // Update local state
      setVotedPolls(new Set(Array.from(votedPolls).concat(pollId)));
      
      // Show explorer link
      const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
      setTimeout(() => {
        toast.success(
          <div>
            Vote submitted successfully!
            <a 
              href={explorerUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block mt-1 text-purple-300 hover:text-purple-200 underline text-sm"
            >
              View transaction
            </a>
          </div>,
          { duration: 8000 }
        );
      }, 1000);

    } catch (error: any) {
      console.error('Error voting:', error);
      toast.error(error.message || 'Failed to cast vote', { id: toastId });
    } finally {
      setVotingPollId(null);
      setVoteStatus(null);
    }
  };

  const handleAdminReveal = async (pollId: string) => {
    if (!connected || !publicKey || !isAdmin) {
      toast.error('Only admin can reveal results');
      return;
    }

    const poll = polls.find(p => p.id === pollId);
    if (!poll || !poll.onchain_id) {
      toast.error('Poll not found on-chain');
      return;
    }

    setRevealingPollId(pollId);
    const toastId = toast.loading('Revealing results...');

    try {
      // Call auto-reveal cron endpoint (it will process this poll)
      const response = await fetch('/api/cron/auto-reveal', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || '+4POpZLg5ljQ6DhEH4unOAGDh/pKsjswdiRxQoF4nik='}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reveal results');
      }

      const result = await response.json();
      console.log('[Admin Reveal] Result:', result);

      toast.success('Results revealed! Check Completed section.', { id: toastId, duration: 4000 });
      
      // Refresh polls to update UI
      setTimeout(() => {
        fetchPolls();
      }, 2000);

    } catch (error: any) {
      console.error('Error revealing:', error);
      toast.error(error.message || 'Failed to reveal results', { id: toastId });
    } finally {
      setRevealingPollId(null);
    }
  };

  const getTimeRemaining = (deadline: string) => {
    const now = new Date();
    const end = new Date(deadline);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return 'Ended';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Active Voting Polls</h2>
        <p className="text-gray-400 text-sm mt-1">
          Cast your confidential vote on the top proposals
        </p>
      </div>

      {/* Admin Badge */}
      {isAdmin && (
        <div className="mb-6 bg-gradient-to-r from-orange-900/30 to-red-900/30 border border-orange-500/50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👑</span>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-orange-300 mb-1">
                Admin Mode Active
              </h4>
              <p className="text-xs text-gray-400">
                You can reveal poll results immediately using the "Admin: Reveal Now" button below each poll.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      {connected && !isReady && (
        <div className="mb-6 bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⏳</span>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-yellow-300 mb-1">
                Initializing Encryption...
              </h4>
              <p className="text-xs text-gray-400">
                Please wait while we set up MPC encryption for confidential voting. This may take a few moments.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {connected && isReady && (
        <div className="mb-6 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔒</span>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-300 mb-1">
                Confidential Voting Ready
              </h4>
              <p className="text-xs text-gray-400">
                Your vote is encrypted using MPC technology. Only the final counts are revealed, never individual votes. Earn 3 points for participating.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Polls List */}
      {polls.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg">No active polls</p>
          <p className="text-gray-500 text-sm mt-2">
            Polls will appear here on Monday after nomination closes
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {polls.map((poll) => {
            const hasVoted = votedPolls.has(poll.id);
            const isVoting = votingPollId === poll.id;
            const timeRemaining = getTimeRemaining(poll.deadline);

            return (
              <div
                key={poll.id}
                className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 backdrop-blur-sm"
              >
                {/* Header with Timer */}
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-semibold text-white flex-1">
                    {poll.question}
                  </h3>
                  <div className="ml-4 bg-purple-900/30 border border-purple-500/30 px-4 py-2 rounded-lg">
                    <div className="text-xs text-gray-400">Ends in</div>
                    <div className="text-sm font-semibold text-purple-300">
                      {timeRemaining}
                    </div>
                  </div>
                </div>

                {/* Voting Options */}
                <div className="space-y-3 mb-4">
                  {poll.options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleVote(poll.id, idx)}
                      disabled={!connected || !isReady || hasVoted || isVoting}
                      className={`w-full px-6 py-4 rounded-lg text-left transition-all border-2 ${
                        hasVoted
                          ? 'bg-gray-900/50 border-gray-700 text-gray-500 cursor-not-allowed'
                          : !isReady
                          ? 'bg-gray-900/50 border-gray-700 text-gray-500 cursor-not-allowed'
                          : 'bg-gray-900/70 border-gray-600 hover:border-purple-500 hover:bg-purple-900/20 text-white'
                      } ${isVoting ? 'opacity-50 cursor-wait' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-bold text-purple-400">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className="font-medium">{option}</span>
                        </div>
                        {hasVoted && (
                          <span className="text-green-400 text-sm">✓ Voted</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-700">
                  <div className="text-sm text-gray-400">
                    Started {new Date(poll.created_at).toLocaleDateString()}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {!connected && (
                      <div className="text-gray-500 text-sm">
                        Connect wallet to vote
                      </div>
                    )}
                    
                    {connected && hasVoted && !isAdmin && (
                      <div className="text-green-400 text-sm font-medium">
                        ✓ You voted on this poll
                      </div>
                    )}

                    {/* Admin Reveal Button */}
                    {isAdmin && (
                      <button
                        onClick={() => handleAdminReveal(poll.id)}
                        disabled={revealingPollId === poll.id}
                        className="px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white shadow-lg transition-all duration-300"
                      >
                        {revealingPollId === poll.id ? (
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Revealing...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <span>🔓</span>
                            <span>Admin: Reveal Now</span>
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
