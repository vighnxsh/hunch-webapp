'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useSignAndSendTransaction, useWallets } from '@privy-io/react-auth/solana';
import { Connection, Transaction } from '@solana/web3.js';
import { requestOrder, getOrderStatus, OrderResponse, USDC_MINT } from '../lib/tradeApi';
import { Market } from '../lib/api';
import { parseMarketTicker, formatMarketTitle } from '../lib/marketUtils';
import { fetchMarketProbabilities, MarketProbabilities } from '../lib/probabilityUtils';

interface TradeMarketProps {
  market: Market;
}

export default function TradeMarket({ market }: TradeMarketProps) {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [orderData, setOrderData] = useState<OrderResponse | null>(null);
  const [probabilities, setProbabilities] = useState<MarketProbabilities>({
    yesProbability: null,
    noProbability: null,
    loading: true,
    error: null,
  });

  // Get the first Solana wallet from useWallets (already returns only Solana wallets)
  const solanaWallet = wallets[0];
  
  const walletAddress = solanaWallet?.address;
  const activeWallet = solanaWallet;

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');

  // Fetch market probabilities
  useEffect(() => {
    if (market.status !== 'active') {
      setProbabilities({
        yesProbability: null,
        noProbability: null,
        loading: false,
        error: null,
      });
      return;
    }

    const loadProbabilities = async () => {
      setProbabilities(prev => ({ ...prev, loading: true }));
      const result = await fetchMarketProbabilities(market);
      setProbabilities(result);
    };

    loadProbabilities();
  }, [market]);

  const getMintAddress = (type: 'yes' | 'no'): string | undefined => {
    if (market.accounts && typeof market.accounts === 'object') {
      const usdcAccount = (market.accounts as any)[USDC_MINT];
      if (usdcAccount) {
        const mint = type === 'yes' ? usdcAccount.yesMint : usdcAccount.noMint;
        if (mint) {
          return mint;
        }
      }
      
      const accountKeys = Object.keys(market.accounts);
      for (const key of accountKeys) {
        const account = (market.accounts as any)[key];
        if (account && typeof account === 'object') {
          const mint = type === 'yes' ? account.yesMint : account.noMint;
          if (mint) {
            return mint;
          }
        }
      }
    }
    
    const mint = type === 'yes' ? market.yesMint : market.noMint;
    if (mint) {
      return mint;
    }
    
    return undefined;
  };

  const handleRequestOrder = async () => {
    if (!ready || !authenticated || !walletAddress) {
      setStatus('Please connect your wallet first');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setStatus('Please enter a valid amount');
      return;
    }

    if (market.status !== 'active') {
      setStatus(`❌ Market is not active. Current status: ${market.status || 'unknown'}`);
      return;
    }

    setLoading(true);
    setStatus('');

    try {
      const outcomeMint = getMintAddress(side);
      if (!outcomeMint) {
        setStatus('❌ Market mint addresses not available. Please check market data.');
        setLoading(false);
        return;
      }

      const amountInSmallestUnit = Math.floor(parseFloat(amount) * 1_000_000);
      
      if (amountInSmallestUnit < 1) {
        setStatus('❌ Amount too small. Minimum is 0.000001 USDC');
        setLoading(false);
        return;
      }

      const order = await requestOrder({
        userPublicKey: walletAddress,
        inputMint: USDC_MINT,
        outputMint: outcomeMint,
        amount: amountInSmallestUnit.toString(),
        slippageBps: 100,
      });

      setOrderData(order);
      setStatus(`✅ Order received! You'll get ${order.outAmount} tokens for ${order.inAmount} USDC`);
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
      console.error('Error requesting order:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignAndSubmit = async () => {
    if (!ready || !authenticated || !walletAddress || !orderData || !solanaWallet) {
      setStatus('Please connect your wallet and request an order first');
      return;
    }

    setLoading(true);
    setStatus('');

    try {
      // Decode the base64 transaction
      const transactionBytes = Uint8Array.from(
        atob(orderData.openTransaction),
        (c) => c.charCodeAt(0)
      );

      setStatus('Signing and submitting transaction...');
      
      // Use Privy's signAndSendTransaction to sign and send in one call
      const result = await signAndSendTransaction({
        transaction: transactionBytes,
        wallet: solanaWallet,
      });

      // Privy's signAndSendTransaction returns the signature as Uint8Array
      // Convert Uint8Array to base58 string for Solana (Solana uses base58 encoding)
      // Try to use bs58 if available, otherwise use a workaround
      let signatureString: string;
      
      // Check if result.signature is already a string (some Privy versions might return string)
      if (typeof result.signature === 'string') {
        signatureString = result.signature;
      } else {
        // Convert Uint8Array to base58
        // Try dynamic import of bs58 first
        try {
          const bs58Module = await import('bs58');
          const bs58 = bs58Module.default || bs58Module;
          signatureString = bs58.encode(result.signature);
        } catch {
          // If bs58 is not available, we'll need to parse the transaction to get signature
          // Or use the transaction bytes to extract signature
          // For now, let's try to get it from the transaction after it's sent
          // Privy sends the transaction automatically, so we need to wait and get the signature
          // Actually, we can parse the transaction to extract the signature
          try {
            const transaction = Transaction.from(transactionBytes);
            // The signature should be in the transaction after signing
            // But Privy handles signing internally, so we need to get it from result
            // Let's use a simple base58 encoding implementation
            const base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
            let num = BigInt(0);
            for (let i = 0; i < result.signature.length; i++) {
              num = num * BigInt(256) + BigInt(result.signature[i]);
            }
            let str = '';
            if (num === BigInt(0)) {
              str = '1';
            } else {
              while (num > 0) {
                str = base58Alphabet[Number(num % BigInt(58))] + str;
                num = num / BigInt(58);
              }
            }
            signatureString = str;
          } catch (err) {
            // Last resort: use hex encoding (not ideal but will work)
            signatureString = Buffer.from(result.signature).toString('hex');
            console.warn('Could not encode signature as base58, using hex:', err);
          }
        }
      }

      setStatus(`✅ Transaction submitted! Signature: ${signatureString}`);

      if (orderData.executionMode === 'sync') {
        setStatus('Monitoring sync trade...');
        await monitorSyncTrade(signatureString);
      } else {
        setStatus('Monitoring async trade...');
        await monitorAsyncTrade(signatureString);
      }
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
      console.error('Error signing/submitting transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const storeTrade = async (signature: string) => {
    if (!user || !walletAddress || !orderData) return;

    try {
      // First, sync user to ensure they exist in database
      const syncResponse = await fetch('/api/users/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privyId: user.id,
          walletAddress: walletAddress,
          displayName: user.twitter?.username 
            ? `@${user.twitter.username}` 
            : user.google?.email?.split('@')[0] || null,
          avatarUrl: user.twitter?.profilePictureUrl || null,
        }),
      });

      if (!syncResponse.ok) {
        console.error('Failed to sync user');
        return;
      }

      const syncedUser = await syncResponse.json();

      // Store the trade
      const tradeResponse = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: syncedUser.id,
          marketTicker: market.ticker,
          side: side,
          amount: orderData.inAmount,
          transactionSig: signature,
        }),
      });

      if (!tradeResponse.ok) {
        console.error('Failed to store trade');
      }
    } catch (error) {
      console.error('Error storing trade:', error);
      // Don't show error to user, trade was successful on-chain
    }
  };

  const monitorSyncTrade = async (signature: string) => {
    try {
      let txStatus;
      do {
        const statusResult = await connection.getSignatureStatuses([signature]);
        txStatus = statusResult.value[0];

        if (!txStatus) {
          setStatus('Waiting for transaction confirmation...');
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } while (
        !txStatus ||
        txStatus.confirmationStatus === 'processed' ||
        txStatus.confirmationStatus === 'confirmed'
      );

      if (txStatus.err) {
        setStatus(`❌ Transaction failed: ${JSON.stringify(txStatus.err)}`);
      } else {
        setStatus(`✅ Trade completed successfully in slot ${txStatus.slot}`);
        // Store trade in database
        await storeTrade(signature);
        setOrderData(null);
        setAmount('');
      }
    } catch (error: any) {
      setStatus(`❌ Error monitoring trade: ${error.message}`);
    }
  };

  const monitorAsyncTrade = async (signature: string) => {
    try {
      let orderStatus;
      let fills: any[] = [];

      do {
        const statusData = await getOrderStatus(signature);
        orderStatus = statusData.status;
        fills = statusData.fills || [];

        setStatus(`Order status: ${orderStatus}`);

        if (orderStatus === 'open' || orderStatus === 'pendingClose') {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } while (orderStatus === 'open' || orderStatus === 'pendingClose');

      switch (orderStatus) {
        case 'closed': {
          if (fills.length > 0) {
            const totalOut = fills.reduce((acc, f) => acc + Number(f.qtyOut || 0), 0);
            setStatus(`✅ Trade completed! Received ${totalOut.toString()} tokens`);
            // Store trade in database
            await storeTrade(signature);
          } else {
            setStatus('Order was closed without any fills');
          }
          break;
        }
        case 'failed': {
          setStatus('❌ Order failed to execute');
          break;
        }
        default: {
          setStatus(`Order status: ${orderStatus}`);
        }
      }

      setOrderData(null);
      setAmount('');
    } catch (error: any) {
      setStatus(`❌ Error monitoring trade: ${error.message}`);
    }
  };

  const dateInfo = parseMarketTicker(market.ticker);
  const displayTitle = formatMarketTitle(market.title || 'Untitled Market', market.ticker);

  return (
    <div className="bg-[var(--card-bg)]/30 rounded-xl p-5 border border-[var(--border-color)]">
    
      {dateInfo.formattedDate && (
        <div className="mb-3 p-2 bg-violet-500/10 border border-violet-500/30 rounded-lg">
          <p className="text-sm font-medium text-violet-300">
            End date: {dateInfo.formattedDate}
          </p>
        </div>
      )}
      <p className="text-xs text-[var(--text-tertiary)] mb-4 font-mono">
        {market.ticker}
      </p>

      <div className="space-y-4">
        {/* Side Selection */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Position
          </label>
          {/* Probability Display */}
          {market.status === 'active' && !probabilities.loading && 
           (probabilities.yesProbability !== null || probabilities.noProbability !== null) && (
            <div className="flex gap-2 mb-2">
              <div className="flex-1 text-center">
                <div className="text-xs text-[var(--text-tertiary)] mb-1">YES Probability</div>
                <div className="text-lg font-bold text-green-400">
                  {probabilities.yesProbability !== null 
                    ? `${probabilities.yesProbability}%` 
                    : '--'}
                </div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-xs text-[var(--text-tertiary)] mb-1">NO Probability</div>
                <div className="text-lg font-bold text-red-400">
                  {probabilities.noProbability !== null 
                    ? `${probabilities.noProbability}%` 
                    : '--'}
                </div>
              </div>
            </div>
          )}
          {probabilities.loading && market.status === 'active' && (
            <div className="flex items-center justify-center gap-2 mb-2 text-xs text-[var(--text-tertiary)]">
              <div className="h-3 w-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading probabilities...</span>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setSide('yes')}
              className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-200 ${
                side === 'yes'
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/25'
                  : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:bg-[var(--input-bg)]'
              }`}
            >
              YES
            </button>
            <button
              onClick={() => setSide('no')}
              className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-200 ${
                side === 'no'
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                  : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:bg-[var(--input-bg)]'
              }`}
            >
              NO
            </button>
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Amount (USDC)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            step="0.01"
            min="0"
            disabled={!!orderData}
            className="w-full px-4 py-3 border border-[var(--border-color)] rounded-xl bg-[var(--input-bg)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50 transition-all"
          />
        </div>

        {/* Action Buttons */}
        {!orderData ? (
          <>
            {(!ready || !authenticated || !walletAddress) && (
              <div className="mb-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-400 text-xs">
                  {!ready ? 'Initializing...' : !authenticated ? 'Please log in' : !walletAddress ? 'Please connect your wallet' : ''}
                </p>
              </div>
            )}
            <button
              onClick={handleRequestOrder}
              disabled={!ready || !authenticated || !walletAddress || loading || !amount || parseFloat(amount) <= 0}
              className="w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed transition-all font-semibold"
            >
              {loading ? 'Requesting Order...' : !amount || parseFloat(amount) <= 0 ? 'Enter Amount' : 'Request Order'}
            </button>
          </>
        ) : (
          <button
            onClick={handleSignAndSubmit}
            disabled={loading}
            className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed transition-all font-semibold"
          >
            {loading ? 'Processing...' : 'Sign & Submit Transaction'}
          </button>
        )}

        {/* Status */}
        {status && (
          <p className={`text-sm p-3 rounded-lg ${
            status.includes('✅') 
              ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
              : status.includes('❌') 
              ? 'bg-red-500/10 text-red-400 border border-red-500/30' 
              : 'bg-violet-500/10 text-violet-400 border border-violet-500/30'
          }`}>
            {status}
          </p>
        )}

        {/* Order Info */}
        {orderData && (
          <div className="p-4 bg-[var(--surface-hover)] rounded-xl text-sm border border-[var(--border-color)]">
            <p className="text-[var(--text-secondary)]">
              You'll receive: <span className="text-[var(--text-primary)] font-semibold">{orderData.outAmount} tokens</span>
            </p>
            <p className="text-[var(--text-secondary)] mt-1">
              Execution Mode: <span className="text-[var(--text-primary)]">{orderData.executionMode}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
