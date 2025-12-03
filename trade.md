Trade Tokens with the DFlow Trade API
Get started with DFlow Trade API

The DFlow Trade API provides a unified interface for trading tokens across both spot and prediction markets on Solana. The Trade API offers a simple workflow with a single endpoint to request orders, automatically handling both synchronous (atomic) and asynchronous (multi-transaction) execution.
This quickstart assumes familiarity with Solana’s transaction and network connection logic. If unfamiliar, please refer to the Solana Cookbook.
1
Request an Order

The Trade API’s GET /order endpoint returns a quote and open transaction in a single request.
Request an Order

2
Sign and Submit the Transaction

Deserialize the transaction, sign it with your keypair, and submit it to Solana using your RPC connection.
Sign and Submit the Transaction

3
Monitor Order Status

How you monitor order completion depends on the executionMode returned from the order request:
Sync trades execute atomically in a single transaction. Use standard RPC confirmation.
Async trades execute across multiple transactions. Use the /order-status endpoint to poll for completion.
Monitor Sync Trade

For synchronous trades that execute atomically, use standard Solana transaction confirmation:

Copy

Ask AI
if (orderData.executionMode === "sync") {
  /// Monitor transaction status using getSignatureStatuses
  let status;

  do {
    const statusResult = await connection.getSignatureStatuses([signature]);
    status = statusResult.value[0];

    if (!status) {
      console.log("Waiting for transaction confirmation...");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } while (
    !status ||
    status.confirmationStatus === "processed" ||
    status.confirmationStatus === "confirmed"
  );

  /// Check if transaction succeeded or failed
  if (status.err) {
    console.error("Transaction failed:", status.err);
  } else {
    console.log(`Trade completed successfully in slot ${status.slot}`);
  }
}
Monitor Async Trade

For asynchronous trades that execute across multiple transactions, poll the /order-status endpoint:

Copy

Ask AI
if (orderData.executionMode === "async") {
  let status;
  let fills = [];

  do {
    /// Poll the order status endpoint
    const statusResponse = await fetch(
      `${API_BASE_URL}/order-status?signature=${signature}`
    );
    const statusData = await statusResponse.json();

    status = statusData.status;
    fills = statusData.fills || [];

    console.log(`Order status: ${status}`);

    /// Wait before polling again if order is still open
    if (status === "open" || status === "pendingClose") {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  } while (status === "open" || status === "pendingClose");

  /// Process final status
  switch (status) {
    case "closed": {
      if (fills.length > 0) {
        console.log(`Trade completed`);
      } else {
        console.log("Order was closed without any fills");
      }
      break;
    }
    case "pendingClose": {
      if (fills.length > 0) {
        console.log(`Trade ready to close`);
      } else {
        console.log("Order is ready to close without any fills");
      }
      break;
    }
    case "failed": {
      console.log("Order failed to execute");
      break;
    }
  }
}


Trade API
Swap Tokens with Declarative Swaps
Get started with DFlow Swap API

Declarative Swaps allow Solana users to trade tokens with less slippage, lower latency, and better pricing. Using Declarative Swaps through DFlow Swap API is simple. DFlow Swap API aggregates liquidity from all the major Solana DEXs and offers an API for trading any SPL token.
This quickstart assumes familiarity with Solana’s transaction and network connection logic. If unfamiliar, please refer to the Solana Cookbook.
1
Request a Quote

DFlow Swap API returns a quote specific to the token pair, amount, slippage tolerance, platform fee and other parameters.
A route is calculated for the swap at this step, but not hardened into the transaction. Instead, the quote is committed, and the route plan will be recalculated at the time the intent is submitted.
Request a Quote


Copy

Ask AI
const SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/// Amount of SOL to swap to USDC
const amount = 1_000_000_000;

/// Slippage tolerance in bps
const slippageBps = 1;

/// Base URL for the DFlow Swap API
const AGGREGATOR_API_BASE_URL = "https://quote-api.dflow.net";

const queryParams = new URLSearchParams();
queryParams.append('inputMint', SOL);
queryParams.append('outputMint', USDC);
queryParams.append('amount', amount.toString());

queryParams.append('userPublicKey', keypair.publicKey.toBase58());
queryParams.append('slippageBps', slippageBps.toString());

const intentResponse = await fetch(`${AGGREGATOR_API_BASE_URL}/intent?${queryParams.toString()}`);
const intentData = await intentResponse.json();
2
Sign the Intent

Signing the intent guarantees the minimum amount of output tokens, but does not commit to any given route plan to achieve the minimum amount of output tokens.
Sign the Intent


Copy

Ask AI
const transaction = intentData.openTransaction;
const transactionBytes = Buffer.from(transaction, 'base64');
const openTransaction = Transaction.from(transactionBytes);

openTransaction.sign(keypair);
3
Submit the Intent

Intents are submitted to the DFlow Aggregator, which optimizes the execution of the swap based on network conditions.
Submit the Intent


Copy

Ask AI
const response = await fetch(`${AGGREGATOR_API_BASE_URL}/submit-intent`, {
    method: "POST",
    headers: {
    "Content-Type": "application/json",
    },
    body: JSON.stringify({
        quoteResponse: intentData,
        signedOpenTransaction: Buffer.from(openTransaction.serialize()).toString("base64"),
    }),
});
const submitIntentData = await response.json();
4
Monitor the Intent

After submitting the Intent, you can monitor its status using the monitorOrder helper function from the @dflow-protocol/swap-api-utils package.
Monitor the Intent


Copy

Ask AI
const result = await monitorOrder({
    connection,
    intent: intentData,
    signedOpenTransaction: openTransaction,
    submitIntentResponse: submitIntentData,
});

switch (result.status) {
    case ORDER_STATUS.CLOSED: {
        if (result.fills.length > 0) {
            // Order was filled and closed
            const qtyIn = result.fills.reduce((acc, x) => acc + x.qtyIn, 0n);
            const qtyOut = result.fills.reduce((acc, x) => acc + x.qtyOut, 0n);
            console.log(`Order succeeded: sent ${qtyIn}, received ${qtyOut}`);
        } else {
            // Order was closed without any fills
            console.log("Order failed");
        }
        break;
    }
    case ORDER_STATUS.PENDING_CLOSE: {
        if (result.fills.length > 0) {
            // Order was filled and is now closable
            const qtyIn = result.fills.reduce((acc, x) => acc + x.qtyIn, 0n);
            const qtyOut = result.fills.reduce((acc, x) => acc + x.qtyOut, 0n);
            console.log(`Order succeeded: sent ${qtyIn}, received ${qtyOut}`);
        } else {
            // Order was not filled and is now closable
            console.log("Order failed");
        }
        break;
    }
    case ORDER_STATUS.OPEN_EXPIRED: {
        // Transaction to open the order expired
        console.log("Transaction expired. Try again with a higher slippage tolerance.");
        break;
    }
    case ORDER_STATUS.OPEN_FAILED: {
        // Transaction to open the order was executed and failed
        console.log("Order failed", result.transactionError);
        break;
    }
}