Redeem Determined Market Outcome Tokens
How to redeem determined prediction market outcome tokens for stablecoins

This guide shows you how to redeem determined prediction market outcome tokens by checking if they’re redeemable and requesting a redemption order through the DFlow Trade API.
This quickstart assumes you already have a list of outcome token mints you want to redeem. If you need to discover your positions first, see the User Prediction Positions guide.
Redemption involves trading expired OutcomeTokens for the stablecoin you opened your position with. For more details on the settlement process, see the Event Settlement and Redemption concept guide.
Note: Outcome tokens always have 6 decimals. An amount of 1000000 represents one outcome token.
​
Overview
To redeem determined market outcome tokens, you’ll need to:
Check if the outcome token is redeemable by verifying market status and redemption availability
Request a redemption order using the DFlow Trade API
Sign and submit the transaction (same process as regular trading)
1
Check if Outcome Token is Redeemable

Use the /api/v1/market/by-mint/{mint_address} endpoint to fetch market details and verify that the outcome token is redeemable. A token is redeemable when:
The market status is "determined" or "finalized"
The redemption status for the settlement mint is "open"
Either:
The market result ("yes" or "no") matches the user’s outcome token (the outcome mint must match the yesMint or noMint for the determined side), OR
The market result is empty ("") and scalarOutcomePct is defined (rare edge case - see note below)
Edge Case: Scalar Outcome Payouts
In rare cases, a market may have redemptionStatus = "open" but result = "" (no result defined). In this scenario, use scalarOutcomePct to determine the payout:
scalarOutcomePct represents the payout percentage for YES tokens in basis points (0-10000, where 10000 = 100%)
YES token payout = scalarOutcomePct / 10000
NO token payout = (10000 - scalarOutcomePct) / 10000
Example: If scalarOutcomePct = 5000, then:
YES tokens redeem for 50% (5000/10000 = 0.5)
NO tokens redeem for 50% ((10000-5000)/10000 = 0.5)
Both YES and NO tokens are redeemable in this case.
Check Redemption Eligibility

/// Base URL for the DFlow Prediction Market Metadata API
const METADATA_API_BASE_URL = "https://dev-prediction-markets-api.dflow.net";

/// Settlement mint constant (USDC)
/// If you only support one settlement mint, use this constant
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/// Outcome token mint address (YES or NO token)
const outcomeMint = "OUTCOME_TOKEN_MINT_ADDRESS_HERE";

/// Fetch market details by mint address
const response = await fetch(
  `${METADATA_API_BASE_URL}/api/v1/market/by-mint/${outcomeMint}`,
  {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  }
);

if (!response.ok) {
  throw new Error("Failed to fetch market details");
}

const market = await response.json();

/// Check if market is determined (status can be "determined" or "finalized")
if (market.status !== "determined" && market.status !== "finalized") {
  throw new Error(`Market is not determined. Current status: ${market.status}`);
}

/// Check if the outcome mint matches the market result
/// The result can be "yes", "no", or "" (empty string for scalar outcomes)
const result = market.result; // "yes", "no", or ""
let isDeterminedOutcome = false;
let settlementMint;

/// Option 1: Use a constant settlement mint (e.g., USDC)
/// If you only support one settlement mint, use this approach
if (market.accounts[USDC_MINT]) {
  const usdcAccount = market.accounts[USDC_MINT];

  /// Check if redemption is open
  if (usdcAccount.redemptionStatus === "open") {
    /// Case 1: Standard determined outcome (result is "yes" or "no")
    if (result === "yes" || result === "no") {
      if (
        (result === "yes" && usdcAccount.yesMint === outcomeMint) ||
        (result === "no" && usdcAccount.noMint === outcomeMint)
      ) {
        isDeterminedOutcome = true;
        settlementMint = USDC_MINT;
      }
    }
    /// Case 2: Scalar outcome (result is empty, use scalarOutcomePct)
    /// In this rare case, both YES and NO tokens are redeemable
    else if (
      result === "" &&
      usdcAccount.scalarOutcomePct !== null &&
      usdcAccount.scalarOutcomePct !== undefined
    ) {
      /// Both YES and NO tokens are redeemable when scalarOutcomePct is defined
      if (
        usdcAccount.yesMint === outcomeMint ||
        usdcAccount.noMint === outcomeMint
      ) {
        isDeterminedOutcome = true;
        settlementMint = USDC_MINT;

        /// Calculate payout percentages for display/logging
        const yesPayoutPct = usdcAccount.scalarOutcomePct / 10000;
        const noPayoutPct = (10000 - usdcAccount.scalarOutcomePct) / 10000;
        console.log(
          `Scalar outcome detected. YES payout: ${
            yesPayoutPct * 100
          }%, NO payout: ${noPayoutPct * 100}%`
        );
      }
    }
  } else {
    throw new Error(`Redemption is not open for ${outcomeMint}`);
  }
}

/// Option 2: Find settlement mint dynamically (if you support multiple)
/// Uncomment this if you need to support multiple settlement mints
/*
if (!settlementMint) {
  for (const [mint, account] of Object.entries(market.accounts)) {
    if (account.redemptionStatus === "open") {
      /// Case 1: Standard determined outcome
      if (result === "yes" || result === "no") {
        if (result === "yes" && account.yesMint === outcomeMint) {
          isDeterminedOutcome = true;
          settlementMint = mint;
          break;
        } else if (result === "no" && account.noMint === outcomeMint) {
          isDeterminedOutcome = true;
          settlementMint = mint;
          break;
        }
      }
      /// Case 2: Scalar outcome (both YES and NO are redeemable)
      else if (result === "" && account.scalarOutcomePct !== null && account.scalarOutcomePct !== undefined) {
        if (account.yesMint === outcomeMint || account.noMint === outcomeMint) {
          isDeterminedOutcome = true;
          settlementMint = mint;
          break;
        }
      }
    } else {
      throw new Error(`Redemption is not open for ${outcomeMint}`);
    }
  }
}
*/

