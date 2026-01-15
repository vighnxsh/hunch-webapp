import 'server-only';

// Server-only DFlow API library
// These URLs are never exposed in the client bundle

// Production API endpoints
const METADATA_API_BASE_URL =
    process.env.DFLOW_METADATA_API_URL ??
    process.env.NEXT_PUBLIC_PM_METADATA_API_BASE_URL ??
    "https://dev-prediction-markets-api.dflow.net";

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

export interface Series {
    ticker: string;
    title: string;
    category?: string;
    tags?: string[];
    frequency?: string;
    [key: string]: any;
}

export interface SeriesResponse {
    series: Series[];
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

    const url = `${METADATA_API_BASE_URL}/api/v1/events?${queryParams.toString()}`;
    console.log(`[dflowServer] Fetching events from: ${url}`);
    
    let response;
    try {
        response = await fetch(url, {
            method: "GET",
            headers: getHeaders(),
            cache: 'no-store',
            // Add timeout to prevent hanging
            signal: AbortSignal.timeout(30000), // 30 second timeout
        });
    } catch (fetchError: any) {
        const errorMessage = fetchError?.message || 'Unknown fetch error';
        const errorName = fetchError?.name || 'FetchError';
        console.error(`[dflowServer] Network error fetching events:`, {
            error: errorMessage,
            name: errorName,
            url,
            hasApiKey: !!DFLOW_API_KEY,
            apiBaseUrl: METADATA_API_BASE_URL,
        });
        
        // Provide more helpful error messages
        if (errorName === 'AbortError' || errorMessage.includes('timeout')) {
            throw new Error(`DFlow API request timed out. The API at ${METADATA_API_BASE_URL} may be slow or unreachable.`);
        } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
            throw new Error(`Cannot connect to DFlow API at ${METADATA_API_BASE_URL}. Check your network connection and API endpoint.`);
        } else {
            throw new Error(`Network error fetching events from DFlow API: ${errorMessage}. URL: ${url}`);
        }
    }

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[dflowServer] Events API Error (${response.status}):`, errorText);
        console.error(`[dflowServer] Request URL: ${url}`);
        console.error(`[dflowServer] Query params:`, queryParams.toString());
        throw new Error(`Failed to fetch events: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
}

/**
 * Fetch event details from DFlow API (server-only)
 */
