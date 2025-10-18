'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';

interface ProposePollModalProps {
  onClose: () => void;
}

export default function ProposePollModal({ onClose }: ProposePollModalProps) {
  const { publicKey } = useWallet();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addOption = () => {
    if (options.length < 4) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!publicKey) {
      toast.error('Please connect your wallet');
      return;
    }

    // Validate inputs
    if (question.trim().length < 10) {
      toast.error('Question must be at least 10 characters');
      return;
    }

    if (question.trim().length > 100) {
      toast.error('Question must be less than 100 characters');
      return;
    }

    const validOptions = options.filter(opt => opt.trim().length > 0);
    if (validOptions.length < 2) {
      toast.error('Please provide at least 2 options');
      return;
    }

    if (validOptions.some(opt => opt.length > 50)) {
      toast.error('Each option must be less than 50 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/dao/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          options: validOptions.map(opt => opt.trim()),
          creator_wallet: publicKey.toString(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create poll');
      }

      const data = await response.json();
      toast.success(`Poll created! +5 points`);
      onClose();
    } catch (error: any) {
      console.error('Error creating poll:', error);
      toast.error(error.message || 'Failed to create poll');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-purple-500/30 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Propose a Poll</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Question */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Poll Question *
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What should we build next?"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
              maxLength={100}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {question.length}/100 characters
            </p>
          </div>

          {/* Options */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Options (2-4) *
            </label>
            <div className="space-y-3">
              {options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                    maxLength={50}
                    required
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 4 && (
              <button
                type="button"
                onClick={addOption}
                className="mt-3 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-purple-400 rounded-lg transition-colors border border-gray-700"
              >
                + Add Option
              </button>
            )}
          </div>

          {/* Info */}
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-purple-300 mb-2">
              💡 Nomination Process
            </h4>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Your proposal enters the nomination section</li>
              <li>• Community members can select up to 5 proposals per week</li>
              <li>• Top 5 most selected proposals advance to voting on Monday</li>
              <li>• You'll earn 5 points for creating this proposal</li>
              <li>• Earn 10 bonus points if your proposal gets selected!</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Proposal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
