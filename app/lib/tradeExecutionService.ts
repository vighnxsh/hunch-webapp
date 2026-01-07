import { PrivyClient } from '@privy-io/server-auth';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import { requestOrder, OrderResponse, USDC_MINT } from './tradeApi';

const privyClient = new PrivyClient(
    process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
    process.env.PRIVY_APP_SECRET!,
    {
        walletApi: {
            authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY!
        }
    }
);

const connection = new Connection(
    process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com',
    'confirmed'
);

interface ExecuteTradeParams {
    followerPrivyId: string;
    followerWalletAddress: string;
    marketTicker: string;
    side: 'yes' | 'no';
    amount: number; // In dollars (will be converted to smallest unit)
    outputMint: string; // YES or NO token mint address
}

interface ExecuteTradeResult {
    success: boolean;
    transactionSignature?: string;
    error?: string;
}

/**
 * Execute a trade on behalf of a user using Privy server-side signing
 * This is used for copy trading where the follower may be offline
 */
export async function executeTradeServerSide(
    params: ExecuteTradeParams
): Promise<ExecuteTradeResult> {
    const { followerPrivyId, followerWalletAddress, marketTicker, side, amount, outputMint } = params;

    try {
        console.log(`[TradeExecution] Starting server-side trade for ${followerWalletAddress}`);
        console.log(`  Market: ${marketTicker}, Side: ${side}, Amount: $${amount}`);

        // 1. Convert amount to smallest unit (USDC has 6 decimals)
        const amountInSmallestUnit = Math.floor(amount * 1_000_000).toString();

        // 2. Request order from DFlow API
        const orderResponse: OrderResponse = await requestOrder({
            userPublicKey: followerWalletAddress,
            inputMint: USDC_MINT,
            outputMint: outputMint,
            amount: amountInSmallestUnit,
            slippageBps: 100, // 1% slippage
        });

        console.log(`[TradeExecution] Order received from DFlow, mode: ${orderResponse.executionMode}`);

        // 3. Get transaction from DFlow API response
        const transactionBase64 = orderResponse.transaction || orderResponse.openTransaction;
        if (!transactionBase64) {
            throw new Error('No transaction found in order response');
        }

        // 4. Decode transaction from base64
        const transactionBytes = Buffer.from(transactionBase64, 'base64');

        // 5. Get user's wallet information to retrieve wallet ID
        console.log(`[TradeExecution] Fetching user wallet info for ${followerPrivyId}`);
        const user = await privyClient.getUserById(followerPrivyId);

        if (!user || !user.linkedAccounts) {
            throw new Error('User not found or has no linked accounts');
        }

        // Find the Solana wallet
        // Note: Privy server SDK returns walletClient as undefined for embedded wallets
        // We identify Solana wallets by checking they have a valid wallet ID,
        // a non-Ethereum address, and the address matches
        const solanaWallet = user.linkedAccounts.find(
            (account: any) =>
                account.type === 'wallet' &&
                account.id && // Must have a wallet ID for server-side signing
                account.address &&
                typeof account.address === 'string' &&
                !account.address.startsWith('0x') && // Not Ethereum
                account.address === followerWalletAddress // Exact match (Solana addresses are case-sensitive)
        );

        if (!solanaWallet || !(solanaWallet as any).id) {
            console.error('[TradeExecution] Available accounts:', user.linkedAccounts.map((a: any) => ({
                type: a.type,
                walletClient: (a as any).walletClient,
                address: (a as any).address,
                id: (a as any).id
            })));
            throw new Error(`Solana wallet not found for address ${followerWalletAddress}`);
        }

        const walletId = (solanaWallet as any).id;
        console.log(`[TradeExecution] Found wallet ID: ${walletId}`);

        // 6. Deserialize transaction and get a fresh blockhash
        // DFlow's blockhash may have expired due to QStash delay
        console.log(`[TradeExecution] Preparing transaction with fresh blockhash`);
        const transaction = VersionedTransaction.deserialize(transactionBytes);

        // Get a fresh blockhash
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        console.log(`[TradeExecution] Fresh blockhash: ${blockhash.substring(0, 20)}...`);

        // Create a new transaction with the fresh blockhash
        // We need to reconstruct because VersionedTransaction messages are immutable
        const newMessage = transaction.message;
        (newMessage as any).recentBlockhash = blockhash;

        const newTransaction = new VersionedTransaction(newMessage, transaction.signatures);

        // 7. Sign and send transaction using Privy server SDK
        console.log(`[TradeExecution] Signing and sending transaction via Privy for wallet ${walletId}`);

        const result = await privyClient.walletApi.solana.signAndSendTransaction({
            walletId: walletId,
            caip2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', // Mainnet
            transaction: newTransaction,
            sponsor: false, // Not sponsoring gas for copy trades
        });

        if (!result || !result.hash) {
            throw new Error('Failed to sign and send transaction via Privy');
        }

        const signature = result.hash;
        console.log(`[TradeExecution] Transaction sent: ${signature}`);

        // 8. Wait for confirmation (for sync trades)
        if (orderResponse.executionMode === 'sync') {
            console.log(`[TradeExecution] Waiting for confirmation (sync mode)`);
            const maxAttempts = 30;
            let attempts = 0;

            while (attempts < maxAttempts) {
                const statusResult = await connection.getSignatureStatuses([signature]);
                const confirmationStatus = statusResult.value[0];

                // Check if transaction failed
                if (confirmationStatus?.err) {
                    throw new Error(`Transaction failed: ${JSON.stringify(confirmationStatus.err)}`);
                }

                // If confirmed or finalized, we're done
                if (confirmationStatus &&
                    (confirmationStatus.confirmationStatus === 'confirmed' ||
                        confirmationStatus.confirmationStatus === 'finalized')) {
                    console.log(`[TradeExecution] Transaction confirmed`);
                    break;
                }

                // Wait and retry
                await new Promise((resolve) => setTimeout(resolve, 1000));
                attempts++;
            }

            if (attempts >= maxAttempts) {
                throw new Error('Transaction confirmation timeout');
            }
        } else {
            // For async trades, just wait a bit
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        return {
            success: true,
            transactionSignature: signature,
        };

    } catch (error: any) {
        console.error(`[TradeExecution] Error executing trade:`, error);
        return {
            success: false,
            error: error.message || 'Unknown error',
        };
    }
}
