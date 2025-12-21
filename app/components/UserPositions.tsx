'use client';

import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
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
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Get wallet address from multiple sources with polling (same as Profile component)
  useEffect(() => {
    if (!authenticated || !user) {
      setWalletAddress(null);
      return;
    }

    const checkForWallet = () => {
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
        setWalletAddress(solanaWallet.address);
        return true;
      }

      // Fallback: try to get from user's linked accounts
      if (user?.linkedAccounts) {
        const embeddedWallet = user.linkedAccounts.find(
          (account) => account.type === 'wallet' &&
            'walletClientType' in account &&
            account.walletClientType === 'privy' &&
            'address' in account
        ) as any;

        if (embeddedWallet?.address) {
          setWalletAddress(embeddedWallet.address);
          return true;
        }

        // Last resort: check all linked accounts for Solana addresses
        const solanaAccount = user.linkedAccounts.find(
          (account) => account.type === 'wallet' &&
            'address' in account &&
            account.address &&
            typeof account.address === 'string' &&
            !account.address.startsWith('0x') &&
            account.address.length >= 32
        ) as any;

        if (solanaAccount?.address) {
          setWalletAddress(solanaAccount.address);
          return true;
        }
      }

      return false;
    };

    // Try immediately
    if (checkForWallet()) {
      return;
    }

    // Poll for wallet if not found immediately (wallet might be loading)
    const interval = setInterval(() => {
      if (checkForWallet()) {
        clearInterval(interval);
      }
    }, 500);

    // Cleanup after 10 seconds
    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [authenticated, user, wallets]);

  // Get the active wallet for signing transactions
  const solanaWallets = wallets.filter((wallet) => {
    if (wallet.walletClientType === 'privy') return true;
    if (wallet.address && !wallet.address.startsWith('0x') && wallet.address.length >= 32) {
      return true;
    }
    return false;
  });
  
  const activeWallet = solanaWallets.find(
    (wallet) => wallet.walletClientType === 'privy'
  ) || solanaWallets[0];

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');

  useEffect(() => {
    console.log('UserPositions - Wallet state:', {
      ready,
      authenticated,
      walletAddress: walletAddress ? `${walletAddress.substring(0, 8)}...` : null,
      walletsCount: wallets.length,
    });

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
      
      // Fetch token accounts from both TOKEN_PROGRAM_ID and TOKEN_2022_PROGRAM_ID
      // Some tokens may be in the older program
      const [tokenAccounts2022, tokenAccountsLegacy] = await Promise.all([
        connection.getParsedTokenAccountsByOwner(publicKey, {
          programId: TOKEN_2022_PROGRAM_ID,
        }).catch(() => ({ value: [] })),
        connection.getParsedTokenAccountsByOwner(publicKey, {
          programId: TOKEN_PROGRAM_ID,
        }).catch(() => ({ value: [] })),
      ]);

      // Combine both token account arrays
      const allTokenAccounts = [
        ...tokenAccounts2022.value,
        ...tokenAccountsLegacy.value,
      ];

      // Extract token information and map into simpler structure
      const userTokens: TokenAccount[] = allTokenAccounts
        .map(({ account }) => {
          const info = account.data.parsed.info;
          return {
            mint: info.mint,
            balance: info.tokenAmount.uiAmount || 0,
            decimals: info.tokenAmount.decimals,
            rawBalance: info.tokenAmount.amount,
          };
        })
        .filter((token) => token.balance > 0);

      console.log(`Found ${userTokens.length} tokens with non-zero balance`);
      console.log('User tokens:', JSON.stringify(userTokens, null, 2));

      // Filter for prediction market tokens using DFlow API
      const allMintAddresses = userTokens.map((token) => token.mint);
      console.log(`Checking ${allMintAddresses.length} token mints for prediction markets...`);
      console.log('All mint addresses:', JSON.stringify(allMintAddresses, null, 2));
      
      const outcomeMints = await filterOutcomeMints(allMintAddresses);
      console.log(`Found ${outcomeMints.length} prediction market outcome mints`);
      console.log('Outcome mints response:', JSON.stringify(outcomeMints, null, 2));

      if (outcomeMints.length === 0) {
        console.log('No outcome mints found, showing empty positions');
        setPositions([]);
        setLoading(false);
        return;
      }

      // Fetch market details for outcome tokens in batch
      const markets = await fetchMarketsBatch(outcomeMints);
      console.log(`Fetched ${markets.length} market details`);
      console.log('Markets batch response:', JSON.stringify(markets, null, 2));

      // Create a map by mint address (yesMint, noMint, and marketLedger)
      // This follows the DFlow guide pattern
      const marketsByMint = new Map<string, Market>();
      markets.forEach((market) => {
        if (market.accounts) {
          Object.values(market.accounts).forEach((account: any) => {
            if (account.yesMint) marketsByMint.set(account.yesMint, market);
            if (account.noMint) marketsByMint.set(account.noMint, market);
            if (account.marketLedger) marketsByMint.set(account.marketLedger, market);
          });
        }
        // Fallback to direct market properties
        if (market.yesMint) marketsByMint.set(market.yesMint, market);
        if (market.noMint) marketsByMint.set(market.noMint, market);
      });

      // Map tokens to positions
      const userPositions: UserPosition[] = userTokens
        .filter((token) => outcomeMints.includes(token.mint))
        .map((token) => {
          const marketData = marketsByMint.get(token.mint);

          if (!marketData) {
            console.log(`No market data found for mint: ${token.mint}`);
            return {
              mint: token.mint,
              balance: token.balance,
              decimals: token.decimals,
              position: 'UNKNOWN',
              market: null,
            };
          }

          // Determine if YES or NO token (following DFlow guide pattern)
          const isYesToken = marketData.accounts
            ? Object.values(marketData.accounts).some(
                (account: any) => account.yesMint === token.mint
              )
            : marketData.yesMint === token.mint;

          const isNoToken = marketData.accounts
            ? Object.values(marketData.accounts).some(
                (account: any) => account.noMint === token.mint
              )
            : marketData.noMint === token.mint;

          const position = {
            mint: token.mint,
            balance: token.balance,
            decimals: token.decimals,
            position: isYesToken ? 'YES' : isNoToken ? 'NO' : 'UNKNOWN',
            market: marketData,
          };

          console.log(`Position mapped:`, JSON.stringify({
            mint: position.mint,
            balance: position.balance,
            position: position.position,
            marketTitle: position.market?.title,
            marketStatus: position.market?.status,
          }, null, 2));

          return position;
        });

      console.log('Final user positions:', JSON.stringify(userPositions.map(p => ({
        mint: p.mint,
        balance: p.balance,
        position: p.position,
        marketTitle: p.market?.title,
        marketStatus: p.market?.status,
      })), null, 2));

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
      //@ts-ignore
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

  

  

  // Don't return null - show component even if not ready/authenticated (will show empty state)
  // This ensures the component is always visible

  return (
    <div className="bg-[var(--surface)]/50 backdrop-blur-sm border border-[var(--border-color)] rounded-2xl p-6">
      <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Your Positions</h2>

      {ready && authenticated && walletAddress && (
        <>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={loadPositions}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && positions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-[var(--text-tertiary)]">No active positions found</p>
              <p className="text-[var(--text-tertiary)] text-sm mt-2">
                Start trading to see your positions here
              </p>
            </div>
          )}

          {!loading && !error && positions.length > 0 && (
        <div className="space-y-3">
          {positions.map((position) => (
            <div
              key={position.mint}
              className="p-4 bg-[var(--card-bg)]/30 border border-[var(--border-color)] rounded-xl hover:border-cyan-500/30 transition-colors"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-[var(--text-primary)]">
                    {position.market?.title || 'Unknown Market'}
                  </h3>
                  <div className="flex gap-2 mt-2">
                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-lg ${
                        position.position === 'YES'
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          : position.position === 'NO'
                          ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                          : 'bg-[var(--surface-hover)] text-[var(--text-tertiary)] border border-[var(--border-color)]'
                      }`}
                    >
                      {position.position}
                    </span>
                    {position.market?.status && (
                      <span className="px-3 py-1 text-xs font-medium rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                        {position.market.status}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-xl text-[var(--text-primary)]">
                    {position.balance.toLocaleString()}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    tokens
                  </p>
                </div>
              </div>
              {position.market?.status === 'determined' ||
              position.market?.status === 'finalized' ? (
                <button
                  onClick={() => handleRedeem(position)}
                  disabled={redeemingMint === position.mint}
                  className="mt-3 w-full px-4 py-3 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-xl disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed transition-all text-sm font-semibold"
                >
                  {redeemingMint === position.mint ? 'Redeeming...' : 'Redeem Tokens'}
                </button>
              ) : null}
            </div>
          ))}
        </div>
          )}
        </>
      )}

      {(!ready || !authenticated || !walletAddress) && !loading && (
        <div className="text-center py-12">
          <p className="text-[var(--text-tertiary)]">
            {!ready ? 'Initializing...' : !authenticated ? 'Please sign in to view positions' : 'Wallet not found. Please ensure your wallet is connected.'}
          </p>
          {ready && authenticated && !walletAddress && (
            <p className="text-[var(--text-tertiary)] text-sm mt-2">
              If you just created your wallet, it may take a few seconds to appear.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
