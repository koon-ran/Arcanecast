"use client";

import React, { useState, useEffect } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { VotingService } from "@/services/votingService";
import { PollAccount, RevealState } from "@/types";
import { PublicKey } from "@solana/web3.js";
import toast from "react-hot-toast";

interface RevealResultsProps {
  poll: PollAccount & { publicKey: PublicKey };
  onResultRevealed?: () => void;
}

interface RevealStatus {
  isRevealed: boolean;
  revealedAt?: string;
  winner?: 'yes' | 'no';
  totalVotes?: number;
}

export function RevealResults({ poll, onResultRevealed }: RevealResultsProps) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [revealState, setRevealState] = useState<RevealState | null>(null);
  const [result, setResult] = useState<boolean | null>(null);
  const [dbRevealStatus, setDbRevealStatus] = useState<RevealStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const isAuthority = wallet?.publicKey.equals(poll.authority);

  // Fetch reveal status from database on mount
  useEffect(() => {
    const fetchRevealStatus = async () => {
      try {
        const response = await fetch(`/api/polls/${poll.id}/reveal`);
        if (response.ok) {
          const status: RevealStatus = await response.json();
          setDbRevealStatus(status);
          
          // If already revealed in DB, set the result
          if (status.isRevealed && status.winner) {
            setResult(status.winner === 'yes');
          }
        } else if (response.status === 404) {
          // Poll exists on-chain but not in database (created before DB integration)
          // This is OK - just means no reveal status yet
          console.log(`Poll ${poll.id} not found in database (on-chain only)`);
          setDbRevealStatus({ isRevealed: false });
        }
      } catch (error) {
        console.error('Failed to fetch reveal status:', error);
        // Set default state on error
        setDbRevealStatus({ isRevealed: false });
      } finally {
        setLoadingStatus(false);
      }
    };

    fetchRevealStatus();
  }, [poll.id]);

  const handleReveal = async () => {
    if (!wallet) {
      toast.error("Wallet not connected");
      return;
    }

    if (!isAuthority) {
      toast.error("Only the poll creator can reveal results");
      return;
    }

    const toastId = toast.loading("Revealing results...");

    try {
      setRevealState({
        pollId: poll.id,
        computationOffset: null as any,
        status: "queued",
      });

      const votingService = new VotingService(connection, wallet);

      const revealedResult = await votingService.revealResults(
        poll.id,
        (state) => {
          setRevealState(state);

          if (state.status === "queued") {
            toast.loading("Queuing reveal computation...", { id: toastId });
          } else if (state.status === "processing") {
            toast.loading("Decrypting votes...", { id: toastId });
          }
        }
      );

      setResult(revealedResult);
      
      // Refetch reveal status from database to confirm storage
      const statusResponse = await fetch(`/api/polls/${poll.id}/reveal`);
      if (statusResponse.ok) {
        const status: RevealStatus = await statusResponse.json();
        setDbRevealStatus(status);
      }
      
      toast.success("Results revealed!", { id: toastId });
      onResultRevealed?.();
    } catch (error: any) {
      console.error("Failed to reveal results:", error);
      toast.error(error?.message || "Failed to reveal results", { id: toastId });
    } finally {
      setRevealState(null);
    }
  };

  // Loading state while checking database
  if (loadingStatus) {
    return (
      <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
        <p className="text-sm text-gray-400 text-center">
          Loading reveal status...
        </p>
      </div>
    );
  }

  // Show results if revealed (visible to EVERYONE)
  if (dbRevealStatus?.isRevealed || result !== null) {
    const winner = result !== null ? result : (dbRevealStatus?.winner === 'yes');
    
    return (
      <div className="p-6 bg-gradient-to-br from-purple-900/40 to-pink-900/40 border border-purple-500/30 rounded-xl">
        <h3 className="text-xl font-bold mb-4 text-center bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          🎉 Results Revealed!
        </h3>
        <div className="text-center">
          <div
            className={`inline-block px-8 py-6 rounded-2xl ${
              winner
                ? "bg-green-500/20 border-2 border-green-500"
                : "bg-red-500/20 border-2 border-red-500"
            }`}
          >
            <div className="text-6xl mb-3">{winner ? "👍" : "👎"}</div>
            <div className="text-3xl font-bold">
              {winner ? (
                <span className="text-green-400">YES WINS</span>
              ) : (
                <span className="text-red-400">NO WINS</span>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-4">
            The majority voted <strong>{winner ? "YES" : "NO"}</strong>
          </p>
          {dbRevealStatus?.totalVotes && (
            <p className="text-xs text-gray-500 mt-2">
              {dbRevealStatus.totalVotes} total participants
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Note: Individual vote counts remain confidential 🔒
          </p>
          {dbRevealStatus?.revealedAt && (
            <p className="text-xs text-gray-600 mt-2">
              Revealed on {new Date(dbRevealStatus.revealedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (revealState) {
    return (
      <div className="p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl">
        <div className="flex items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
          <div className="text-center">
            <p className="font-medium text-blue-400">
              {revealState.status === "queued" && "Queuing reveal computation..."}
              {revealState.status === "processing" && "Decrypting votes via MPC..."}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              This may take a few seconds
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthority) {
    return (
      <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
        <p className="text-sm text-gray-400 text-center">
          🔒 Results can only be revealed by the poll creator
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={handleReveal}
      disabled={!wallet}
      className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-semibold text-white shadow-lg hover:shadow-purple-500/50 transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100"
    >
      <span className="flex items-center justify-center gap-2">
        <span className="text-xl">🔓</span>
        Reveal Results
      </span>
    </button>
  );
}
