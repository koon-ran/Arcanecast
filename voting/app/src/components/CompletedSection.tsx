'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface DAOPoll {
  id: string;
  question: string;
  options: string[];
  vote_counts: number[] | null;
  revealed_at: string | null;
  completed_at: string;
  created_at: string;
}

export default function CompletedSection() {
  const [polls, setPolls] = useState<DAOPoll[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPolls();
  }, []);

  const fetchPolls = async () => {
    try {
      const response = await fetch('/api/dao/polls?section=completed');
      if (!response.ok) throw new Error('Failed to fetch polls');
      const data = await response.json();
      setPolls(data.polls || []);
    } catch (error) {
      console.error('Error fetching polls:', error);
      toast.error('Failed to load completed polls');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateResults = (poll: DAOPoll) => {
    if (!poll.vote_counts || poll.vote_counts.length === 0) {
      return { results: [], total: 0, winner: null };
    }

    const total = poll.vote_counts.reduce((sum, count) => sum + count, 0);
    const maxVotes = Math.max(...poll.vote_counts);
    const winnerIndex = poll.vote_counts.indexOf(maxVotes);

    const results = poll.vote_counts.map((count, idx) => ({
      option: poll.options[idx],
      votes: count,
      percentage: total > 0 ? (count / total) * 100 : 0,
      isWinner: idx === winnerIndex && count > 0,
    }));

    return { results, total, winner: results[winnerIndex] };
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
        <h2 className="text-2xl font-bold text-white">Completed Polls</h2>
        <p className="text-gray-400 text-sm mt-1">
          View the decrypted results of past DAO votes
        </p>
      </div>

      {/* Polls List */}
      {polls.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg">No completed polls yet</p>
          <p className="text-gray-500 text-sm mt-2">
            Check back after the first voting period ends
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {polls.map((poll) => {
            const { results, total, winner } = calculateResults(poll);
            const isRevealed = poll.revealed_at !== null;

            return (
              <div
                key={poll.id}
                className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 backdrop-blur-sm"
              >
                {/* Question */}
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {poll.question}
                  </h3>
                  {winner && (
                    <div className="inline-flex items-center gap-2 bg-green-900/30 border border-green-500/30 px-3 py-1 rounded-full">
                      <span className="text-xs text-green-400">🏆 Winner:</span>
                      <span className="text-sm font-semibold text-white">
                        {winner.option}
                      </span>
                    </div>
                  )}
                </div>

                {/* Results */}
                {isRevealed ? (
                  <div className="space-y-3 mb-4">
                    {results.map((result, idx) => (
                      <div
                        key={idx}
                        className={`relative overflow-hidden rounded-lg border-2 ${
                          result.isWinner
                            ? 'border-green-500 bg-green-900/20'
                            : 'border-gray-700 bg-gray-900/50'
                        }`}
                      >
                        {/* Progress Bar */}
                        <div
                          className={`absolute inset-0 ${
                            result.isWinner
                              ? 'bg-green-500/20'
                              : 'bg-purple-500/10'
                          } transition-all`}
                          style={{ width: `${result.percentage}%` }}
                        />

                        {/* Content */}
                        <div className="relative px-6 py-4 flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-2xl font-bold ${
                                result.isWinner
                                  ? 'text-green-400'
                                  : 'text-purple-400'
                              }`}
                            >
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span className="font-medium text-white">
                              {result.option}
                            </span>
                            {result.isWinner && (
                              <span className="text-green-400 text-lg">👑</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-right">
                            <div>
                              <div className="text-2xl font-bold text-white">
                                {result.percentage.toFixed(1)}%
                              </div>
                              <div className="text-xs text-gray-400">
                                {result.votes} {result.votes === 1 ? 'vote' : 'votes'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-6 text-center mb-4">
                    <div className="text-yellow-400 text-lg mb-2">⏳</div>
                    <p className="text-yellow-300 font-medium mb-1">
                      Results Pending
                    </p>
                    <p className="text-xs text-gray-400">
                      Votes are being decrypted and will be revealed soon
                    </p>
                  </div>
                )}

                {/* Footer */}
                <div className="pt-4 border-t border-gray-700">
                  <div className="flex justify-between items-center text-sm text-gray-400">
                    <div className="flex gap-4">
                      <span>
                        Started {new Date(poll.created_at).toLocaleDateString()}
                      </span>
                      <span>
                        Completed {new Date(poll.completed_at).toLocaleDateString()}
                      </span>
                    </div>
                    {isRevealed && (
                      <div className="text-purple-400 font-medium">
                        {total} total {total === 1 ? 'vote' : 'votes'}
                      </div>
                    )}
                  </div>
                  {isRevealed && poll.revealed_at && (
                    <div className="mt-2 text-xs text-gray-500">
                      Revealed {new Date(poll.revealed_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