export async function fetchEventDetailsServer(eventTicker: string): Promise<EventDetails> {
    const url = `${METADATA_API_BASE_URL}/api/v1/event/${encodeURIComponent(eventTicker)}?withNestedMarkets=true`;
    console.log(`[dflowServer] Fetching event details for: ${eventTicker}`);
    
    let response;
    try {
        response = await fetch(url, {
            method: "GET",
            headers: getHeaders(),
            cache: 'no-store',
            // Add timeout to prevent hanging
            signal: AbortSignal.timeout(30000), // 30 second timeout
        });
    } catch (fetchError: any) {
        const errorMessage = fetchError?.message || 'Unknown fetch error';
        const errorName = fetchError?.name || 'FetchError';
        console.error(`[dflowServer] Network error fetching event details:`, {
            error: errorMessage,
            name: errorName,
            ticker: eventTicker,
            url,
            hasApiKey: !!DFLOW_API_KEY,
            apiBaseUrl: METADATA_API_BASE_URL,
        });
        
        // Provide more helpful error messages
        if (errorName === 'AbortError' || errorMessage.includes('timeout')) {
            throw new Error(`DFlow API request timed out for event ${eventTicker}. The API at ${METADATA_API_BASE_URL} may be slow or unreachable.`);
        } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
            throw new Error(`Cannot connect to DFlow API at ${METADATA_API_BASE_URL} for event ${eventTicker}. Check your network connection and API endpoint.`);
        } else {
            throw new Error(`Network error fetching event details for ${eventTicker}: ${errorMessage}. URL: ${url}`);
        }
    }

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[dflowServer] Event Details API Error (${response.status}):`, errorText);
        console.error(`[dflowServer] Request URL: ${url}`);
        throw new Error(`Failed to fetch event details: ${response.status} ${response.statusText} - ${errorText}`);
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
 * Fetch series from DFlow API (server-only)
 */
export async function fetchSeriesServer(params?: {
    category?: string;
    tags?: string;
}): Promise<Series[]> {
    const queryParams = new URLSearchParams();
    if (params?.category) {
        queryParams.append("category", params.category);
    }
    if (params?.tags) {
        queryParams.append("tags", params.tags);
    }

    const response = await fetch(
        `${METADATA_API_BASE_URL}/api/v1/series${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
        {
            method: "GET",
            headers: getHeaders(),
            cache: 'no-store',
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[dflowServer] Series API Error (${response.status}):`, errorText);
        throw new Error(`Failed to fetch series: ${response.status} ${response.statusText}`);
    }

    const data: SeriesResponse = await response.json();
    return data.series || [];
}

/**
 * Fetch events by series tickers from DFlow API (server-only)
 */
export async function fetchEventsBySeriesServer(
    seriesTickers: string | string[],
    options?: {
        withNestedMarkets?: boolean;
        status?: string;
        limit?: number;
    }
): Promise<Event[]> {
    const queryParams = new URLSearchParams();
    const tickers = Array.isArray(seriesTickers) ? seriesTickers.join(",") : seriesTickers;
    queryParams.append("seriesTickers", tickers);

    if (options?.withNestedMarkets) {
        queryParams.append("withNestedMarkets", "true");
    }
    if (options?.status) {
        queryParams.append("status", options.status);
    }
    if (options?.limit) {
        queryParams.append("limit", options.limit.toString());
    } else {
        queryParams.append("limit", "500"); // Default limit
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
        console.error(`[dflowServer] Events by Series API Error (${response.status}):`, errorText);
        console.error(`[dflowServer] Request URL: ${METADATA_API_BASE_URL}/api/v1/events?${queryParams.toString()}`);
        console.error(`[dflowServer] Series tickers count: ${Array.isArray(seriesTickers) ? seriesTickers.length : 1}`);
        throw new Error(`Failed to fetch events by series: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data: EventsResponse = await response.json();
    return data.events || [];
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
 * Fetch market by mint address (server-only)
 */
export async function fetchMarketByMintServer(mintAddress: string): Promise<Market | null> {
    try {
        const response = await fetch(
            `${METADATA_API_BASE_URL}/api/v1/market/by-mint/${mintAddress}`,
            {
                method: "GET",
                headers: getHeaders(),
                cache: 'no-store',
            }
        );

        if (!response.ok) {
            console.warn(`[dflowServer] Market by-mint API Error (${response.status}) for mint ${mintAddress}`);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error(`[dflowServer] Error fetching market by mint ${mintAddress}:`, error);
        return null;
    }
}

/**
 * Fetch markets batch by mints (server-only)
 * Uses /api/v1/markets/batch endpoint as documented
 */
export async function fetchMarketsBatchServer(mints: string[]): Promise<Market[]> {
    if (!mints || mints.length === 0) {
        return [];
    }

    console.log(`[dflowServer] Fetching ${mints.length} markets via batch endpoint...`);
    console.log(`[dflowServer] API URL: ${METADATA_API_BASE_URL}/api/v1/markets/batch`);
    console.log(`[dflowServer] Has API key: ${!!DFLOW_API_KEY}`);

    try {
        // Try batch endpoint first (as per guide)
        const response = await fetch(
            `${METADATA_API_BASE_URL}/api/v1/markets/batch`,
            {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify({ mints }),
            }
        );

        if (response.ok) {
            const data = await response.json();
            console.log(`[dflowServer] Batch endpoint success, got ${(data.markets || []).length} markets`);
            return data.markets || [];
        }

        // Log the error details for debugging
        const errorText = await response.text();
        console.warn(`[dflowServer] Batch endpoint failed (${response.status}): ${errorText}`);
        console.log(`[dflowServer] Falling back to individual fetch...`);

    } catch (error) {
        console.warn(`[dflowServer] Batch endpoint error, falling back to individual fetch:`, error);
    }

    // Fallback: fetch markets individually in parallel
    const results = await Promise.allSettled(
        mints.map(mint => fetchMarketByMintServer(mint))
    );

    const markets: Market[] = [];
    for (const result of results) {
        if (result.status === 'fulfilled' && result.value !== null) {
            markets.push(result.value);
        }
    }

    console.log(`[dflowServer] Individual fetch: got ${markets.length}/${mints.length} markets`);
    return markets;
}

// Common mint addresses (can be exposed)
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
