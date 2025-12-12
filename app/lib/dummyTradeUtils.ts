/**
 * Dummy Trade Utilities
 * 
 * TODO: Remove when DFlow API is ready
 * This module provides utilities for creating dummy trades during development
 * when the DFlow API key is not available.
 */

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Check if dummy trades are enabled
 * Dummy trades should only be used in development/staging environments
 */
export function isDummyTradesEnabled(): boolean {
  // Allow dummy trades if explicitly enabled, or if not in production
  const enableDummyTrades = process.env.NEXT_PUBLIC_ENABLE_DUMMY_TRADES;
  const nodeEnv = process.env.NODE_ENV;
  
  if (enableDummyTrades === 'true') {
    return true;
  }
  
  // Default to enabled in development, disabled in production
  return nodeEnv !== 'production';
}

/**
 * Generate a random base58 string of specified length
 */
function generateBase58String(length: number): string {
  let result = '';
  const alphabetLength = BASE58_ALPHABET.length;
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * alphabetLength);
    result += BASE58_ALPHABET[randomIndex];
  }
  
  return result;
}

/**
 * Generate a realistic-looking Solana transaction signature
 * Solana signatures are base58-encoded and typically 87-88 characters long
 * 
 * Format: DUMMY_<timestamp>_<random_base58>
 * This makes it easy to identify dummy transactions while maintaining realistic format
 */
export function generateDummySignature(): string {
  if (!isDummyTradesEnabled()) {
    throw new Error(
      'Dummy trades are disabled in production. Please configure DFlow API credentials.'
    );
  }
  
  const timestamp = Date.now().toString(36); // Base36 timestamp for compactness
  const randomPart = generateBase58String(60); // Random base58 string
  
  // Construct signature: DUMMY prefix + timestamp + random part
  // Total length will be approximately 88 characters (similar to real Solana signatures)
  const signature = `DUMMY${timestamp}${randomPart}`;
  
  // Pad or trim to ensure consistent length (88 chars like real Solana signatures)
  const targetLength = 88;
  if (signature.length < targetLength) {
    return signature + generateBase58String(targetLength - signature.length);
  } else if (signature.length > targetLength) {
    return signature.substring(0, targetLength);
  }
  
  return signature;
}

/**
 * Check if a signature is a dummy signature
 */
export function isDummySignature(signature: string): boolean {
  return signature.startsWith('DUMMY');
}

/**
 * Validate dummy trade parameters
 */
export function validateDummyTradeParams(params: {
  userId: string;
  marketTicker: string;
  side: string;
  amount: string;
}): { valid: boolean; error?: string } {
  const { userId, marketTicker, side, amount } = params;
  
  if (!userId || userId.trim() === '') {
    return { valid: false, error: 'User ID is required' };
  }
  
  if (!marketTicker || marketTicker.trim() === '') {
    return { valid: false, error: 'Market ticker is required' };
  }
  
  if (side !== 'yes' && side !== 'no') {
    return { valid: false, error: 'Side must be either "yes" or "no"' };
  }
  
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return { valid: false, error: 'Amount must be a positive number' };
  }
  
  return { valid: true };
}

/**
 * Log a warning about dummy trade creation
 * This helps developers track when dummy trades are being used
 */
export function logDummyTradeWarning(tradeData: {
  marketTicker: string;
  side: string;
  amount: string;
  signature: string;
}): void {
  if (typeof window !== 'undefined') {
    console.warn(
      '⚠️ DUMMY TRADE CREATED:',
      {
        market: tradeData.marketTicker,
        side: tradeData.side,
        amount: tradeData.amount,
        signature: tradeData.signature,
        timestamp: new Date().toISOString(),
      }
    );
  }
}

