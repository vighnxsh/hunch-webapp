'use client';

import { useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Connection, Transaction } from '@solana/web3.js';
import { requestOrder, getOrderStatus, OrderResponse, USDC_MINT } from '../lib/tradeApi';
import { Market } from '../lib/api';
import { parseMarketTicker, formatMarketTitle } from '../lib/marketUtils';

interface TradeMarketProps {
  market: Market;
}

export default function TradeMarket({ market }: TradeMarketProps) {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [orderData, setOrderData] = useState<OrderResponse | null>(null);

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
    if (!ready || !authenticated || !walletAddress || !orderData || !activeWallet) {
      setStatus('Please connect your wallet and request an order first');
      return;
    }

    setLoading(true);
    setStatus('');

    try {
      const transactionBytes = Uint8Array.from(
        atob(orderData.openTransaction),
        (c) => c.charCodeAt(0)
      );
      const transaction = Transaction.from(transactionBytes);

      const signedTransaction = await activeWallet.signTransaction(transaction);

      setStatus('Submitting transaction...');
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());

      setStatus(`✅ Transaction submitted! Signature: ${signature}`);

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
            const totalOut = fills.reduce((acc, f) => acc + BigInt(f.qtyOut || 0), 0n);
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
    <div className="bg-gray-800/30 rounded-xl p-5 border border-gray-700/50">
      <h3 className="text-lg font-bold mb-2 text-white">
        {displayTitle}
      </h3>
      {dateInfo.formattedDate && (
        <div className="mb-3 p-2 bg-violet-500/10 border border-violet-500/30 rounded-lg">
          <p className="text-sm font-medium text-violet-300">
            📅 Prediction Date: {dateInfo.formattedDate}
          </p>
        </div>
      )}
      <p className="text-xs text-gray-500 mb-4 font-mono">
        {market.ticker}
      </p>

      <div className="space-y-4">
        {/* Side Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Position
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setSide('yes')}
              className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-200 ${
                side === 'yes'
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/25'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              YES
            </button>
            <button
              onClick={() => setSide('no')}
              className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-200 ${
                side === 'no'
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              NO
            </button>
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
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
            className="w-full px-4 py-3 border border-gray-700 rounded-xl bg-gray-800 text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50 transition-all"
          />
        </div>

        {/* Action Buttons */}
        {!orderData ? (
          <button
            onClick={handleRequestOrder}
            disabled={!ready || !authenticated || !walletAddress || loading}
            className="w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed transition-all font-semibold"
          >
            {loading ? 'Requesting Order...' : 'Request Order'}
          </button>
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
          <div className="p-4 bg-gray-800/50 rounded-xl text-sm border border-gray-700/50">
            <p className="text-gray-400">
              You'll receive: <span className="text-white font-semibold">{orderData.outAmount} tokens</span>
            </p>
            <p className="text-gray-400 mt-1">
              Execution Mode: <span className="text-white">{orderData.executionMode}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
