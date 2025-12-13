'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import { Market } from '../lib/api';
import { parseMarketTicker, formatMarketTitle } from '../lib/marketUtils';
import { fetchMarketProbabilities, MarketProbabilities } from '../lib/probabilityUtils';
import { generateDummySignature, isDummyTradesEnabled, logDummyTradeWarning } from '../lib/dummyTradeUtils';
import TradeQuoteModal from './TradeQuoteModal';

// TODO: Remove when DFlow API is ready - Keep original imports commented
// import { useSignAndSendTransaction } from '@privy-io/react-auth/solana';
// import { Connection, Transaction } from '@solana/web3.js';
// import { requestOrder, getOrderStatus, OrderResponse, USDC_MINT } from '../lib/tradeApi';

interface TradeMarketProps {
  market: Market;
  initialSide?: 'yes' | 'no';
}

export default function TradeMarket({ market, initialSide = 'yes' }: TradeMarketProps) {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [side, setSide] = useState<'yes' | 'no'>(initialSide);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [probabilities, setProbabilities] = useState<MarketProbabilities>({
    yesProbability: null,
    noProbability: null,
    loading: true,
    error: null,
  });

  // TODO: Remove when DFlow API is ready - Dummy trade specific state
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [currentTradeId, setCurrentTradeId] = useState<string | null>(null);
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);

  // Calculate "to win" amount based on market price
  const calculateToWin = (): string | null => {
    if (!amount || parseFloat(amount) <= 0) return null;
    
    const price = side === 'yes' 
      ? (market.yesAsk ? parseFloat(market.yesAsk) : null)
      : (market.noAsk ? parseFloat(market.noAsk) : null);
    
    if (!price || price <= 0) return null;
    
    const toWin = parseFloat(amount) / price;
    return toWin.toFixed(2);
  };

  const toWinAmount = calculateToWin();

  // Get the first Solana wallet from useWallets
  const solanaWallet = wallets[0];
  const walletAddress = solanaWallet?.address;

  // Update side when initialSide changes
  useEffect(() => {
    setSide(initialSide);
  }, [initialSide]);

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

  // TODO: Remove when DFlow API is ready - Dummy trade handler
  const handleDummyTrade = async () => {
    if (!ready || !authenticated || !walletAddress || !user) {
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

    if (!isDummyTradesEnabled()) {
      setStatus('❌ Dummy trades are disabled. Please configure DFlow API.');
      return;
    }

    setLoading(true);
    setStatus('Placing order...');

    try {
      // Generate dummy signature
      const dummySignature = generateDummySignature();

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
        throw new Error('Failed to sync user');
      }

      const syncedUser = await syncResponse.json();

      // Create the trade in database (store amount as-is for dummy trades)
      const tradeResponse = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: syncedUser.id,
          marketTicker: market.ticker,
          eventTicker: market.eventTicker || null,
          side: side,
          amount: amount,
          transactionSig: dummySignature,
          isDummy: true,
        }),
      });

      if (!tradeResponse.ok) {
        const errorData = await tradeResponse.json();
        throw new Error(errorData.error || 'Failed to create trade');
      }

      const trade = await tradeResponse.json();
      setCurrentTradeId(trade.id);

      // Log warning for development
      logDummyTradeWarning({
        marketTicker: market.ticker,
        side: side,
        amount: amount,
        signature: dummySignature,
      });

      setStatus('✅ Order placed successfully!');
      
      // Open quote modal
      setShowQuoteModal(true);
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
      console.error('Error placing dummy trade:', error);
    } finally {
      setLoading(false);
    }
  };

  // TODO: Remove when DFlow API is ready - Quote submission handler
  const handleQuoteSubmit = async (quote: string) => {
    if (!currentTradeId || !user) return;

    setIsSubmittingQuote(true);

    try {
      if (quote.trim()) {
        // Update trade with quote
        const syncResponse = await fetch('/api/users/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            privyId: user.id,
            walletAddress: walletAddress,
          }),
        });

        if (!syncResponse.ok) {
          throw new Error('Failed to sync user');
        }

        const syncedUser = await syncResponse.json();

        const response = await fetch('/api/trades', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tradeId: currentTradeId,
            quote: quote,
            userId: syncedUser.id,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update trade quote');
        }
      }

      // Close modal and reset form
      setShowQuoteModal(false);
      setCurrentTradeId(null);
      setAmount('');
      setStatus('✅ Trade shared successfully!');

      // Clear status after 3 seconds
      setTimeout(() => {
        setStatus('');
      }, 3000);
    } catch (error: any) {
      console.error('Error submitting quote:', error);
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  const dateInfo = parseMarketTicker(market.ticker);
  const displayTitle = formatMarketTitle(market.title || 'Untitled Market', market.ticker);

  return (
    <>
      <div className="space-y-4">
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
                className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-200 ${side === 'yes'
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/25'
                  : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:bg-[var(--input-bg)]'
                  }`}
              >
                YES
              </button>
              <button
                onClick={() => setSide('no')}
                className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-200 ${side === 'no'
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
              disabled={loading}
              className="w-full px-4 py-3 border border-[var(--border-color)] rounded-xl bg-[var(--input-bg)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50 transition-all"
            />
            
            {/* To Win Display */}
            {toWinAmount && (
              <div className="mt-2 flex items-center justify-between animate-fadeIn">
                <span className="text-sm text-[var(--text-secondary)]">To win</span>
                <span className="text-lg font-bold text-green-400">
                  ${toWinAmount}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {(!ready || !authenticated || !walletAddress) && (
            <div className="mb-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-400 text-xs">
                {!ready ? 'Initializing...' : !authenticated ? 'Please log in' : !walletAddress ? 'Please connect your wallet' : ''}
              </p>
            </div>
          )}
          
          {/* TODO: Remove when DFlow API is ready - Dummy trade button */}
          <button
            onClick={handleDummyTrade}
            disabled={!ready || !authenticated || !walletAddress || loading || !amount || parseFloat(amount) <= 0}
            className="w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed transition-all font-semibold"
          >
            {loading ? 'Placing Order...' : !amount || parseFloat(amount) <= 0 ? 'Enter Amount' : 'Place Order'}
          </button>

          {/* Status */}
          {status && (
            <p className={`text-sm p-3 rounded-lg ${status.includes('✅')
              ? 'bg-green-500/10 text-green-400 border border-green-500/30'
              : status.includes('❌')
                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                : 'bg-violet-500/10 text-violet-400 border border-violet-500/30'
              }`}>
              {status}
            </p>
          )}
        </div>
      </div>

      {/* TODO: Remove when DFlow API is ready - Quote Modal */}
      <TradeQuoteModal
        isOpen={showQuoteModal}
        onClose={() => {
          setShowQuoteModal(false);
          setCurrentTradeId(null);
          setAmount('');
        }}
        onSubmit={handleQuoteSubmit}
        tradeData={{
          market,
          side,
          amount,
        }}
        isSubmitting={isSubmittingQuote}
      />
    </>
  );
}

/* TODO: Restore when DFlow API is ready - Original implementation below

// Keep original handleRequestOrder, handleSignAndSubmit, storeTrade, 
// monitorSyncTrade, monitorAsyncTrade functions here for future restoration

const handleRequestOrder = async () => {
  // Original DFlow API implementation
};

const handleSignAndSubmit = async () => {
  // Original transaction signing implementation
};

const storeTrade = async (signature: string) => {
  // Original trade storage implementation
};

const monitorSyncTrade = async (signature: string) => {
  // Original sync trade monitoring
};

const monitorAsyncTrade = async (signature: string) => {
  // Original async trade monitoring
};

*/
