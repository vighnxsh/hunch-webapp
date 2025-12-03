'use client';

import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { filterOutcomeMints, fetchMarketsBatch, Market } from '../lib/api';
import { requestOrder, getOrderStatus, USDC_MINT } from '../lib/tradeApi';

interface TokenAccount {
  mint: string;
  balance: number;
  decimals: number;
  rawBalance: string;
}

interface UserPosition {
  mint: string;
  balance: number;
  decimals: number;
  position: 'YES' | 'NO' | 'UNKNOWN';
  market: Market | null;
}

export default function UserPositions() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [positions, setPositions] = useState<UserPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redeemingMint, setRedeemingMint] = useState<string | null>(null);

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
  const activeWallet = solanaWallet;

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');

  useEffect(() => {
    if (ready && authenticated && walletAddress) {
      loadPositions();
    } else {
      setPositions([]);
    }
  }, [ready, authenticated, walletAddress]);

  const loadPositions = async () => {
    if (!walletAddress) return;

    setLoading(true);
    setError(null);

    try {
      const publicKey = new PublicKey(walletAddress);
      
      // Fetch all token accounts
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        {
          programId: TOKEN_PROGRAM_ID,
        }
      );

      // Extract token information
      const userTokens: TokenAccount[] = tokenAccounts.value
        .map((accountInfo) => {
          const parsedInfo = accountInfo.account.data.parsed.info;
          return {
            mint: parsedInfo.mint,
            balance: parsedInfo.tokenAmount.uiAmount || 0,
            decimals: parsedInfo.tokenAmount.decimals,
            rawBalance: parsedInfo.tokenAmount.amount,
          };
        })
        .filter((token) => token.balance > 0);

      // Filter for prediction market tokens
      const allMintAddresses = userTokens.map((token) => token.mint);
      const outcomeMints = await filterOutcomeMints(allMintAddresses);

      if (outcomeMints.length === 0) {
        setPositions([]);
        setLoading(false);
        return;
      }

      // Fetch market details for outcome tokens
      const markets = await fetchMarketsBatch(outcomeMints);

      // Create a map by mint address
      const marketsByMint = new Map<string, Market>();
      markets.forEach((market) => {
        if (market.accounts) {
          Object.values(market.accounts).forEach((account: any) => {
            if (account.yesMint) marketsByMint.set(account.yesMint, market);
            if (account.noMint) marketsByMint.set(account.noMint, market);
          });
        }
        if (market.yesMint) marketsByMint.set(market.yesMint, market);
        if (market.noMint) marketsByMint.set(market.noMint, market);
      });

      // Map tokens to positions
      const userPositions: UserPosition[] = userTokens
        .filter((token) => outcomeMints.includes(token.mint))
        .map((token) => {
          const marketData = marketsByMint.get(token.mint);

          if (!marketData) {
            return {
              mint: token.mint,
              balance: token.balance,
              decimals: token.decimals,
              position: 'UNKNOWN',
              market: null,
            };
          }

          // Determine if YES or NO token
          let isYesToken = false;
          let isNoToken = false;

          if (marketData.accounts) {
            Object.values(marketData.accounts).forEach((account: any) => {
              if (account.yesMint === token.mint) isYesToken = true;
              if (account.noMint === token.mint) isNoToken = true;
            });
          } else {
            if (marketData.yesMint === token.mint) isYesToken = true;
            if (marketData.noMint === token.mint) isNoToken = true;
          }

          return {
            mint: token.mint,
            balance: token.balance,
            decimals: token.decimals,
            position: isYesToken ? 'YES' : isNoToken ? 'NO' : 'UNKNOWN',
            market: marketData,
          };
        });

      setPositions(userPositions);
    } catch (err: any) {
      setError(err.message || 'Failed to load positions');
      console.error('Error loading positions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (position: UserPosition) => {
    if (!walletAddress || !activeWallet) {
      setError('Please connect your wallet');
      return;
    }

    setRedeemingMint(position.mint);
    setError(null);

    try {
      // Request redemption order
      const order = await requestOrder({
        userPublicKey: walletAddress,
        inputMint: position.mint,
        outputMint: USDC_MINT,
        amount: position.balance.toString(),
        slippageBps: 100,
      });

      // Sign and submit using Privy wallet
      const transactionBytes = Uint8Array.from(
        atob(order.openTransaction),
        (c) => c.charCodeAt(0)
      );
      const transaction = Transaction.from(transactionBytes);
      
      // Sign with Privy embedded wallet
      const signedTransaction = await activeWallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());

      // Monitor
      if (order.executionMode === 'sync') {
        await monitorSyncTrade(signature);
      } else {
        await monitorAsyncTrade(signature);
      }

      // Reload positions
      await loadPositions();
    } catch (err: any) {
      setError(`Redemption failed: ${err.message}`);
      console.error('Error redeeming:', err);
    } finally {
      setRedeemingMint(null);
    }
  };

  const monitorSyncTrade = async (signature: string) => {
    let status;
    do {
      const statusResult = await connection.getSignatureStatuses([signature]);
      status = statusResult.value[0];
      if (!status) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } while (
      !status ||
      status.confirmationStatus === 'processed' ||
      status.confirmationStatus === 'confirmed'
    );
  };

  const monitorAsyncTrade = async (signature: string) => {
    let status;
    do {
      const statusData = await getOrderStatus(signature);
      status = statusData.status;
      if (status === 'open' || status === 'pendingClose') {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } while (status === 'open' || status === 'pendingClose');
  };

  if (!ready || !authenticated || !walletAddress) {
    return (
      <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800/50 rounded-2xl p-6">
        <h2 className="text-2xl font-bold mb-4 text-white">
          Your Positions
        </h2>
        <p className="text-gray-500">
          Connect your wallet to view your prediction market positions
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800/50 rounded-2xl p-6">
        <h2 className="text-2xl font-bold mb-4 text-white">
          Your Positions
        </h2>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-gray-800/50 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800/50 rounded-2xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">
          Your Positions ({positions.length})
        </h2>
        <button
          onClick={loadPositions}
          className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors border border-gray-700"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {positions.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-800 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-gray-500">No prediction market positions found</p>
          <p className="text-gray-600 text-sm mt-1">Start trading to see your positions here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {positions.map((position) => (
            <div
              key={position.mint}
              className="p-4 bg-gray-800/30 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-white">
                    {position.market?.title || 'Unknown Market'}
                  </h3>
                  <div className="flex gap-2 mt-2">
                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-lg ${
                        position.position === 'YES'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : position.position === 'NO'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-gray-700 text-gray-400 border border-gray-600'
                      }`}
                    >
                      {position.position}
                    </span>
                    {position.market?.status && (
                      <span className="px-3 py-1 text-xs font-medium rounded-lg bg-violet-500/20 text-violet-400 border border-violet-500/30">
                        {position.market.status}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-xl text-white">
                    {position.balance.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    tokens
                  </p>
                </div>
              </div>
              {position.market?.status === 'determined' ||
              position.market?.status === 'finalized' ? (
                <button
                  onClick={() => handleRedeem(position)}
                  disabled={redeemingMint === position.mint}
                  className="mt-3 w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed transition-all text-sm font-semibold"
                >
                  {redeemingMint === position.mint ? 'Redeeming...' : 'Redeem Tokens'}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
