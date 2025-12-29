'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets, useSignTransaction } from '@privy-io/react-auth/solana';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import { Market, Event } from '../lib/api';
import { requestOrder, getOrderStatus, OrderResponse, USDC_MINT } from '../lib/tradeApi';
import { useAuth } from './AuthContext';
import { useAppData } from '../contexts/AppDataContext';
import TradeQuoteModal from './TradeQuoteModal';

interface OrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    market: Market;
    event: Event;
}

// Receipt Card Component
function ReceiptCard({
    event,
    market,
    selectedSide,
    amount,
    setAmount,
    potentialReturn,
    onPlaceOrder,
    loading,
    status,
    authenticated,
}: {
    event: Event;
    market: Market;
    selectedSide: 'yes' | 'no';
    amount: string;
    setAmount: (val: string) => void;
    potentialReturn: string | null;
    onPlaceOrder: () => void;
    loading: boolean;
    status: string;
    authenticated: boolean;
}) {
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus input when receipt appears
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    const isValidAmount = amount && parseFloat(amount) > 0;
    const buttonDisabled = loading || !isValidAmount;

    return (
        <motion.div
            className="bg-white dark:bg-white rounded-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.25)] border-4 border-gray-800 w-full max-w-md mx-auto relative"
            initial={{ y: 100, opacity: 0, scale: 0.9 }}
            animate={{ y: -60, opacity: 1, scale: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 250 }}
            onClick={(e) => e.stopPropagation()}
            style={{
                background: 'linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%)',
            }}
        >
            {/* Cartoon-style receipt tear at top */}
            <div className="absolute -top-3 left-0 right-0 h-3 bg-white dark:bg-white" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='12' viewBox='0 0 20 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 12 L10 0 L20 12' fill='%23ffffff'/%3E%3C/svg%3E")`,
                backgroundSize: '20px 12px',
                backgroundRepeat: 'repeat-x',
            }} />

            <div className="p-6 pt-8">
                {/* Receipt Header */}
                <div className="text-center mb-6 pb-4 border-b-2 border-dashed border-gray-300">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <div className="w-2.5 h-2.5 bg-gray-900 rounded-full" />
                        <span className="text-xs font-black text-gray-900 tracking-widest uppercase">Order Receipt</span>
                        <div className="w-2.5 h-2.5 bg-gray-900 rounded-full" />
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{event.title}</p>
                </div>

                {/* Selected Outcome Badge */}
                <div className="mb-5 flex justify-center">
                    <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-black border-2 shadow-md ${selectedSide === 'yes'
                            ? 'bg-gradient-to-r from-cyan-400 to-cyan-500 text-white border-cyan-600'
                            : 'bg-gradient-to-r from-pink-400 to-pink-500 text-white border-pink-600'
                        }`}>
                        <span>Betting on {selectedSide.toUpperCase()}</span>
                    </div>
                </div>

                {/* Amount Input */}
                <div className="mb-5">
                    <label className="block text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">
                        💰 Your Bet Amount
                    </label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 text-2xl font-bold">$</span>
                        <input
                            ref={inputRef}
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            disabled={loading}
                            className="w-full pl-10 pr-4 py-4 border-3 border-gray-800 rounded-xl bg-gray-50 text-gray-900 placeholder-gray-400 focus:ring-4 focus:ring-cyan-300 focus:border-cyan-500 disabled:opacity-50 transition-all font-mono text-2xl font-bold shadow-inner"
                        />
                    </div>
                </div>

                {/* Potential Win Display */}
                <AnimatePresence>
                    {potentialReturn && (
                        <motion.div
                            className="mb-5 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-400 shadow-md"
                            initial={{ opacity: 0, height: 0, scale: 0.9 }}
                            animate={{ opacity: 1, height: 'auto', scale: 1 }}
                            exit={{ opacity: 0, height: 0 }}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-green-700 flex items-center gap-1">
                                    You could win
                                </span>
                                <span className="text-2xl font-black text-green-600 font-mono">
                                    ${potentialReturn}
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Place Order Button */}
                <button
                    onClick={onPlaceOrder}
                    disabled={buttonDisabled}
                    className={`
                        w-full py-4 rounded-xl font-black text-lg transition-all duration-200 shadow-lg transform border-3
                        ${buttonDisabled
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed border-gray-400'
                            : 'bg-gradient-to-r from-gray-800 to-gray-900 text-white hover:from-gray-900 hover:to-black border-gray-900 active:scale-[0.97] hover:shadow-xl'
                        }
                    `}
                >
                    {loading
                        ? '⏳ Placing Order...'
                        : !isValidAmount
                            ? 'Enter Amount'
                            : authenticated
                                ? 'Place Order'
                                : 'Sign in to Trade'}
                </button>

                {/* Status Message */}
                <AnimatePresence>
                    {status && (
                        <motion.div
                            className={`mt-4 p-3 rounded-lg text-sm text-center font-bold border-2 ${status.includes('✅')
                                ? 'bg-green-50 text-green-700 border-green-400'
                                : status.includes('❌')
                                    ? 'bg-red-50 text-red-700 border-red-400'
                                    : 'bg-blue-50 text-blue-700 border-blue-400'
                                }`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                        >
                            {status}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

export default function OrderModal({ isOpen, onClose, market, event }: OrderModalProps) {
    // Auth & wallet hooks
    const { ready, authenticated, user } = usePrivy();
    const { wallets } = useWallets();
    const { signTransaction } = useSignTransaction();
    const { currentUserId } = useAppData();
    const { requireAuth } = useAuth();

    // Connection for sending transactions
    const connection = new Connection(
        process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com',
        'confirmed'
    );

    // Modal state
    const [phase, setPhase] = useState<'offer' | 'receipt' | 'confirmed'>('offer');
    const [selectedSide, setSelectedSide] = useState<'yes' | 'no' | null>(null);

    // Trade state
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');

    // Quote modal state
    const [showQuoteModal, setShowQuoteModal] = useState(false);
    const [pendingTradePayload, setPendingTradePayload] = useState<any | null>(null);
    const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
    const [lastQuoteSummary, setLastQuoteSummary] = useState<{
        estimatedSpendUsdc?: string;
        estimatedTokens?: string;
        entryPrice?: string;
    } | null>(null);

    const solanaWallet = wallets[0];
    const walletAddress = solanaWallet?.address;

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setPhase('offer');
            setSelectedSide(null);
            setAmount('');
            setStatus('');
            setLoading(false);
        }
    }, [isOpen]);

    // Calculate potential return
    const calculatePotentialReturn = useCallback((): string | null => {
        if (!amount || parseFloat(amount) <= 0 || !selectedSide) return null;
        const price = selectedSide === 'yes'
            ? (market.yesAsk ? parseFloat(market.yesAsk) : null)
            : (market.noAsk ? parseFloat(market.noAsk) : null);
        if (!price || price <= 0) return null;
        return (parseFloat(amount) / price).toFixed(2);
    }, [amount, selectedSide, market]);

    const potentialReturn = calculatePotentialReturn();

    // Handle pill selection
    const handlePillSelect = (side: 'yes' | 'no') => {
        setSelectedSide(side);
        // Small delay to show selection before transition
        setTimeout(() => {
            setPhase('receipt');
        }, 200);
    };

    // Get mint address helper
    const getMintAddress = (type: 'yes' | 'no'): string | undefined => {
        if (market.accounts && typeof market.accounts === 'object') {
            const usdcAccount = (market.accounts as any)[USDC_MINT];
            if (usdcAccount) {
                const mint = type === 'yes' ? usdcAccount.yesMint : usdcAccount.noMint;
                if (mint) return mint;
            }
            const accountKeys = Object.keys(market.accounts);
            for (const key of accountKeys) {
                const account = (market.accounts as any)[key];
                if (account && typeof account === 'object') {
                    const mint = type === 'yes' ? account.yesMint : account.noMint;
                    if (mint) return mint;
                }
            }
        }
        return type === 'yes' ? market.yesMint : market.noMint;
    };

    // Place order handler
    const handlePlaceOrder = async () => {
        if (!authenticated) {
            requireAuth('Sign in to place your trade');
            return;
        }

        if (!ready || !walletAddress || !user || !selectedSide) {
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

        const outputMint = getMintAddress(selectedSide);
        if (!outputMint) {
            setStatus('❌ Unable to find market token mint address');
            return;
        }

        setLoading(true);
        setStatus('Requesting order...');

        try {
            const amountInSmallestUnit = Math.floor(parseFloat(amount) * 1_000_000).toString();

            const orderResponse: OrderResponse = await requestOrder({
                userPublicKey: walletAddress,
                inputMint: USDC_MINT,
                outputMint: outputMint,
                amount: amountInSmallestUnit,
                slippageBps: 100,
            });

            setStatus('Signing transaction...');

            const transactionBase64 = orderResponse.transaction || orderResponse.openTransaction;
            if (!transactionBase64) {
                throw new Error('No transaction found in order response');
            }

            const transactionBytes = new Uint8Array(Buffer.from(transactionBase64, 'base64'));

            const signResult = await signTransaction({
                transaction: transactionBytes,
                wallet: solanaWallet,
            });

            if (!signResult?.signedTransaction) {
                throw new Error('No signed transaction received');
            }

            const signedTxBytes = signResult.signedTransaction instanceof Uint8Array
                ? signResult.signedTransaction
                : new Uint8Array(signResult.signedTransaction);

            setStatus('Sending transaction...');

            const signedTransaction = VersionedTransaction.deserialize(signedTxBytes);
            const signature = await connection.sendTransaction(signedTransaction, {
                skipPreflight: true,
                maxRetries: 3,
            });

            setStatus('Transaction submitted! Confirming...');

            // Wait for confirmation
            const maxAttempts = 30;
            let attempts = 0;
            let confirmationStatus;

            while (attempts < maxAttempts) {
                const statusResult = await connection.getSignatureStatuses([signature]);
                confirmationStatus = statusResult.value[0];

                if (confirmationStatus?.err) {
                    throw new Error(`Transaction failed: ${JSON.stringify(confirmationStatus.err)}`);
                }

                if (confirmationStatus &&
                    (confirmationStatus.confirmationStatus === 'confirmed' ||
                        confirmationStatus.confirmationStatus === 'finalized')) {
                    break;
                }

                await new Promise((resolve) => setTimeout(resolve, 1000));
                attempts++;
            }

            if (attempts >= maxAttempts) {
                throw new Error('Transaction confirmation timeout');
            }

            if (!confirmationStatus ||
                (confirmationStatus.confirmationStatus !== 'confirmed' &&
                    confirmationStatus.confirmationStatus !== 'finalized')) {
                throw new Error('Transaction not confirmed');
            }

            setStatus('Transaction confirmed!');

            if (!currentUserId) {
                throw new Error('User not synced. Please refresh and try again.');
            }

            // Handle async execution mode
            if (orderResponse.executionMode === 'async') {
                setStatus('⏳ Order is processing...');
                const maxAsyncAttempts = 45;
                let asyncAttempts = 0;
                while (asyncAttempts < maxAsyncAttempts) {
                    const st = await getOrderStatus(signature);
                    if (st.status === 'closed') break;
                    if (st.status === 'failed') {
                        throw new Error('Trade execution failed');
                    }
                    asyncAttempts++;
                    await new Promise((r) => setTimeout(r, 2000));
                }
                if (asyncAttempts >= maxAsyncAttempts) {
                    throw new Error('Trade still processing. Please check again.');
                }
            }

            // Calculate entry price
            const spentUsdc = orderResponse.inAmount
                ? Number(orderResponse.inAmount) / 1_000_000
                : Number(amountInSmallestUnit) / 1_000_000;

            const receivedTokens = orderResponse.outAmount
                ? Number(orderResponse.outAmount) / 1_000_000
                : null;

            let entryPrice: number | null = null;
            if (spentUsdc && receivedTokens && receivedTokens > 0) {
                entryPrice = spentUsdc / receivedTokens;
            }

            setLastQuoteSummary({
                estimatedSpendUsdc: spentUsdc?.toFixed(6),
                estimatedTokens: receivedTokens?.toFixed(6),
                entryPrice: entryPrice?.toFixed(10),
            });

            const tradePayload = {
                userId: currentUserId,
                marketTicker: market.ticker,
                eventTicker: market.eventTicker || null,
                side: selectedSide,
                amount: amountInSmallestUnit,
                transactionSig: signature,
                entryPrice: entryPrice?.toString() || null,
            };

            setPendingTradePayload(tradePayload);
            setPhase('confirmed');
            setStatus('✅ Trade executed successfully!');
            setLoading(false);
            setShowQuoteModal(true);
        } catch (error: any) {
            let errorMessage = error.message || 'Unknown error occurred';
            if (error.message?.includes('User rejected')) {
                errorMessage = 'Transaction was cancelled';
            } else if (error.message?.includes('insufficient funds')) {
                errorMessage = 'Insufficient USDC balance';
            }
            setStatus(`❌ Error: ${errorMessage}`);
            setLoading(false);
        }
    };

    // Handle quote submit
    const handleQuoteSubmit = async (quote: string) => {
        if (!pendingTradePayload) return;
        setIsSubmittingQuote(true);

        try {
            const finalQuote = quote.trim();
            const payloadToStore = {
                ...pendingTradePayload,
                ...(finalQuote ? { quote: finalQuote } : {}),
            };

            const response = await fetch('/api/trades', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadToStore),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to store trade');
            }

            setShowQuoteModal(false);
            setPendingTradePayload(null);
            setAmount('');
            setStatus(finalQuote ? '✅ Trade shared!' : '✅ Trade saved!');

            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (error: any) {
            setStatus(`❌ Error: ${error.message}`);
        } finally {
            setIsSubmittingQuote(false);
        }
    };

    // Handle modal close
    const handleClose = () => {
        if (showQuoteModal && pendingTradePayload) {
            handleQuoteSubmit('');
            return;
        }
        onClose();
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        {/* Backdrop */}
                        <motion.div
                            className="absolute inset-0 bg-black/60 backdrop-blur-md"
                            onClick={handleClose}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        />

                        {/* Offer Phase - Cat Visual at Bottom */}
                        <AnimatePresence>
                            {phase === 'offer' && (
                                <motion.div
                                    className="absolute bottom-0 w-full z-10 flex flex-col items-center"
                                    initial={{ y: '100%' }}
                                    animate={{ y: 0 }}
                                    exit={{ y: '100%' }}
                                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {/* Market Title Above Cat */}
                                    <motion.div 
                                        className="text-center space-y-2 px-6 pb-4"
                                        initial={{ opacity: 0, y: -20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2, duration: 0.4 }}
                                    >
                                        <p className="text-xs text-white/50 font-semibold tracking-wide uppercase">
                                            {event.title}
                                        </p>
                                        <h2 className="text-xl font-bold text-white leading-tight drop-shadow-lg">
                                            {market.title}
                                        </h2>
                                    </motion.div>

                                    {/* Cat Image Container with Buttons */}
                                    <div className="relative w-full max-w-[500px] mx-auto">
                                        <div className="relative w-full aspect-square">
                                            <Image
                                                src="/pillcat2.png"
                                                alt="Choose your pill"
                                                fill
                                                className="object-contain drop-shadow-2xl"
                                                priority
                                            />
                                            
                                            {/* Interactive Pill Buttons - Positioned on Cat's Hands */}
                                            <div className="absolute inset-0 pointer-events-none">
                                                {/* YES Pill (Left Hand/Tray) */}
                                                <motion.button
                                                    onClick={() => handlePillSelect('yes')}
                                                    className="absolute pointer-events-auto group"
                                                    style={{
                                                        bottom: 'calc(32% + 25px)',
                                                        left: 'calc(8% - 25px)',
                                                        transform: 'translateX(0)',
                                                    }}
                                                    initial={{ opacity: 0, scale: 0, y: 20 }}
                                                    animate={{ 
                                                        opacity: 1, 
                                                        scale: 1, 
                                                        y: 0,
                                                    }}
                                                    whileHover={{ 
                                                        scale: 1.08,
                                                        y: -4,
                                                        transition: { duration: 0.2 }
                                                    }}
                                                    whileTap={{ scale: 0.95 }}
                                                    transition={{ 
                                                        delay: 0.3, 
                                                        type: "spring", 
                                                        stiffness: 300, 
                                                        damping: 15 
                                                    }}
                                                >
                                                    <div className="relative flex items-center justify-center w-28 h-12 sm:w-32 sm:h-14 bg-gradient-to-br from-cyan-300 via-cyan-400 to-cyan-500 rounded-full border-[2px] border-white/90 shadow-[0_4px_20px_rgba(34,211,238,0.6),0_0_40px_rgba(34,211,238,0.3)] group-hover:shadow-[0_6px_30px_rgba(34,211,238,0.8),0_0_60px_rgba(34,211,238,0.4)] transition-all duration-300">
                                                        {/* Inner highlight */}
                                                        <div className="absolute inset-1 bg-gradient-to-b from-white/30 to-transparent rounded-full" />
                                                        <span className="relative font-extrabold text-white text-lg sm:text-xl tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">YES</span>
                                                    </div>
                                                    {/* Glow effect */}
                                                    <div className="absolute inset-0 w-28 h-12 sm:w-32 sm:h-14 bg-cyan-400/20 rounded-full blur-xl group-hover:bg-cyan-400/40 transition-all duration-300 -z-10" />
                                                </motion.button>

                                                {/* NO Pill (Right Hand/Tray) */}
                                                <motion.button
                                                    onClick={() => handlePillSelect('no')}
                                                    className="absolute pointer-events-auto group"
                                                    style={{
                                                        bottom: 'calc(32% + 25px)',
                                                        right: 'calc(8% - 25px)',
                                                        transform: 'translateX(0)',
                                                    }}
                                                    initial={{ opacity: 0, scale: 0, y: 20 }}
                                                    animate={{ 
                                                        opacity: 1, 
                                                        scale: 1, 
                                                        y: 0,
                                                    }}
                                                    whileHover={{ 
                                                        scale: 1.08,
                                                        y: -4,
                                                        transition: { duration: 0.2 }
                                                    }}
                                                    whileTap={{ scale: 0.95 }}
                                                    transition={{ 
                                                        delay: 0.4, 
                                                        type: "spring", 
                                                        stiffness: 300, 
                                                        damping: 15 
                                                    }}
                                                >
                                                    <div className="relative flex items-center justify-center w-28 h-12 sm:w-32 sm:h-14 bg-gradient-to-br from-pink-400 via-pink-500 to-pink-600 rounded-full border-[2px] border-white/90 shadow-[0_4px_20px_rgba(236,72,153,0.6),0_0_40px_rgba(236,72,153,0.3)] group-hover:shadow-[0_6px_30px_rgba(236,72,153,0.8),0_0_60px_rgba(236,72,153,0.4)] transition-all duration-300">
                                                        {/* Inner highlight */}
                                                        <div className="absolute inset-1 bg-gradient-to-b from-white/30 to-transparent rounded-full" />
                                                        <span className="relative font-extrabold text-white text-lg sm:text-xl tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">NO</span>
                                                    </div>
                                                    {/* Glow effect */}
                                                    <div className="absolute inset-0 w-28 h-12 sm:w-32 sm:h-14 bg-pink-500/20 rounded-full blur-xl group-hover:bg-pink-500/40 transition-all duration-300 -z-10" />
                                                </motion.button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Receipt Phase - Form */}
                        <AnimatePresence>
                            {(phase === 'receipt' || phase === 'confirmed') && selectedSide && (
                                <div className="absolute bottom-0 w-full z-20">
                                    <ReceiptCard
                                        event={event}
                                        market={market}
                                        selectedSide={selectedSide}
                                        amount={amount}
                                        setAmount={setAmount}
                                        potentialReturn={potentialReturn}
                                        onPlaceOrder={handlePlaceOrder}
                                        loading={loading}
                                        status={status}
                                        authenticated={authenticated}
                                    />
                                </div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Quote Modal */}
            <TradeQuoteModal
                isOpen={showQuoteModal}
                onClose={() => {
                    if (!isSubmittingQuote && pendingTradePayload) {
                        handleQuoteSubmit('');
                        return;
                    }
                    setShowQuoteModal(false);
                    setPendingTradePayload(null);
                }}
                onSubmit={handleQuoteSubmit}
                tradeData={{
                    market,
                    side: selectedSide || 'yes',
                    budgetUsdc: amount,
                    estimatedSpendUsdc: lastQuoteSummary?.estimatedSpendUsdc,
                    estimatedTokens: lastQuoteSummary?.estimatedTokens,
                    entryPrice: lastQuoteSummary?.entryPrice,
                }}
                isSubmitting={isSubmittingQuote}
            />
        </>
    );
}
