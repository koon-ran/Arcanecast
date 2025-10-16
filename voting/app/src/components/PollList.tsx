"use client";

import React, { useState, useEffect } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { VotingService } from "@/services/votingService";
import { PollCard } from "./PollCard";
import { PublicKey } from "@solana/web3.js";
import toast from "react-hot-toast";

export function PollList() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterAuthority, setFilterAuthority] = useState<string>("");

  const fetchPolls = async () => {
    if (!wallet) return;

    setLoading(true);
    try {
      const votingService = new VotingService(connection, wallet);
      
      let fetchedPolls;
      if (filterAuthority) {
        try {
          const authorityPubkey = new PublicKey(filterAuthority);
          fetchedPolls = await votingService.fetchPollsByAuthority(authorityPubkey);
        } catch (error) {
          toast.error("Invalid authority address");
          return;
        }
      } else {
        // Fetch ALL polls (globally accessible)
        fetchedPolls = await votingService.fetchAllPolls();
      }

      setPolls(
        fetchedPolls.map((p) => ({
          ...p.account,
          publicKey: p.publicKey,
        }))
      );
    } catch (error: any) {
      console.error("Failed to fetch polls:", error);
      // Don't show error toast for empty results
      if (!error.message?.includes("Account does not exist")) {
        toast.error("Failed to fetch polls");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolls();
  }, [wallet, connection]);

  if (!wallet) {
    return (
      <div className="text-center py-12">
        <div className="inline-block p-8 bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-2xl border border-purple-500/20">
          <div className="text-6xl mb-4">👛</div>
          <h3 className="text-xl font-bold text-white mb-2">
            Connect Your Wallet
          </h3>
          <p className="text-gray-400">
            Connect your wallet to view and participate in polls
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Filter Section */}
      <div className="mb-8 p-6 bg-gradient-to-br from-gray-900/80 to-gray-800/80 rounded-2xl border border-gray-700/50">
        <h3 className="text-lg font-bold text-white mb-4">Filter Polls</h3>
        <div className="flex gap-4">
          <input
            type="text"
            value={filterAuthority}
            onChange={(e) => setFilterAuthority(e.target.value)}
            placeholder="Enter creator's address (or leave empty for your polls)"
            className="flex-1 px-4 py-3 bg-black/40 border border-purple-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
          />
          <button
            onClick={fetchPolls}
            disabled={loading}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 rounded-xl font-semibold text-white transition-all"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Loading...
              </span>
            ) : (
              "Refresh"
            )}
          </button>
        </div>
      </div>

      {/* Polls Grid */}
      {loading && polls.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-block w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4" />
          <p className="text-gray-400">Loading polls...</p>
        </div>
      ) : polls.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-block p-8 bg-gradient-to-br from-gray-900/80 to-gray-800/80 rounded-2xl border border-gray-700/50">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-white mb-2">No Polls Found</h3>
            <p className="text-gray-400">
              {filterAuthority
                ? "This address hasn't created any polls yet"
                : "Create your first poll to get started!"}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {polls.map((poll) => (
            <PollCard key={poll.publicKey.toBase58()} poll={poll} onUpdate={fetchPolls} />
          ))}
        </div>
      )}
    </div>
  );
}
