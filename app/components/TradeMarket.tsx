'use client';

import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import { requestOrder, getOrderStatus, OrderResponse, USDC_MINT } from '../lib/tradeApi';
import { Market } from '../lib/api';
import { parseMarketTicker, formatMarketTitle } from '../lib/marketUtils';

interface TradeMarketProps {
  market: Market;
}

export default function TradeMarket({ market }: TradeMarketProps) {
  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [orderData, setOrderData] = useState<OrderResponse | null>(null);

  const getMintAddress = (type: 'yes' | 'no'): string | undefined => {
    // Accounts object uses settlement mint (USDC) as the key
    // Format: market.accounts[USDC_MINT] = { yesMint, noMint, ... }
    if (market.accounts && typeof market.accounts === 'object') {
      // Try USDC_MINT first (most common settlement token)
      const usdcAccount = (market.accounts as any)[USDC_MINT];
      if (usdcAccount) {
        const mint = type === 'yes' ? usdcAccount.yesMint : usdcAccount.noMint;
        if (mint) {
          console.log(`Found ${type} mint from accounts[${USDC_MINT}]:`, mint);
          return mint;
        }
      }
      
      // If USDC not found, try any settlement mint in accounts
      const accountKeys = Object.keys(market.accounts);
      for (const key of accountKeys) {
        const account = (market.accounts as any)[key];
        if (account && typeof account === 'object') {
          const mint = type === 'yes' ? account.yesMint : account.noMint;
          if (mint) {
            console.log(`Found ${type} mint from accounts[${key}]:`, mint);
            return mint;
          }
        }
      }
    }
    
    // Fallback to direct properties (older format)
    const mint = type === 'yes' ? market.yesMint : market.noMint;
    if (mint) {
      console.log(`Found ${type} mint from direct property:`, mint);
      return mint;
    }
    
    console.error(`Could not find ${type} mint for market:`, market);
    return undefined;
  };

  const handleRequestOrder = async () => {
    if (!publicKey) {
      setStatus('Please connect your wallet first');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setStatus('Please enter a valid amount');
      return;
    }

    // Check market status
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

      // Convert amount to smallest unit (USDC has 6 decimals)
      const amountInSmallestUnit = Math.floor(parseFloat(amount) * 1_000_000);
      
      // Validate amount is at least 1 (minimum 0.000001 USDC)
      if (amountInSmallestUnit < 1) {
        setStatus('❌ Amount too small. Minimum is 0.000001 USDC');
        setLoading(false);
        return;
      }

      console.log('Requesting order with:', {
        userPublicKey: publicKey.toBase58(),
        inputMint: USDC_MINT,
        outputMint: outcomeMint,
        amount: amountInSmallestUnit.toString(),
        side,
        marketTicker: market.ticker,
        marketStatus: market.status,
        marketAccounts: market.accounts,
      });

      const order = await requestOrder({
        userPublicKey: publicKey.toBase58(),
        inputMint: USDC_MINT,
        outputMint: outcomeMint,
        amount: amountInSmallestUnit.toString(),
        slippageBps: 100, // 1% slippage
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
    if (!publicKey || !orderData || !signTransaction || !sendTransaction) {
      setStatus('Please connect your wallet and request an order first');
      return;
    }

    setLoading(true);
    setStatus('');

    try {
      // Deserialize transaction
      const transactionBytes = Uint8Array.from(
        atob(orderData.openTransaction),
        (c) => c.charCodeAt(0)
      );
      const transaction = Transaction.from(transactionBytes);

      // Sign transaction
      const signedTransaction = await signTransaction(transaction);

      // Submit transaction
      setStatus('Submitting transaction...');
      const signature = await sendTransaction(signedTransaction, connection);

      setStatus(`✅ Transaction submitted! Signature: ${signature}`);

      // Monitor order status based on execution mode
      if (orderData.executionMode === 'sync') {
        setStatus('Monitoring sync trade...');
        await monitorSyncTrade(signature);
      } else {
        setStatus('Monitoring async trade...');
        await monitorAsyncTrade(signature);
      }
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
      console.error('Error signing/submitting transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const monitorSyncTrade = async (signature: string) => {
    try {
      let status;
      do {
        const statusResult = await connection.getSignatureStatuses([signature]);
        status = statusResult.value[0];

        if (!status) {
          setStatus('Waiting for transaction confirmation...');
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } while (
        !status ||
        status.confirmationStatus === 'processed' ||
        status.confirmationStatus === 'confirmed'
      );

      if (status.err) {
        setStatus(`❌ Transaction failed: ${JSON.stringify(status.err)}`);
      } else {
        setStatus(`✅ Trade completed successfully in slot ${status.slot}`);
        setOrderData(null);
        setAmount('');
      }
    } catch (error: any) {
      setStatus(`❌ Error monitoring trade: ${error.message}`);
    }
  };

  const monitorAsyncTrade = async (signature: string) => {
    try {
      let status;
      let fills: any[] = [];

      do {
        const statusData = await getOrderStatus(signature);
        status = statusData.status;
        fills = statusData.fills || [];

        setStatus(`Order status: ${status}`);

        if (status === 'open' || status === 'pendingClose') {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } while (status === 'open' || status === 'pendingClose');

      switch (status) {
        case 'closed': {
          if (fills.length > 0) {
            const totalOut = fills.reduce((acc, f) => acc + BigInt(f.qtyOut || 0), 0n);
            setStatus(`✅ Trade completed! Received ${totalOut.toString()} tokens`);
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
          setStatus(`Order status: ${status}`);
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">
        {displayTitle}
      </h3>
      {dateInfo.formattedDate && (
        <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
            📅 Prediction Date: {dateInfo.formattedDate}
          </p>
        </div>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 font-mono">
        {market.ticker}
      </p>

      <div className="space-y-4">
        {/* Side Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Position
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setSide('yes')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                side === 'yes'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              YES
            </button>
            <button
              onClick={() => setSide('no')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                side === 'no'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              NO
            </button>
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
          />
        </div>

        {/* Action Buttons */}
        {!orderData ? (
          <button
            onClick={handleRequestOrder}
            disabled={!publicKey || loading}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Requesting Order...' : 'Request Order'}
          </button>
        ) : (
          <button
            onClick={handleSignAndSubmit}
            disabled={loading}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Processing...' : 'Sign & Submit Transaction'}
          </button>
        )}

        {/* Status */}
        {status && (
          <p className={`text-sm ${status.includes('✅') ? 'text-green-600' : status.includes('❌') ? 'text-red-600' : 'text-blue-600'}`}>
            {status}
          </p>
        )}

        {/* Order Info */}
        {orderData && (
          <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-sm">
            <p className="text-gray-600 dark:text-gray-400">
              You'll receive: {orderData.outAmount} tokens
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              Execution Mode: {orderData.executionMode}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

