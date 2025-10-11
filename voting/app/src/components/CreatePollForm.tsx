"use client";

import React, { useState } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { useArcium } from "@/contexts/ArciumContext";
import { VotingService } from "@/services/votingService";
import { MAX_QUESTION_LENGTH } from "@/config/constants";
import toast from "react-hot-toast";

export function CreatePollForm({ onPollCreated }: { onPollCreated?: () => void }) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { cipher, isReady } = useArcium();

  const [question, setQuestion] = useState("");
  const [pollId, setPollId] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!wallet || !cipher || !isReady) {
      toast.error("Please wait for encryption to be ready");
      return;
    }

    if (question.length > MAX_QUESTION_LENGTH) {
      toast.error(`Question must be ${MAX_QUESTION_LENGTH} characters or less`);
      return;
    }

    if (!pollId || isNaN(Number(pollId))) {
      toast.error("Please enter a valid poll ID");
      return;
    }

    setIsCreating(true);
    const toastId = toast.loading("Creating confidential poll...");

    try {
      const votingService = new VotingService(connection, wallet);
      const { signature, pollAddress } = await votingService.createPoll(
        Number(pollId),
        question,
        cipher
      );

      const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
      toast.success(
        <div>
          Poll created successfully! 
          <a 
            href={explorerUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="block mt-1 text-purple-300 hover:text-purple-200 underline"
          >
            View transaction
          </a>
        </div>,
        { id: toastId, duration: 8000 }
      );

      // Reset form
      setQuestion("");
      setPollId("");
      
      onPollCreated?.();
    } catch (error: any) {
      console.error("Failed to create poll:", error);
      toast.error(error?.message || "Failed to create poll", { id: toastId });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/20 shadow-2xl">
      <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
        Create Confidential Poll
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Poll ID
          </label>
          <input
            type="number"
            value={pollId}
            onChange={(e) => setPollId(e.target.value)}
            placeholder="Enter unique poll ID (e.g., 1, 2, 3...)"
            className="w-full px-4 py-3 bg-black/40 border border-purple-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
            disabled={isCreating}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Question ({question.length}/{MAX_QUESTION_LENGTH})
          </label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g., Should we approve the new proposal?"
            maxLength={MAX_QUESTION_LENGTH}
            className="w-full px-4 py-3 bg-black/40 border border-purple-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
            disabled={isCreating}
            required
          />
          <p className="mt-2 text-xs text-gray-400">
            Voters will answer YES or NO to this question
          </p>
        </div>

        {!isReady && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            <p className="text-sm text-yellow-400">
              ⏳ Waiting for encryption to initialize...
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={!isReady || isCreating || !wallet}
          className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-semibold text-white shadow-lg hover:shadow-purple-500/50 transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100"
        >
          {isCreating ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating Poll...
            </span>
          ) : (
            "Create Poll"
          )}
        </button>
      </form>

      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
        <h3 className="text-sm font-semibold text-blue-400 mb-2">🔐 Privacy Features</h3>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>✓ All votes are encrypted end-to-end</li>
          <li>✓ Vote tallies remain confidential until you reveal them</li>
          <li>✓ Only you (the creator) can reveal results</li>
          <li>✓ Powered by secure multi-party computation</li>
        </ul>
      </div>
    </div>
  );
}
