'use client';

import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
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
  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [positions, setPositions] = useState<UserPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redeemingMint, setRedeemingMint] = useState<string | null>(null);

  useEffect(() => {
    if (publicKey && connection) {
      loadPositions();
    } else {
      setPositions([]);
    }
  }, [publicKey, connection]);

  const loadPositions = async () => {
    if (!publicKey || !connection) return;

    setLoading(true);
    setError(null);

    try {
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
    if (!publicKey || !signTransaction || !sendTransaction) {
      setError('Please connect your wallet');
      return;
    }

    setRedeemingMint(position.mint);
    setError(null);

    try {
      // Request redemption order
      const order = await requestOrder({
        userPublicKey: publicKey.toBase58(),
        inputMint: position.mint,
        outputMint: USDC_MINT,
        amount: position.balance.toString(), // Outcome tokens have 0 decimals
        slippageBps: 100,
      });

      // Sign and submit
      const transactionBytes = Uint8Array.from(
        atob(order.openTransaction),
        (c) => c.charCodeAt(0)
      );
      const transaction = Transaction.from(transactionBytes);
      const signedTransaction = await signTransaction(transaction);
      const signature = await sendTransaction(signedTransaction, connection);

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

  if (!publicKey) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Your Positions
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Connect your wallet to view your prediction market positions
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Your Positions
        </h2>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Your Positions ({positions.length})
        </h2>
        <button
          onClick={loadPositions}
          className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {positions.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">
          No prediction market positions found
        </p>
      ) : (
        <div className="space-y-3">
          {positions.map((position) => (
            <div
              key={position.mint}
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {position.market?.title || 'Unknown Market'}
                  </h3>
                  <div className="flex gap-2 mt-1">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        position.position === 'YES'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : position.position === 'NO'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {position.position}
                    </span>
                    {position.market?.status && (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                        {position.market.status}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {position.balance.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    tokens
                  </p>
                </div>
              </div>
              {position.market?.status === 'determined' ||
              position.market?.status === 'finalized' ? (
                <button
                  onClick={() => handleRedeem(position)}
                  disabled={redeemingMint === position.mint}
                  className="mt-3 w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  {redeemingMint === position.mint ? 'Redeeming...' : 'Redeem'}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

