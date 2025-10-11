"use client";

import React from "react";
import { PollAccount } from "@/types";
import { PublicKey } from "@solana/web3.js";
import { VoteButtons } from "./VoteButtons";
import { RevealResults } from "./RevealResults";
import { shortenAddress } from "@/utils/helpers";

interface PollCardProps {
  poll: PollAccount & { publicKey: PublicKey };
  onUpdate?: () => void;
}

export function PollCard({ poll, onUpdate }: PollCardProps) {
  // Import at top of file: import { getVote } from "@/utils/voteStorage";
  const userVote = typeof window !== 'undefined' ? 
    require('@/utils/voteStorage').getVote(poll.authority, poll.id) : null;

  return (
    <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 shadow-xl hover:border-purple-500/30 transition-all duration-300">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block px-3 py-1 bg-purple-500/20 text-purple-400 text-xs font-semibold rounded-full">
                Poll #{poll.id}
              </span>
              {userVote && (
                <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${
                  userVote.vote === 'yes' 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  You voted: {userVote.vote.toUpperCase()}
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold text-white">{poll.question}</h3>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>Creator:</span>
          <code className="px-2 py-1 bg-black/40 rounded text-purple-400">
            {shortenAddress(poll.authority)}
          </code>
        </div>
      </div>

      {/* Encrypted Vote State Indicator */}
      <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
              <span className="text-2xl">🔒</span>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-purple-400">
              Confidential Voting Active
            </p>
            <p className="text-xs text-gray-400 mt-1">
              All votes are encrypted • Tallies hidden until reveal
            </p>
          </div>
        </div>
      </div>

      {/* Vote Buttons */}
      <div className="mb-4">
        <VoteButtons poll={poll} onVoteCast={onUpdate} />
      </div>

      {/* Divider */}
      <div className="my-6 border-t border-gray-700/50" />

      {/* Reveal Results */}
      <RevealResults poll={poll} onResultRevealed={onUpdate} />
    </div>
  );
}