if (!isDeterminedOutcome) {
  if (result === "") {
    throw new Error(
      `Outcome token does not match any outcome mint for this market. Token: ${outcomeMint}`
    );
  } else {
    throw new Error(
      `Outcome token does not match market result. Market result: ${result}, Token: ${outcomeMint}`
    );
  }
}

if (!settlementMint) {
  throw new Error("No settlement mint with open redemption status found");
}

const settlementAccount = market.accounts[settlementMint];

console.log("Token is redeemable!", {
  outcomeMint,
  settlementMint,
  redemptionStatus: settlementAccount.redemptionStatus,
  marketTitle: market.title,
});
2
Request Redemption Order

Use the Trade API /order endpoint to request a redemption order. The redemption is treated as a trade where you swap your outcome token for the settlement stablecoin.
Request Redemption Order

/// Base URL for the DFlow Trade API
const API_BASE_URL = "https://dev-quote-api.dflow.net";

/// Settlement mint constant (USDC)
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/// Outcome token mint (YES or NO token you hold)
const outcomeMint = "OUTCOME_TOKEN_MINT_ADDRESS_HERE";

/// Settlement mint (use the constant or the value found in Step 1)
const settlementMint = USDC_MINT;

/// Amount of outcome tokens to redeem. Outcome tokens always have 6 decimals.
const amount = 1000000; // Example: 1 outcome token (6 decimals)

/// User's public key
const userPublicKey = keypair.publicKey.toBase58();

const queryParams = new URLSearchParams();
queryParams.append("userPublicKey", userPublicKey);
queryParams.append("inputMint", outcomeMint);
queryParams.append("outputMint", settlementMint);
queryParams.append("amount", amount.toString());

const orderResponse = await fetch(
  `${API_BASE_URL}/order?${queryParams.toString()}`
).then((x) => x.json());

console.log(
  `Redemption order received! ${orderResponse.inAmount} of ${orderResponse.inputMint} is redeemable for ${orderResponse.outAmount} of ${orderResponse.outputMint}`
);
3
Sign and Submit Redemption Transaction

The redemption transaction follows the same workflow as regular trading. Deserialize the transaction, sign it with your keypair, and submit it to Solana. Then monitor the order status based on the execution mode.
Sign and Submit Transaction

Redemption uses the same Trade API workflow as regular trading. Follow the steps in the Trade Tokens quickstart to:
Sign the Transaction: Deserialize the transaction from base64 and sign it with your keypair
Submit to Solana: Send the signed transaction to your Solana RPC connection
Monitor Order Status:
For sync trades: Use standard RPC confirmation
For async trades: Poll the /order-status endpoint
The transaction returned from the redemption order request should be handled exactly like a regular trade transaction. See the Trade Tokens guide for complete code examples.
​
API Response Structure
​
Market Response
The /api/v1/market/by-mint/{mint_address} endpoint returns market data including:
Status: Market status ("determined" or "finalized" when outcome is finalized)
Result: The determined outcome as a string ("yes", "no", or "" for scalar outcomes)
Accounts: Object mapping settlement mint addresses (e.g., "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" for USDC) to account information:
yesMint: YES outcome token mint address
noMint: NO outcome token mint address
redemptionStatus: Redemption status ("open" when redemption is available, "pending" when not yet available)
scalarOutcomePct: Payout percentage for YES tokens in basis points (0-10000, where 10000 = 100%). Only present when result = "" and redemption is open. Used to calculate payouts for both YES and NO tokens in scalar outcome scenarios.
marketLedger: Market ledger account address
​
Order Response
The Trade API /order endpoint returns:
Transaction: Base64-encoded transaction ready to sign and submit
Execution Mode: "sync" (atomic) or "async" (multi-transaction)
Quote information including expected output amount
​
Next Steps
Trade Tokens
Learn how to sign, submit, and monitor trade transactions
User Positions
Discover how to retrieve a user’s existing prediction market positions
Event Settlement
Learn more about the settlement and redemption process
Market Endpoints
Explore all available prediction market metadata endpoints
Retrieve User Prediction Market Positions

Based on the search results, I can explain how to sell prediction market tokens for USDC.

## Selling Prediction Market Tokens to USDC

This is called **reducing your position**. Use the DFlow Trade API's `/order` endpoint to swap your outcome tokens back to USDC:

```typescript
const API_BASE_URL = "https://dev-quote-api.dflow.net";

const queryParams = new URLSearchParams();
queryParams.append("userPublicKey", yourWalletPublicKey);
queryParams.append("inputMint", outcomeTokenMint); // Your YES or NO token
queryParams.append("outputMint", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // USDC
queryParams.append("amount", amount.toString()); // Amount in smallest units (6 decimals)

const orderResponse = await fetch(`${API_BASE_URL}/order?${queryParams.toString()}`);
```

Then sign and submit the returned transaction. For async trades, poll `/order-status` to monitor completion.

**Note:** Outcome tokens always have 6 decimals (1000000 = 1 token).

```suggestions
(Trade Tokens Guide)[/quickstart/trade-tokens]
(Reduce Position Concept)[/concepts/prediction/reduce]
(User Prediction Positions)[/quickstart/user-prediction-positions]
```