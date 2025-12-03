'use client';

import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

export default function Profile() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Get wallet address from multiple sources
  useEffect(() => {
    if (!authenticated || !user) {
      setWalletAddress(null);
      return;
    }

    // First, try to get from wallets array
    const solanaWallets = wallets.filter((wallet) => {
      if (wallet.walletClientType === 'privy') return true;
      if (wallet.address && !wallet.address.startsWith('0x') && wallet.address.length >= 32) {
        return true;
      }
      return false;
    });
    
    const solanaWallet = solanaWallets.find(
      (wallet) => wallet.walletClientType === 'privy'
    ) || solanaWallets[0];
    
    if (solanaWallet?.address) {
      console.log('Profile: Found wallet from wallets array:', solanaWallet.address);
      setWalletAddress(solanaWallet.address);
      return;
    }

    // Debug logging
    console.log('Profile: Wallets array:', wallets);
    console.log('Profile: User linked accounts:', user.linkedAccounts);

    // Fallback: try to get from user's linked accounts
    const embeddedWallet = user.linkedAccounts?.find(
      (account) => account.type === 'wallet' && 
                   'walletClientType' in account && 
                   account.walletClientType === 'privy' &&
                   'address' in account
    ) as any;
    
    if (embeddedWallet?.address) {
      setWalletAddress(embeddedWallet.address);
      return;
    }

    // Last resort: check all linked accounts for Solana addresses
    const solanaAccount = user.linkedAccounts?.find(
      (account) => account.type === 'wallet' && 
                   'address' in account &&
                   account.address && 
                   typeof account.address === 'string' &&
                   !account.address.startsWith('0x') && 
                   account.address.length >= 32
    ) as any;
    
    if (solanaAccount?.address) {
      setWalletAddress(solanaAccount.address);
      return;
    }

    setWalletAddress(null);
  }, [authenticated, user, wallets]);

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');

  // Fetch SOL balance
  useEffect(() => {
    if (walletAddress && authenticated) {
      fetchBalance();
    }
  }, [walletAddress, authenticated]);

  const fetchBalance = async () => {
    if (!walletAddress) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const publicKey = new PublicKey(walletAddress);
      const balance = await connection.getBalance(publicKey);
      setSolBalance(balance / LAMPORTS_PER_SOL);
    } catch (err: any) {
      setError('Failed to fetch balance');
      console.error('Error fetching balance:', err);
    } finally {
      setLoading(false);
    }
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const getUserDisplayName = () => {
    if (user?.twitter?.username) {
      return `@${user.twitter.username}`;
    }
    if (user?.google?.email) {
      return user.google.email.split('@')[0];
    }
    return 'User';
  };

  const getUserAvatar = () => {
    if (user?.twitter?.profilePictureUrl) {
      return user.twitter.profilePictureUrl;
    }
    return null;
  };

  const getUserEmail = () => {
    if (user?.google?.email) {
      return user.google.email;
    }
    // Twitter doesn't provide email in Privy
    return null;
  };

  if (!ready || !authenticated) {
    return null;
  }

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800/50 rounded-2xl p-6">
      <div className="flex items-start justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Profile</h2>
        <button
          onClick={fetchBalance}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors border border-gray-700 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* User Info Section */}
      <div className="mb-6 pb-6 border-b border-gray-800">
        <div className="flex items-start gap-4">
          {getUserAvatar() ? (
            <img
              src={getUserAvatar()!}
              alt="Profile"
              className="w-16 h-16 rounded-full border-2 border-violet-500/30"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center border-2 border-violet-500/30">
              <span className="text-white text-xl font-bold">
                {getUserDisplayName().charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white mb-1">
              {getUserDisplayName()}
            </h3>
            {getUserEmail() && (
              <p className="text-gray-400 text-sm mb-2">{getUserEmail()}</p>
            )}
            {/* Followers/Following Placeholders */}
            <div className="flex items-center gap-6 mt-3">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">Followers</span>
                <span className="text-white font-semibold">0</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">Following</span>
                <span className="text-white font-semibold">0</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Address Section */}
      {walletAddress ? (
        <div className="mb-6 pb-6 border-b border-gray-800">
          <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
            Solana Wallet
          </h4>
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-xs uppercase tracking-wider">Address</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(walletAddress);
                }}
                className="text-violet-400 hover:text-violet-300 text-xs font-medium transition-colors"
                title="Copy address"
              >
                Copy
              </button>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-white font-mono text-sm flex-1 break-all">
                {walletAddress}
              </code>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-700/50">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-xs uppercase tracking-wider">Balance</span>
                {loading ? (
                  <div className="h-4 w-16 bg-gray-700 rounded animate-pulse" />
                ) : error ? (
                  <span className="text-red-400 text-xs">Error</span>
                ) : (
                  <span className="text-white font-semibold">
                    {solBalance !== null ? `${solBalance.toFixed(4)} SOL` : '-- SOL'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 pb-6 border-b border-gray-800">
          <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
            Solana Wallet
          </h4>
          <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-800/50">
            <div className="flex items-center justify-center gap-3 py-4">
              <svg className="w-5 h-5 text-gray-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-gray-500 text-sm">
                Wallet is being created...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Section */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-800/50">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Total Trades</p>
          <p className="text-white text-2xl font-bold">0</p>
        </div>
        <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-800/50">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Win Rate</p>
          <p className="text-white text-2xl font-bold">--</p>
        </div>
      </div>
    </div>
  );
}

