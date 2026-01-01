import 'server-only';

// Server-only DFlow API library
// These URLs are never exposed in the client bundle

// Production API endpoints
const METADATA_API_BASE_URL =
    process.env.DFLOW_METADATA_API_URL ??
    process.env.NEXT_PUBLIC_PM_METADATA_API_BASE_URL ??
    "https://a.prediction-markets-api.dflow.net";

const TRADE_API_BASE_URL =
    process.env.DFLOW_TRADE_API_URL ??
    process.env.NEXT_PUBLIC_PM_TRADE_API_BASE_URL ??
    "https://b.quote-api.dflow.net";

// API Key for authentication (required for production endpoints)
const DFLOW_API_KEY = process.env.NEXT_PUBLIC_DFLOW_API_KEY ?? process.env.DFLOW_API_KEY;

// Helper to get common headers with API key
function getHeaders(): HeadersInit {
    const headers: HeadersInit = {
        "Content-Type": "application/json",
    };

    if (DFLOW_API_KEY) {
        headers["x-api-key"] = DFLOW_API_KEY;
    } else {
        console.warn('[dflowServer] No API key found. Set NEXT_PUBLIC_DFLOW_API_KEY or DFLOW_API_KEY in .env');
    }

    return headers;
}

// ============ TYPES ============

export interface Market {
    ticker: string;
    title: string;
    status: string;
    yesMint?: string;
    noMint?: string;
    volume?: number;
    eventTicker?: string;
    marketType?: string;
    subtitle?: string;
    yesSubTitle?: string;
    noSubTitle?: string;
    openTime?: number;
    closeTime?: number;
    expirationTime?: number;
    result?: string;
    openInterest?: number;
    canCloseEarly?: boolean;
    earlyCloseCondition?: string;
    rulesPrimary?: string;
    rulesSecondary?: string;
    yesBid?: string;
    yesAsk?: string;
    noBid?: string;
    noAsk?: string;
    accounts?: Record<string, any>;
    [key: string]: any;
}

export interface MarketsResponse {
    markets: Market[];
    [key: string]: any;
}

export interface Event {
    ticker: string;
    title: string;
    subtitle?: string;
    imageUrl?: string;
    volume?: number;
    volume24h?: number;
    liquidity?: number;
    openInterest?: number;
    closeTime?: number | string;
    markets?: Market[];
    [key: string]: any;
}

export interface EventsResponse {
    events: Event[];
    cursor?: string;
    [key: string]: any;
}

export interface EventDetails {
    ticker: string;
    title: string;
    subtitle?: string;
    imageUrl?: string;
    markets?: Market[];
    [key: string]: any;
}

export interface CandlestickData {
    end_period_ts: number;
    open_interest: number;
    volume: number;
    price: {
        close: number | null;
        close_dollars: string;
        high: number | null;
        high_dollars: string;
        low: number | null;
        low_dollars: string;
        open: number | null;
        open_dollars: string;
        mean: number | null;
        mean_dollars: string;
        previous: number | null;
        previous_dollars: string;
    };
    yes_ask: Record<string, any>;
    yes_bid: Record<string, any>;
}

export interface CandlesticksByMintResponse {
    candlesticks: CandlestickData[];
    ticker: string;
}

export interface EventCandlesticksResponse {
    adjusted_end_ts: number;
    market_candlesticks: CandlestickData[][];
    market_tickers: string[];
}

export interface OrderRequest {
    userPublicKey: string;
    inputMint: string;
    outputMint: string;
    amount: string;
    slippageBps?: number;
}

export interface OrderResponse {
    transaction?: string;
    openTransaction?: string;
    executionMode: "sync" | "async";
    inAmount: string;
    outAmount: string;
    inputMint: string;
    outputMint: string;
    lastValidBlockHeight?: number;
    prioritizationFeeLamports?: number;
    computeUnitLimit?: number;
    [key: string]: any;
}

// ============ API FUNCTIONS ============

/**
 * Fetch events from DFlow API (server-only)
 */
export async function fetchEventsServer(
    limit: number = 500,
    options?: {
        status?: string;
        withNestedMarkets?: boolean;
        cursor?: string;
    }
): Promise<EventsResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append("limit", limit.toString());

    if (options?.status) {
        queryParams.append("status", options.status);
    }
    if (options?.withNestedMarkets) {
        queryParams.append("withNestedMarkets", "true");
    }
    if (options?.cursor) {
        queryParams.append("cursor", options.cursor);
    }

    const response = await fetch(
        `${METADATA_API_BASE_URL}/api/v1/events?${queryParams.toString()}`,
        {
            method: "GET",
            headers: getHeaders(),
            cache: 'no-store',
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[dflowServer] Events API Error (${response.status}):`, errorText);
        throw new Error(`Failed to fetch events: ${response.status} ${response.statusText}`);
    }

    return await response.json();
}

/**
 * Fetch event details from DFlow API (server-only)
 */
export async function fetchEventDetailsServer(eventTicker: string): Promise<EventDetails> {
    const response = await fetch(
        `${METADATA_API_BASE_URL}/api/v1/event/${encodeURIComponent(eventTicker)}?withNestedMarkets=true`,
        {
            method: "GET",
            headers: getHeaders(),
            cache: 'no-store',
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[dflowServer] Event Details API Error (${response.status}):`, errorText);
        throw new Error(`Failed to fetch event details: ${response.status} ${response.statusText}`);
    }

    return await response.json();
}

/**
 * Fetch market details from DFlow API (server-only)
 */
