'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCreateWallet } from '@privy-io/react-auth/solana';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';
import MarketsList from '../components/MarketsList';
import EventsList from '../components/EventsList';
import UserPositions from '../components/UserPositions';
import SocialFeed from '../components/SocialFeed';

export default function HomePage() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const router = useRouter();
  const [walletCreating, setWalletCreating] = useState(false);
  const [walletCreationAttempted, setWalletCreationAttempted] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (ready && !authenticated) {
      router.push('/');
    }
  }, [ready, authenticated, router]);

  // Monitor wallet creation after login with improved detection
  useEffect(() => {
    if (!authenticated || !user || !ready) {
      setWalletCreating(false);
      return;
    }

    const checkForWallet = () => {
      // Check wallets array
      const solanaWallets = wallets.filter((wallet) => {
        if (wallet.walletClientType === 'privy') return true;
        if (wallet.address && !wallet.address.startsWith('0x') && wallet.address.length >= 32) {
          return true;
        }
        return false;
      });

      if (solanaWallets.length > 0) {
        return true;
      }

      // Check linked accounts
      if (user.linkedAccounts) {
        const hasSolanaWallet = user.linkedAccounts.some((account: any) => {
          if (account.type !== 'wallet') return false;
          if (!('address' in account)) return false;
          if (!account.address || typeof account.address !== 'string') return false;
          if (account.address.startsWith('0x')) return false;
          if (account.address.length < 32) return false;
          return true;
        });
        
        if (hasSolanaWallet) {
          return true;
        }
      }

      return false;
    };

    // Check immediately
    if (checkForWallet()) {
      setWalletCreating(false);
      setWalletCreationAttempted(false);
      return;
    }

    // If wallet doesn't exist and we haven't tried to create it yet
    if (!walletCreationAttempted) {
      setWalletCreating(true);
      setWalletCreationAttempted(true);
      
      // Attempt to create wallet
      createWallet()
        .then(() => {
          console.log('Wallet creation initiated');
        })
        .catch((err) => {
          console.error('Wallet creation error:', err);
          setWalletCreating(false);
        });
    }

    // Poll for wallet creation (check every 1 second)
    let pollCount = 0;
    const maxPolls = 20; // 20 seconds max
    
    const pollInterval = setInterval(() => {
      pollCount++;
      
      if (checkForWallet()) {
        setWalletCreating(false);
        setWalletCreationAttempted(false);
        clearInterval(pollInterval);
      } else if (pollCount >= maxPolls) {
        // Timeout - stop showing loading
        setWalletCreating(false);
        clearInterval(pollInterval);
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [authenticated, user, wallets, ready, createWallet, walletCreationAttempted]);

  // Show loading while Privy initializes or redirecting
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Initializing...</p>
        </div>
      </div>
    );
  }

  // Show loading while redirecting if not authenticated
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Show main app after authentication
  return (
    <div className="min-h-screen bg-[#0D0D0D]">
      <Navbar />
      {/* Wallet Creation Banner - Non-blocking */}
      {walletCreating && (
        <div className="bg-violet-500/10 border-b border-violet-500/30 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="animate-spin h-5 w-5 text-violet-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-violet-300 text-sm font-medium">
                  Creating your Solana wallet... This will be ready shortly.
                </p>
              </div>
              <button
                onClick={() => setWalletCreating(false)}
                className="text-violet-400 hover:text-violet-300 text-sm transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-10">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-900/30 via-gray-900 to-fuchsia-900/30 border border-gray-800/50 p-8 md:p-12">
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-bl from-violet-600/20 via-transparent to-transparent rounded-full blur-3xl" />
              <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-fuchsia-600/20 via-transparent to-transparent rounded-full blur-3xl" />
            </div>
            <div className="relative z-10">
              <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
                Prediction Markets
              </h1>
              <p className="text-gray-400 text-lg max-w-2xl leading-relaxed">
                Trade on real-world outcomes. Put your predictions to the test and earn rewards for being right.
              </p>
              <div className="flex items-center gap-4 mt-6">
                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-green-400 text-sm font-medium">Live on Solana</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Positions */}
        <div className="mb-8">
          <UserPositions />
        </div>

        {/* Social Feed */}
        <div className="mb-8">
          <SocialFeed />
        </div>

        {/* Events Section */}
        <div className="mb-8">
          <EventsList />
        </div>

        {/* Markets Section */}
        <div className="mb-8">
          <MarketsList />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-2xl font-black text-white tracking-tighter">
              hunch
            </div>
            <p className="text-gray-600 text-sm">
              © 2024 Hunch. Built on Solana.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

