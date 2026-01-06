'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCreateWallet } from '@privy-io/react-auth/solana';
import { useEffect, useState } from 'react';
import EventsList from '../components/EventsList';
import MarketRail from '../components/MarketRail';

export default function HomePage() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const [walletCreating, setWalletCreating] = useState(false);
  const [walletCreationAttempted, setWalletCreationAttempted] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  // Check if HTTPS is available (required for embedded wallets)
  const isHttpsAvailable = () => {
    if (typeof window === 'undefined') return false;
    return window.location.protocol === 'https:' || window.location.hostname === 'localhost';
  };

  // Monitor wallet creation after login with improved detection (only for authenticated users)
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
      // Check if HTTPS is available
      if (!isHttpsAvailable()) {
        setWalletError('Embedded wallets require HTTPS. Please use HTTPS or deploy to a staging environment.');
        setWalletCreating(false);
        setWalletCreationAttempted(true);
        return;
      }

      setWalletCreating(true);
      setWalletCreationAttempted(true);
      setWalletError(null);

      // Attempt to create wallet
      createWallet()
        .then(() => {
          console.log('Wallet creation initiated');
        })
        .catch((err: any) => {
          console.error('Wallet creation error:', err);
          const errorMessage = err?.message || 'Failed to create wallet';
          if (errorMessage.includes('HTTPS') || errorMessage.includes('https')) {
            setWalletError('Embedded wallets require HTTPS. Please use HTTPS or deploy to a staging environment.');
          } else {
            setWalletError(errorMessage);
          }
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

  // Show loading while Privy initializes
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--text-secondary)] text-sm">Initializing...</p>
        </div>
      </div>
    );
  }

  // Show main app - now accessible to both authenticated and unauthenticated users
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Wallet Creation Banner - Non-blocking, only for authenticated users */}
      {authenticated && (walletCreating || walletError) && (
        <div className={`sticky top-0 z-40 border-b ${walletError
          ? 'bg-red-500/10 border-red-500/30'
          : 'bg-yellow-500/10 border-yellow-500/30'
          }`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {walletCreating && !walletError && (
                  <svg className="animate-spin h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {walletError && (
                  <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
                <div className="flex flex-col gap-1">
                  <p className={`text-sm font-medium ${walletError ? 'text-red-300' : 'text-yellow-300'
                    }`}>
                    {walletError || 'Creating your Solana wallet... This will be ready shortly.'}
                  </p>
                  {walletError && walletError.includes('HTTPS') && (
                    <p className="text-red-300/70 text-xs">
                      For local development, use tools like{' '}
                      <a
                        href="https://github.com/FiloSottile/mkcert"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-red-200"
                      >
                        mkcert
                      </a>
                      {' '}to enable HTTPS on localhost.
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setWalletCreating(false);
                  setWalletError(null);
                }}
                className={`text-sm transition-colors ${walletError
                  ? 'text-red-400 hover:text-red-300'
                  : 'text-yellow-400 hover:text-yellow-300'
                  }`}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
        {/* EventsList with MarketRail inserted below filters */}
        <EventsList renderBelowFilters={<MarketRail />} />
      </main>
    </div>
  );
}