export async function fetchMarketDetailsServer(ticker: string): Promise<Market> {
    const response = await fetch(
        `${METADATA_API_BASE_URL}/api/v1/market/${encodeURIComponent(ticker)}`,
        {
            method: "GET",
            headers: getHeaders(),
            cache: 'no-store',
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[dflowServer] Market Details API Error (${response.status}):`, errorText);
        throw new Error(`Failed to fetch market details: ${response.status} ${response.statusText}`);
    }

    return await response.json();
}

/**
 * Fetch candlesticks by mint address from DFlow API (server-only)
 */
export async function fetchCandlesticksByMintServer(
    mintAddress: string,
    options?: {
        startTs?: number;
        endTs?: number;
        periodInterval?: number;
    }
): Promise<CandlesticksByMintResponse> {
    const queryParams = new URLSearchParams();
    if (options?.startTs) queryParams.append("startTs", options.startTs.toString());
    if (options?.endTs) queryParams.append("endTs", options.endTs.toString());
    if (options?.periodInterval) queryParams.append("periodInterval", options.periodInterval.toString());

    const url = `${METADATA_API_BASE_URL}/api/v1/market/by-mint/${mintAddress}/candlesticks${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    const response = await fetch(url, {
        method: "GET",
        headers: getHeaders(),
        cache: 'no-store',
    });

    if (!response.ok) {
        console.warn(`[dflowServer] Candlesticks API Error (${response.status}) for mint ${mintAddress}`);
        return { candlesticks: [], ticker: '' };
    }

    return await response.json();
}

/**
 * Fetch event candlesticks from DFlow API (server-only)
 */
export async function fetchEventCandlesticksServer(
    eventTicker: string,
    options?: {
        startTs?: number;
        endTs?: number;
        periodInterval?: number;
    }
): Promise<EventCandlesticksResponse> {
    const queryParams = new URLSearchParams();
    if (options?.startTs) queryParams.append("startTs", options.startTs.toString());
    if (options?.endTs) queryParams.append("endTs", options.endTs.toString());
    if (options?.periodInterval) queryParams.append("periodInterval", options.periodInterval.toString());

    const url = `${METADATA_API_BASE_URL}/api/v1/event/${encodeURIComponent(eventTicker)}/candlesticks${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    const response = await fetch(url, {
        method: "GET",
        headers: getHeaders(),
        cache: 'no-store',
    });

    if (!response.ok) {
        console.warn(`[dflowServer] Event Candlesticks API Error (${response.status}) for event ${eventTicker}`);
        return { adjusted_end_ts: 0, market_candlesticks: [], market_tickers: [] };
    }

    return await response.json();
}

/**
 * Request order/quote from DFlow Trade API (server-only)
 */
export async function requestOrderServer(params: OrderRequest): Promise<OrderResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append("userPublicKey", params.userPublicKey);
    queryParams.append("inputMint", params.inputMint);
    queryParams.append("outputMint", params.outputMint);
    queryParams.append("amount", params.amount);

    const slippageBps = params.slippageBps ?? 100;
    queryParams.append("slippageBps", slippageBps.toString());

    const url = `${TRADE_API_BASE_URL}/order?${queryParams.toString()}`;

    console.log('[dflowServer] Requesting order:', {
        userPublicKey: params.userPublicKey,
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: params.amount,
        slippageBps,
    });

    const response = await fetch(url, {
        method: "GET",
        headers: getHeaders(),
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

            if (errorJson.code === 'route_not_found') {
                errorMessage = `No trading route found for this token pair. The market may not have sufficient liquidity.`;
            }
        } catch (e) {
            if (errorText) {
                errorMessage += ` - ${errorText}`;
            }
        }

        throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('[dflowServer] Order response:', {
        hasTransaction: !!data.transaction,
        hasOpenTransaction: !!data.openTransaction,
        executionMode: data.executionMode,
        inAmount: data.inAmount,
        outAmount: data.outAmount,
    });
    return data;
}

/**
 * Fetch tags by categories from DFlow API (server-only)
 */
export async function fetchTagsByCategoriesServer(): Promise<Record<string, string[]>> {
    const response = await fetch(
        `${METADATA_API_BASE_URL}/api/v1/tags_by_categories`,
        {
            method: "GET",
            headers: getHeaders(),
        }
    );

    if (!response.ok) {
        throw new Error(`Failed to fetch tags by categories: ${response.statusText}`);
    }

    const data = await response.json();
    return data.tagsByCategories || {};
}

/**
 * Filter outcome mints from addresses (server-only)
 */
export async function filterOutcomeMintsServer(addresses: string[]): Promise<string[]> {
    const response = await fetch(
        `${METADATA_API_BASE_URL}/api/v1/filter_outcome_mints`,
        {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ addresses }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[dflowServer] filterOutcomeMints Error:', errorText);
        throw new Error(`Failed to filter outcome mints: ${response.statusText}`);
    }

    const data = await response.json();
    return data.outcomeMints || [];
}

/**
 * Fetch markets batch by mints (server-only)
 */
export async function fetchMarketsBatchServer(mints: string[]): Promise<Market[]> {
    const response = await fetch(
        `${METADATA_API_BASE_URL}/api/v1/markets/batch`,
        {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ mints }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[dflowServer] marketsBatch Error:', errorText);
        throw new Error(`Failed to fetch markets batch: ${response.statusText}`);
    }

    const data = await response.json();
    return data.markets || [];
}

// Common mint addresses (can be exposed)
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
