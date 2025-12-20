// Base URLs for the DFlow Trade / Quote API
// - In development we default to the dev quote API so you can make real trades with test capital.
// - In production, override these with the prod URL via env vars.
const TRADE_API_BASE_URL =
  process.env.NEXT_PUBLIC_PM_TRADE_API_BASE_URL ??
  "https://dev-quote-api.dflow.net";

const AGGREGATOR_API_BASE_URL =
  process.env.NEXT_PUBLIC_PM_AGGREGATOR_API_BASE_URL ??
  "https://dev-quote-api.dflow.net";

export interface OrderRequest {
  userPublicKey: string;
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
}

export interface OrderResponse {
  openTransaction: string; // Base64 encoded transaction
  executionMode: "sync" | "async";
  inAmount: string;
  outAmount: string;
  inputMint: string;
  outputMint: string;
  [key: string]: any;
}

export interface OrderStatusResponse {
  status: "open" | "pendingClose" | "closed" | "failed";
  fills?: Array<{
    qtyIn: string;
    qtyOut: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

export interface IntentResponse {
  openTransaction: string; // Base64 encoded transaction
  [key: string]: any;
}

export interface SubmitIntentRequest {
  quoteResponse: IntentResponse;
  signedOpenTransaction: string; // Base64 encoded signed transaction
}

/**
 * Request an order from the Trade API
 */
export async function requestOrder(params: OrderRequest): Promise<OrderResponse> {
  const queryParams = new URLSearchParams();
  queryParams.append("userPublicKey", params.userPublicKey);
  queryParams.append("inputMint", params.inputMint);
  queryParams.append("outputMint", params.outputMint);
  queryParams.append("amount", params.amount);
  
  // Slippage is required for prediction markets, default to 100 bps (1%) if not provided
  const slippageBps = params.slippageBps ?? 100;
  queryParams.append("slippageBps", slippageBps.toString());

  const url = `${TRADE_API_BASE_URL}/order?${queryParams.toString()}`;
  
  // Log for debugging - verify URL format matches expected format
  console.log('Requesting order:', {
    url,
    decodedUrl: decodeURIComponent(url),
    params: {
      userPublicKey: params.userPublicKey,
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount,
      slippageBps,
    },
    // Verify all required params are present
    hasAllParams: {
      userPublicKey: !!params.userPublicKey,
      inputMint: !!params.inputMint,
      outputMint: !!params.outputMint,
      amount: !!params.amount,
      slippageBps: !!slippageBps,
    },
  });

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Failed to request order: ${response.statusText}`;
    
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.msg) {
        errorMessage = errorJson.msg;
      } else if (errorJson.message) {
        errorMessage = errorJson.message;
      }
      
      // Provide helpful error messages
      if (errorJson.code === 'route_not_found') {
        errorMessage = `No trading route found for this token pair. The market may not have sufficient liquidity or the tokens may not be tradeable.`;
      }
    } catch (e) {
      // If errorText is not JSON, use it as is
      if (errorText) {
        errorMessage += ` - ${errorText}`;
      }
    }
    
    throw new Error(errorMessage);
  }

  const data = await response.json();
  console.log('Order response:', data);
  return data;
}

/**
 * Get order status for async trades
 */
export async function getOrderStatus(signature: string): Promise<OrderStatusResponse> {
  const response = await fetch(
    `${TRADE_API_BASE_URL}/order-status?signature=${signature}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get order status: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Request a swap intent (for declarative swaps)
 */
export async function requestSwapIntent(params: {
  inputMint: string;
  outputMint: string;
  amount: string;
  userPublicKey: string;
  slippageBps?: number;
}): Promise<IntentResponse> {
  const queryParams = new URLSearchParams();
  queryParams.append("inputMint", params.inputMint);
  queryParams.append("outputMint", params.outputMint);
  queryParams.append("amount", params.amount);
  queryParams.append("userPublicKey", params.userPublicKey);
  
  if (params.slippageBps) {
    queryParams.append("slippageBps", params.slippageBps.toString());
  }

  const response = await fetch(
    `${AGGREGATOR_API_BASE_URL}/intent?${queryParams.toString()}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to request swap intent: ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Submit a signed swap intent
 */
export async function submitSwapIntent(request: SubmitIntentRequest): Promise<any> {
  const response = await fetch(`${AGGREGATOR_API_BASE_URL}/submit-intent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to submit swap intent: ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}

// Common mint addresses
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

