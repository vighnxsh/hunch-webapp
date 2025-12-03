'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import Login from './components/Login';
import MarketsList from './components/MarketsList';
import EventsList from './components/EventsList';
import UserPositions from './components/UserPositions';
import Profile from './components/Profile';

export default function Home() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [walletCreating, setWalletCreating] = useState(false);

  // Monitor wallet creation after login
  useEffect(() => {
    if (authenticated && user) {
      // Check if user has a wallet
      const hasWallet = wallets.length > 0 || 
        user.linkedAccounts?.some(account => account.type === 'wallet');
      
      if (!hasWallet) {
        // Wallet is being created
        setWalletCreating(true);
        // Set a timeout to prevent infinite loading
        const timeout = setTimeout(() => {
          setWalletCreating(false);
        }, 30000); // 30 second timeout
        
        return () => clearTimeout(timeout);
      } else {
        setWalletCreating(false);
      }
    }
  }, [authenticated, user, wallets]);

  // Show loading while Privy initializes
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

  // Show login page if not authenticated
  if (!authenticated) {
    return <Login />;
  }

  // Show wallet creation loading state
  if (walletCreating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D]">
        <div className="flex flex-col items-center gap-4 max-w-md px-6 text-center">
          <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <h2 className="text-xl font-bold text-white">Creating Your Wallet</h2>
          <p className="text-gray-400 text-sm">
            We're setting up your Solana wallet. This usually takes just a few seconds...
          </p>
          <div className="mt-4 w-full bg-gray-800 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    );
  }

  // Show main app after authentication
  return (
    <div className="min-h-screen bg-[#0D0D0D]">
      <Navbar />
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

        {/* Profile Section */}
        <div id="profile" className="mb-8">
          <Profile />
        </div>

        {/* User Positions */}
        <div className="mb-8">
          <UserPositions />
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
