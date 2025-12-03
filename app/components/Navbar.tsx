'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';

export default function Navbar() {
  const { ready, authenticated, user, logout } = usePrivy();
  const { wallets } = useWallets();
  const [mounted, setMounted] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter wallets to only Solana wallets
  // Solana addresses are base58 encoded (32-44 chars), Ethereum addresses are hex (0x + 40 chars)
  const solanaWallets = wallets.filter((wallet) => {
    // Privy embedded wallets are Solana (we only create Solana wallets)
    if (wallet.walletClientType === 'privy') return true;
    // Check if wallet address is Solana format (base58, not starting with 0x)
    if (wallet.address && !wallet.address.startsWith('0x') && wallet.address.length >= 32) {
      return true;
    }
    return false;
  });
  
  // Get the embedded Solana wallet (prefer Privy embedded wallet)
  const solanaWallet = solanaWallets.find(
    (wallet) => wallet.walletClientType === 'privy'
  ) || solanaWallets[0];
  
  const walletAddress = solanaWallet?.address;

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const getUserDisplayName = () => {
    if (user?.twitter?.username) {
      return `@${user.twitter.username}`;
    }
    if (user?.google?.email) {
      return user.google.email.split('@')[0];
    }
    if (walletAddress) {
      return truncateAddress(walletAddress);
    }
    return 'User';
  };

  const getUserAvatar = () => {
    if (user?.twitter?.profilePictureUrl) {
      return user.twitter.profilePictureUrl;
    }
    return null;
  };

  if (!mounted) {
    return (
      <nav className="w-full border-b border-gray-800 bg-[#0D0D0D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="text-2xl font-black text-white tracking-tighter">
              hunch
            </div>
            <div className="h-10 w-32 bg-gray-800 rounded-xl animate-pulse" />
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="w-full border-b border-gray-800/50 bg-[#0D0D0D]/95 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <div className="text-2xl font-black text-white tracking-tighter">
              hunch
            </div>
            {authenticated && (
              <div className="hidden md:flex items-center gap-6">
                <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
                  Markets
                </a>
                <a href="#profile" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
                  Profile
                </a>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {ready && authenticated ? (
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-3 px-4 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl transition-all duration-200"
                >
                  {getUserAvatar() ? (
                    <img
                      src={getUserAvatar()!}
                      alt="Avatar"
                      className="w-7 h-7 rounded-full"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        {getUserDisplayName().charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="text-white text-sm font-medium hidden sm:block">
                    {getUserDisplayName()}
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowDropdown(false)}
                    />
                    <div className="absolute right-0 mt-2 w-72 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl z-20 overflow-hidden">
                      <div className="p-4 border-b border-gray-800">
                        <div className="flex items-center gap-3">
                          {getUserAvatar() ? (
                            <img
                              src={getUserAvatar()!}
                              alt="Avatar"
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                              <span className="text-white text-sm font-bold">
                                {getUserDisplayName().charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="text-white font-medium text-sm">
                              {getUserDisplayName()}
                            </p>
                            {walletAddress && (
                              <p className="text-gray-500 text-xs font-mono">
                                {truncateAddress(walletAddress)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {walletAddress && (
                        <div className="p-4 border-b border-gray-800">
                          <p className="text-gray-500 text-xs mb-2 uppercase tracking-wider font-medium">
                            Wallet Address
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="text-gray-300 text-xs font-mono bg-gray-800 px-3 py-2 rounded-lg flex-1 truncate">
                              {walletAddress}
                            </code>
                            <button
                              onClick={() => navigator.clipboard.writeText(walletAddress)}
                              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                              title="Copy address"
                            >
                              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="p-2">
                        <button
                          onClick={() => {
                            setShowDropdown(false);
                            logout();
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors text-sm font-medium"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="h-10 w-32 bg-gray-800 rounded-xl animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
