'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletButton } from '@/components/WalletButton';
import NominationSection from '@/components/NominationSection';
import VotingSection from '@/components/VotingSection';
import CompletedSection from '@/components/CompletedSection';
import ProposePollModal from '@/components/ProposePollModal';

type Section = 'nomination' | 'voting' | 'completed';

export default function DAOPage() {
  const { connected } = useWallet();
  const [activeSection, setActiveSection] = useState<Section>('nomination');
  const [showProposeModal, setShowProposeModal] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900">
      {/* Header Navigation */}
      <header className="border-b border-purple-500/20 backdrop-blur-sm sticky top-0 z-50 bg-gray-900/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div className="text-3xl">🔮</div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                    ArcaneCast
                  </h1>
                </div>
              </Link>
              
              <nav className="hidden md:flex items-center gap-6">
                <Link 
                  href="/"
                  className="text-sm font-medium text-gray-400 hover:text-purple-300 transition-colors"
                >
                  Polls
                </Link>
                <Link 
                  href="/dao"
                  className="text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-2"
                >
                  <span>🏛️</span>
                  <span>DAO Governance</span>
                </Link>
              </nav>
            </div>
            <WalletButton />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              DAO Governance
            </h1>
            <p className="text-gray-400">
              Shape the future of VeiledCasts through confidential voting
            </p>
          </div>
          
          {connected && (
            <button
              onClick={() => setShowProposeModal(true)}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors shadow-lg"
            >
              + Propose Poll
            </button>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-8 bg-gray-800/50 p-1 rounded-lg backdrop-blur-sm">
          <button
            onClick={() => setActiveSection('nomination')}
            className={`flex-1 px-6 py-3 rounded-md font-semibold transition-all ${
              activeSection === 'nomination'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            <div className="flex flex-col items-center">
              <span>Nomination</span>
              <span className="text-xs mt-1 opacity-75">Select your top 5</span>
            </div>
          </button>
          
          <button
            onClick={() => setActiveSection('voting')}
            className={`flex-1 px-6 py-3 rounded-md font-semibold transition-all ${
              activeSection === 'voting'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            <div className="flex flex-col items-center">
              <span>Voting</span>
              <span className="text-xs mt-1 opacity-75">Cast your vote</span>
            </div>
          </button>
          
          <button
            onClick={() => setActiveSection('completed')}
            className={`flex-1 px-6 py-3 rounded-md font-semibold transition-all ${
              activeSection === 'completed'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            <div className="flex flex-col items-center">
              <span>Completed</span>
              <span className="text-xs mt-1 opacity-75">View results</span>
            </div>
          </button>
        </div>

        {/* How It Works */}
        <div className="mb-8 bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-6 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-white mb-3">📖 How DAO Voting Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-300">
            <div>
              <span className="text-purple-400 font-semibold">1. Nomination:</span> Propose polls or select up to 5 proposals per week. Top 5 most selected advance to voting.
            </div>
            <div>
              <span className="text-blue-400 font-semibold">2. Voting:</span> Cast your encrypted vote on active polls. All votes remain confidential until reveal.
            </div>
            <div>
              <span className="text-green-400 font-semibold">3. Results:</span> View decrypted vote counts and percentages for completed polls.
            </div>
          </div>
        </div>

        {/* Section Content */}
        <div className="mt-8">
          {activeSection === 'nomination' && <NominationSection />}
          {activeSection === 'voting' && <VotingSection />}
          {activeSection === 'completed' && <CompletedSection />}
        </div>
      </div>

      {/* Propose Poll Modal */}
      {showProposeModal && (
        <ProposePollModal onClose={() => setShowProposeModal(false)} />
      )}
    </div>
  );
}
