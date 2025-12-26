'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useWallets, useSignTransaction } from '@privy-io/react-auth/solana';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import type { AggregatedPosition } from '../lib/positionService';
import { formatMarketTitle } from '../lib/marketUtils';
import { requestOrder, getOrderStatus, USDC_MINT } from '../lib/tradeApi';
import { fetchMarketByMint } from '../lib/api';

interface PositionCardProps {
  position: AggregatedPosition;
  allowActions?: boolean;
  onActionComplete?: () => void;
}

export default function PositionCard({ position, allowActions = false, onActionComplete }: PositionCardProps) {
  const router = useRouter();
  const { wallets } = useWallets();
  const { signTransaction } = useSignTransaction();
  const [actionLoading, setActionLoading] = useState<'sell' | 'redeem' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const solanaWallet = wallets[0];
  const walletAddress = solanaWallet?.address;

  const connection = new Connection(
    process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com',
    'confirmed'
  );

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
    const signResult = await signTransaction({ transaction: txBytes, wallet: solanaWallet });
    if (!signResult?.signedTransaction) throw new Error('No signed transaction received');

    const signedBytes =
      signResult.signedTransaction instanceof Uint8Array
        ? signResult.signedTransaction
        : new Uint8Array(signResult.signedTransaction);

    const signedTx = VersionedTransaction.deserialize(signedBytes);
    const signature = await connection.sendTransaction(signedTx, { skipPreflight: true, maxRetries: 3 });

    // sync: wait for chain confirmation; async: also wait order-status closed
    await connection.confirmTransaction(signature, 'confirmed');
    if (order.executionMode === 'async') {
      const maxAttempts = 45;
      let attempts = 0;
      while (attempts < maxAttempts) {
        const st = await getOrderStatus(signature);
        if (st.status === 'closed') break;
        if (st.status === 'failed') throw new Error('Execution failed');
        attempts++;
        await new Promise((r) => setTimeout(r, 2000));
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

      await executeOrder({ inputMint: outcomeMint, outputMint: USDC_MINT, amountRaw });
      onActionComplete?.();
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
      onActionComplete?.();
    } catch (err: any) {
      setActionError(err.message || 'Redeem failed');
    } finally {
      setActionLoading(null);
    }
  };

  const canShowActions = allowActions && !!position.market;
  const marketStatus = (position.market?.status || '').toLowerCase();
  const shouldOfferRedeem = marketStatus === 'determined' || marketStatus === 'finalized';

  // Get border color based on P&L
  const getBorderColorClass = () => {
    if (position.profitLoss === null) return 'border-[var(--border-color)]';
    if (position.profitLoss > 0) return 'border-green-500/30 hover:border-green-500/50';
    if (position.profitLoss < 0) return 'border-red-500/30 hover:border-red-500/50';
    return 'border-[var(--border-color)]';
  };

  return (
    <div
      onClick={handleClick}
      className={`p-4 rounded-xl bg-[var(--card-bg)] border ${getBorderColorClass()} hover:shadow-lg transition-all cursor-pointer group`}
    >
      <div className="flex items-start gap-3">
        {/* Event Image */}
        <div className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-[var(--border-color)]">
          {position.eventImageUrl ? (
            <img
              src={position.eventImageUrl}
              alt={eventTitle}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              onError={(e) => {
                // Fallback to icon if image fails to load
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-2xl">📊</div>';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl">
              📊
            </div>
          )}
        </div>

        {/* Position Details */}
        <div className="flex-1 min-w-0">
          {/* Event Title */}
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1 truncate group-hover:text-cyan-400 transition-colors">
            {eventTitle}
          </h3>

          {/* Market Subtitle */}
          {marketSubtitle && (
            <p className="text-xs text-[var(--text-secondary)] mb-2 line-clamp-2">
              {marketSubtitle}
            </p>
          )}

          {/* Position Side Badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${getSideBadgeClass()}`}>
              {position.side.toUpperCase()}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              {position.tradeCount} trade{position.tradeCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Current Valuation and P&L */}
          <div className="space-y-2">
            {/* Current Value */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)]">Current Value</span>
              <span className="text-base font-bold text-[var(--text-primary)]">
                {formatCurrency(position.currentValue)}
              </span>
            </div>

            {/* Profit/Loss with Percentage */}
            {position.profitLoss !== null && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-secondary)]">Profit/Loss</span>
                <div className="flex items-center gap-2">
                  <span className={`text-base font-bold ${getPLColorClass()}`}>
                    {position.profitLoss >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(position.profitLoss))}
                  </span>
                  {position.profitLossPercentage !== null && (
                    <span className={`text-sm font-semibold ${getPLColorClass()}`}>
                      ({formatPercentage(position.profitLossPercentage)})
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Current Price (small, subtle) */}
            {position.currentPrice !== null && (
              <div className="flex items-center justify-between pt-1 border-t border-[var(--border-color)]/50">
                <span className="text-xs text-[var(--text-secondary)]">Current Price</span>
                <span className="text-xs text-[var(--text-secondary)]">
                  {formatCurrency(position.currentPrice)}
                </span>
              </div>
            )}
          </div>

          {/* Actions (only on own profile) */}
          {canShowActions && (
            <div className="mt-3 flex flex-col gap-2">
              {actionError && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {actionError}
                </div>
              )}
              <div className="flex gap-2">
                {shouldOfferRedeem ? (
                  <button
                    onClick={handleRedeem}
                    disabled={actionLoading !== null}
                    className="flex-1 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {actionLoading === 'redeem' ? 'Redeeming…' : 'Redeem'}
                  </button>
                ) : (
                  <button
                    onClick={handleSell}
                    disabled={actionLoading !== null}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/90 hover:bg-white text-black text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {actionLoading === 'sell' ? 'Selling…' : 'Sell'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Market Status Indicator */}
      {position.market?.status && (
        <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-secondary)]">Market Status</span>
            <span className={`font-medium ${
              position.market.status === 'active' || position.market.status === 'open'
                ? 'text-green-400'
                : 'text-[var(--text-secondary)]'
            }`}>
              {position.market.status.charAt(0).toUpperCase() + position.market.status.slice(1)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

