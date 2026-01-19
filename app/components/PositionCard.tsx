'use client';

import { useRouter } from 'next/navigation';
import { useState, useRef } from 'react';
import { useWallets, useSignAndSendTransaction } from '@privy-io/react-auth/solana';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import type { AggregatedPosition } from '../lib/positionService';
import { formatMarketTitle } from '../lib/marketUtils';
import { requestOrder, getOrderStatus, USDC_MINT } from '../lib/tradeApi';
import { fetchMarketByMint } from '../lib/api';
import { useAppData } from '../contexts/AppDataContext';

interface PositionCardProps {
  position: AggregatedPosition;
  allowActions?: boolean;
  isPrevious?: boolean;
  onActionComplete?: () => void;
}

export default function PositionCard({ position, allowActions = false, isPrevious = false, onActionComplete }: PositionCardProps) {
  const router = useRouter();
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { triggerPositionsRefresh, currentUserId } = useAppData();
  const [actionLoading, setActionLoading] = useState<'sell' | 'redeem' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const solanaWallet = wallets[0];
  const walletAddress = solanaWallet?.address;

  // Use useRef to avoid recreating connection on every render
  const connection = useRef(new Connection(
    process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com',
    'confirmed'
  )).current;

  const handleClick = () => {
    // Redirect to event page if eventTicker exists, otherwise to market page
    if (position.market?.eventTicker) {
      router.push(`/event/${position.market.eventTicker}`);
    } else if (position.market?.ticker) {
      router.push(`/market/${position.market.ticker}`);
    }
  };

  // Format currency
  const formatCurrency = (value: number | null) => {
    if (value === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Format percentage
  const formatPercentage = (value: number | null) => {
    if (value === null) return 'N/A';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  // Get P&L color class
  const getPLColorClass = () => {
    if (position.profitLoss === null) return 'text-[var(--text-secondary)]';
    if (position.profitLoss > 0) return 'text-green-500';
    if (position.profitLoss < 0) return 'text-red-500';
    return 'text-[var(--text-secondary)]';
  };

  // Get side badge color
  const getSideBadgeClass = () => {
    return position.side === 'yes'
      ? 'bg-green-500/20 text-green-400 border-green-500/30'
      : 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  const eventTitle = position.market?.title || formatMarketTitle('', position.marketTicker);
  const marketSubtitle = position.side === 'yes'
    ? position.market?.yesSubTitle
    : position.market?.noSubTitle;

  const getOutcomeMintForSide = (): string | null => {
    const market = position.market as any;
    if (!market?.accounts) return null;
    // IMPORTANT:
    // Markets can have multiple settlement accounts (e.g. CASH + USDC).
    // For user trading via /order, we must use the outcome mints under the USDC settlement account.
    // Otherwise you can accidentally pick CASH outcome mints and /order will fail.
    const usdcAcct = market.accounts?.[USDC_MINT];
    if (usdcAcct) {
      if (position.side === 'yes' && usdcAcct?.yesMint) return usdcAcct.yesMint;
      if (position.side === 'no' && usdcAcct?.noMint) return usdcAcct.noMint;
    }

    // Fallback: any settlement account (best-effort)
    for (const v of Object.values(market.accounts)) {
      const acct = v as any;
      if (position.side === 'yes' && acct?.yesMint) return acct.yesMint;
      if (position.side === 'no' && acct?.noMint) return acct.noMint;
    }
    // fallback if top-level fields exist
    if (position.side === 'yes' && (market as any).yesMint) return (market as any).yesMint;
    if (position.side === 'no' && (market as any).noMint) return (market as any).noMint;
    return null;
  };

  const getRedeemEligibility = async (): Promise<{ eligible: boolean; settlementMint: string | null; reason?: string }> => {
    const outcomeMint = getOutcomeMintForSide();
    if (!outcomeMint) return { eligible: false, settlementMint: null, reason: 'Missing outcome mint' };

    // Always re-fetch market-by-mint for freshest settlement/redemption flags
    const market = await fetchMarketByMint(outcomeMint);
    const status = (market.status || '').toLowerCase();
    if (status !== 'determined' && status !== 'finalized') {
      return { eligible: false, settlementMint: null, reason: `Market not determined (${market.status})` };
    }

    const accounts = market.accounts as any;
    if (!accounts || typeof accounts !== 'object') {
      return { eligible: false, settlementMint: null, reason: 'Missing market accounts' };
    }

    // Prefer USDC if present, else first open redemption account
    const pickOpen = (): { settlementMint: string; acct: any } | null => {
      if (accounts[USDC_MINT]?.redemptionStatus === 'open') {
        return { settlementMint: USDC_MINT, acct: accounts[USDC_MINT] };
      }
      for (const [mint, acct] of Object.entries(accounts)) {
        if ((acct as any)?.redemptionStatus === 'open') return { settlementMint: mint, acct };
      }
      return null;
    };

    const open = pickOpen();
    if (!open) return { eligible: false, settlementMint: null, reason: 'Redemption not open yet' };

    const result = market.result as string; // "yes" | "no" | ""
    const acct = open.acct;

    // Scalar edge-case: result == "" and scalarOutcomePct exists -> both redeemable
    if (result === '' && acct?.scalarOutcomePct !== null && acct?.scalarOutcomePct !== undefined) {
      const isMatch = acct?.yesMint === outcomeMint || acct?.noMint === outcomeMint;
      return { eligible: isMatch, settlementMint: open.settlementMint, reason: isMatch ? undefined : 'Outcome mint mismatch' };
    }

    if (result === 'yes') {
      const isMatch = acct?.yesMint === outcomeMint;
      return { eligible: isMatch, settlementMint: open.settlementMint, reason: isMatch ? undefined : 'Not the winning side' };
    }
    if (result === 'no') {
      const isMatch = acct?.noMint === outcomeMint;
      return { eligible: isMatch, settlementMint: open.settlementMint, reason: isMatch ? undefined : 'Not the winning side' };
    }

    return { eligible: false, settlementMint: null, reason: 'Market result unavailable' };
  };

  const executeOrder = async (params: { inputMint: string; outputMint: string; amountRaw: string }) => {
    if (!walletAddress || !solanaWallet) throw new Error('Wallet not connected');

    const order = await requestOrder({
      userPublicKey: walletAddress,
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amountRaw,
      slippageBps: 100,
    });

    const txBase64 = order.transaction || order.openTransaction;
    if (!txBase64) throw new Error('No transaction in order response');

    const txBytes = new Uint8Array(Buffer.from(txBase64, 'base64'));

    // Use Privy's signAndSendTransaction which handles signing, sending, and confirmation
    const result = await signAndSendTransaction({
      transaction: txBytes,
      wallet: solanaWallet,
    });

    if (!result?.signature) {
      throw new Error('No signature received from transaction');
    }

    // Convert signature to string format (base58)
    let signatureString: string;
    if (typeof result.signature === 'string') {
      signatureString = result.signature;
    } else if (result.signature instanceof Uint8Array) {
      const bs58Module = await import('bs58');
      const bs58 = bs58Module.default || bs58Module;
      signatureString = bs58.encode(result.signature);
    } else {
      throw new Error('Invalid signature format');
    }

    // For async orders, wait for DFlow order status
    if (order.executionMode === 'async') {
      const maxAttempts = 20;
      let attempts = 0;
      while (attempts < maxAttempts) {
        const st = await getOrderStatus(signatureString);
        if (st.status === 'closed') break;
        if (st.status === 'failed') throw new Error('Execution failed');
        attempts++;
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (attempts >= maxAttempts) throw new Error('Still processing. Please check again shortly.');
    }
  };

  const handleSell = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setActionError(null);
    setActionLoading('sell');
    try {
      const outcomeMint = getOutcomeMintForSide();
      if (!outcomeMint) throw new Error('Missing outcome mint');

      // Outcome tokens use 6 decimals (per docs)
      const amountRaw = Math.floor(position.totalTokenAmount * 1_000_000).toString();
      if (!amountRaw || amountRaw === '0') throw new Error('Position size is 0');

      const order = await requestOrder({
        userPublicKey: walletAddress!,
        inputMint: outcomeMint,
        outputMint: USDC_MINT,
        amount: amountRaw,
        slippageBps: 100,
      });

      const txBase64 = order.transaction || order.openTransaction;
      if (!txBase64) throw new Error('No transaction in order response');

      const txBytes = new Uint8Array(Buffer.from(txBase64, 'base64'));

      // Use Privy's signAndSendTransaction
      const result = await signAndSendTransaction({
        transaction: txBytes,
        wallet: solanaWallet,
      });

      if (!result?.signature) {
        throw new Error('No signature received from transaction');
      }

      // Convert signature to string format (base58)
      let signatureString: string;
      if (typeof result.signature === 'string') {
        signatureString = result.signature;
      } else if (result.signature instanceof Uint8Array) {
        const bs58Module = await import('bs58');
        const bs58 = bs58Module.default || bs58Module;
        signatureString = bs58.encode(result.signature);
      } else {
        throw new Error('Invalid signature format');
      }

      // For async orders, wait for DFlow order status
      if (order.executionMode === 'async') {
        const maxAttempts = 20;
        let attempts = 0;
        while (attempts < maxAttempts) {
          const st = await getOrderStatus(signatureString);
          if (st.status === 'closed') break;
          if (st.status === 'failed') throw new Error('Execution failed');
          attempts++;
          await new Promise((r) => setTimeout(r, 1500));
        }
        if (attempts >= maxAttempts) throw new Error('Still processing. Please check again shortly.');
      }

      // Calculate the USDC amount received from the sell
      const receivedUsdc = order.outAmount
        ? Number(order.outAmount) / 1_000_000
        : position.currentValue || 0;

      triggerPositionsRefresh(); // Trigger global refresh
      onActionComplete?.();

      // Store the sell trade in the database (async, non-blocking)
      // We do this after triggering refresh to not block the UI
      if (currentUserId) {
        fetch('/api/trades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            marketTicker: position.marketTicker,
            eventTicker: position.market?.eventTicker || null,
            side: position.side,
            action: 'SELL',
            amount: receivedUsdc.toFixed(2), // Store USDC received (human-readable)
            executedInAmount: order.inAmount || null, // Actual tokens sold (in smallest unit)
            executedOutAmount: order.outAmount || null, // Actual USDC received (in smallest unit)
            transactionSig: signatureString,
          }),
        }).catch((dbError) => {
          console.error('Failed to store sell trade:', dbError);
          // Don't fail the sell operation if DB storage fails
        });
      }
    } catch (err: any) {
      setActionError(err.message || 'Sell failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRedeem = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setActionError(null);
    setActionLoading('redeem');
    try {
      const outcomeMint = getOutcomeMintForSide();
      if (!outcomeMint) throw new Error('Missing outcome mint');

      const elig = await getRedeemEligibility();
      if (!elig.eligible || !elig.settlementMint) {
        throw new Error(elig.reason || 'Not redeemable');
      }

      const amountRaw = Math.floor(position.totalTokenAmount * 1_000_000).toString();
      if (!amountRaw || amountRaw === '0') throw new Error('Position size is 0');

      await executeOrder({ inputMint: outcomeMint, outputMint: elig.settlementMint, amountRaw });
      triggerPositionsRefresh(); // Trigger global refresh
      onActionComplete?.();
    } catch (err: any) {
      setActionError(err.message || 'Redeem failed');
    } finally {
      setActionLoading(null);
    }
  };

  // Don't show actions for previous positions (already sold or closed markets)
  const canShowActions = allowActions && !!position.market && !isPrevious;
  const marketStatus = (position.market?.status || '').toLowerCase();
  const shouldOfferRedeem = marketStatus === 'determined' || marketStatus === 'finalized';

  // Get the outcome result for previous positions
  const getOutcomeResult = () => {
    if (!isPrevious) return null;
    const market = position.market;
    if (!market) return 'Closed';

    const result = (market as any).result?.toLowerCase();
    if (result === 'yes' || result === 'no') {
      const userWon = result === position.side;
      return userWon ? 'Won' : 'Lost';
    }

    // Position was sold (zero balance) or market closed
    if (position.totalTokenAmount === 0) {
      return 'Sold';
    }

    return 'Closed';
  };

  const outcomeResult = getOutcomeResult();

  // Get border color based on P&L and whether it's previous
  const getBorderColorClass = () => {
    if (isPrevious) {
      // Muted styling for previous positions
      return 'border-[var(--border-color)]/50';
    }
    if (position.profitLoss === null) return 'border-[var(--border-color)]';
    if (position.profitLoss > 0) return 'border-green-500/30 hover:border-green-500/50';
    if (position.profitLoss < 0) return 'border-red-500/30 hover:border-red-500/50';
    return 'border-[var(--border-color)]';
  };

  // Get the outcome badge color for previous positions
  const getOutcomeBadgeClass = () => {
    if (outcomeResult === 'Won') return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (outcomeResult === 'Lost') return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (outcomeResult === 'Sold') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-[var(--surface-hover)] text-[var(--text-tertiary)] border-[var(--border-color)]';
  };

  return (
    <div
      onClick={handleClick}
      className={`p-3 rounded-xl bg-[var(--card-bg)] border ${getBorderColorClass()} hover:shadow-lg transition-all cursor-pointer group ${isPrevious ? 'opacity-75 hover:opacity-90' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Event Image */}
        <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-white/20 to-gray-400/20 border border-[var(--border-color)]">
          {position.eventImageUrl ? (
            <img
              src={position.eventImageUrl}
              alt={eventTitle}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-lg">📊</div>';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg">
              📊
            </div>
          )}
        </div>

        {/* Position Details */}
        <div className="flex-1 min-w-0">
          {/* Header Row: Title + Action Button */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate group-hover:text-white transition-colors flex-1">
              {eventTitle}
            </h3>

            {/* Compact Action Button in Header */}
            {canShowActions && (
              <button
                onClick={shouldOfferRedeem ? handleRedeem : handleSell}
                disabled={actionLoading !== null}
                className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${shouldOfferRedeem
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black hover:from-amber-400 hover:to-yellow-400'
                  : 'bg-white/90 text-black hover:bg-white'
                  }`}
              >
                {actionLoading === 'sell' || actionLoading === 'redeem'
                  ? '...'
                  : shouldOfferRedeem ? 'Redeem' : 'Sell'}
              </button>
            )}

            {/* Outcome Badge for Previous Positions */}
            {isPrevious && outcomeResult && (
              <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getOutcomeBadgeClass()}`}>
                {outcomeResult === 'Won' && '🏆'}
                {outcomeResult === 'Lost' && '❌'}
                {outcomeResult === 'Sold' && '💰'}
                {outcomeResult}
              </span>
            )}
          </div>

          {/* Side Badge + Trade Count */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${getSideBadgeClass()}`}>
              {position.side.toUpperCase()}
            </span>
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {position.tradeCount} trade{position.tradeCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Compact Stats Row */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              {/* Current Value */}
              <div>
                <span className="text-[10px] text-[var(--text-tertiary)] block">Value</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {formatCurrency(position.currentValue)}
                </span>
              </div>

              {/* Cost Basis */}
              {position.totalCostBasis > 0 && (
                <div>
                  <span className="text-[10px] text-[var(--text-tertiary)] block">Cost</span>
                  <span className="text-[var(--text-secondary)]">
                    {formatCurrency(position.totalCostBasis)}
                  </span>
                </div>
              )}

              {/* Total P&L (Realized + Unrealized) */}
              {position.totalPnL !== null && position.totalPnL !== undefined && (
                <div>
                  <span className="text-[10px] text-[var(--text-tertiary)] block">P&L</span>
                  <span className={`font-semibold ${getPLColorClass()}`}>
                    {position.totalPnL >= 0 ? '+' : ''}{formatCurrency(position.totalPnL)}
                    {position.profitLossPercentage !== null && (
                      <span className="ml-1 text-[10px] opacity-80">
                        ({formatPercentage(position.profitLossPercentage)})
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* Realized/Unrealized Breakdown (subtle, right-aligned) */}
            <div className="text-right">
              {position.realizedPnL !== 0 && (
                <div className="text-[10px]">
                  <span className="text-[var(--text-tertiary)]">Realized: </span>
                  <span className={position.realizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {position.realizedPnL >= 0 ? '+' : ''}{formatCurrency(position.realizedPnL)}
                  </span>
                </div>
              )}
              {position.unrealizedPnL !== null && position.unrealizedPnL !== undefined && (
                <div className="text-[10px]">
                  <span className="text-[var(--text-tertiary)]">Unrealized: </span>
                  <span className={position.unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {position.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(position.unrealizedPnL)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Error Display */}
          {actionError && (
            <div className="mt-2 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
              {actionError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

