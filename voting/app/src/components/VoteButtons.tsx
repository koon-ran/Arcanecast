"use client";

import React, { useState, useEffect } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { useArcium } from "@/contexts/ArciumContext";
import { VotingService } from "@/services/votingService";
import { PollAccount, VoteState } from "@/types";
import { PublicKey } from "@solana/web3.js";
import toast from "react-hot-toast";
import { hasVoted as checkHasVoted, getVote as getStoredVote, saveVote as saveVoteToStorage } from "@/utils/voteStorage";

interface VoteButtonsProps {
  poll: PollAccount & { publicKey: PublicKey };
  onVoteCast?: () => void;
}

export function VoteButtons({ poll, onVoteCast }: VoteButtonsProps) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { cipher, clientPublicKey, isReady } = useArcium();

  const [voteState, setVoteState] = useState<VoteState | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [userVote, setUserVote] = useState<boolean | null>(null);

  // Check if user has already voted on mount and when wallet changes
  useEffect(() => {
    if (wallet?.publicKey) {
      const voted = checkHasVoted(poll.authority.toString(), poll.id);
      setHasVoted(voted);
      if (voted) {
        const voteRecord = getStoredVote(poll.authority.toString(), poll.id);
        setUserVote(voteRecord ? voteRecord.vote === "yes" : null);
      }
    }
  }, [poll.id, poll.authority, wallet?.publicKey]);

  const handleVote = async (choice: boolean) => {
    if (!wallet || !cipher || !clientPublicKey || !isReady) {
      toast.error("Encryption not ready");
      return;
    }

    // Check if already voted
    if (hasVoted) {
      const existingVote = getStoredVote(poll.authority.toString(), poll.id);
      const voteType = existingVote?.vote === "yes" ? "YES" : "NO";
      toast.error(`You have already voted ${voteType} on this poll`);
      return;
    }

    const toastId = toast.loading(
      choice ? "Casting YES vote..." : "Casting NO vote..."
    );

    try {
      setVoteState({
        pollId: poll.id,
        computationOffset: null as any,
        status: "encrypting",
        txSignatures: {},
      });

      const votingService = new VotingService(connection, wallet);

      const signature = await votingService.castVote(
        poll.id,
        choice,
        cipher,
        clientPublicKey,
        poll.authority,
        (state) => {
          setVoteState(state);

          if (state.status === "queued") {
            toast.loading("Vote encrypted, queuing computation...", {
              id: toastId,
            });
          } else if (state.status === "processing") {
            toast.loading("Secure computation in progress...", { id: toastId });
          }
        }
      );

      // Save the vote to localStorage
      saveVoteToStorage(
        poll.authority.toString(),
        poll.id,
        choice ? "yes" : "no",
        signature
      );

      const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
      toast.success(
        <div>
          <p>{choice ? "YES" : "NO"} vote confirmed! Your vote is encrypted onchain.</p>
          <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-sm">
            View Transaction
          </a>
        </div>,
        { id: toastId, duration: 7000 }
      );

      setHasVoted(true);
      setUserVote(choice);
      setVoteState(null);
      onVoteCast?.();
    } catch (error: any) {
      console.error("Failed to cast vote:", error);
      toast.error(error?.message || "Failed to cast vote", { id: toastId });
      setVoteState(null);
    }
  };

  const isVoting = voteState !== null;

  if (hasVoted) {
    return (
      <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
            <span className="text-2xl">✓</span>
          </div>
          <div>
            <p className="font-semibold text-green-400">Vote Cast Successfully</p>
            <p className="text-sm text-gray-400">
              Your encrypted vote has been recorded
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Show if user has already voted */}
      {hasVoted && userVote !== null && (
        <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
          <p className="text-sm text-purple-300">
            ✅ You voted <strong>{userVote ? "YES" : "NO"}</strong> on this poll
          </p>
        </div>
      )}

      {isVoting && voteState && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
            <div>
              <p className="text-sm font-medium text-blue-400">
                {voteState.status === "encrypting" && "🔐 Encrypting your vote..."}
                {voteState.status === "queued" && "📤 Submitting to blockchain..."}
                {voteState.status === "processing" && "⚙️ Secure computation in progress..."}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                This ensures your vote remains completely confidential
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => handleVote(true)}
          disabled={!isReady || isVoting || !wallet}
          className="py-4 px-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-semibold text-white shadow-lg hover:shadow-green-500/50 transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100"
        >
          <span className="text-2xl mb-1 block">👍</span>
          Vote YES
        </button>

        <button
          onClick={() => handleVote(false)}
          disabled={!isReady || isVoting || !wallet}
          className="py-4 px-6 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-semibold text-white shadow-lg hover:shadow-red-500/50 transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100"
        >
          <span className="text-2xl mb-1 block">👎</span>
          Vote NO
        </button>
      </div>

      {!isReady && (
        <p className="text-xs text-center text-yellow-400">
          ⏳ Initializing encryption...
        </p>
      )}
    </div>
  );
}
