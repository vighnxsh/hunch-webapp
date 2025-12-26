import { withCache, cacheKeys, CACHE_TTL } from './cache';

// Base URL for the DFlow Prediction Markets Metadata API
// - In development we default to the dev endpoint so you can trade against Kalshi with test capital.
// - In production, override this with the prod URL via NEXT_PUBLIC_PM_METADATA_API_BASE_URL.
const METADATA_API_BASE_URL =
  process.env.NEXT_PUBLIC_PM_METADATA_API_BASE_URL ??
  "https://dev-prediction-markets-api.dflow.net";

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
  accounts?: {
    yesMint?: string;
    noMint?: string;
    marketLedger?: string;
    isInitialized?: boolean;
    redemptionStatus?: string | null;
    [key: string]: any;
  } | {
    [key: string]: {
      marketLedger?: string;
      yesMint?: string;
      noMint?: string;
      isInitialized?: boolean;
      redemptionStatus?: string | null;
      [key: string]: any;
    };
  };
  [key: string]: any; // For other fields that might exist
}

export interface MarketsResponse {
  markets: Market[];
  [key: string]: any; // For pagination and other response fields
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
  [key: string]: any; // For other fields that might exist
}

export interface EventsResponse {
  events: Event[];
  cursor?: string; // Cursor for pagination
  [key: string]: any; // For pagination and other response fields
}

export interface EventDetails {
  ticker: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  markets?: Market[];
  [key: string]: any; // For other fields that might exist
}

export async function fetchMarkets(limit: number = 200): Promise<Market[]> {
  return withCache(
    cacheKeys.markets(limit),
    async () => {
      const response = await fetch(
        `${METADATA_API_BASE_URL}/api/v1/markets?limit=${limit}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          cache: 'no-store',
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error (${response.status}):`, errorText);
        throw new Error(`Failed to fetch markets: ${response.status} ${response.statusText}`);
      }

      const data: MarketsResponse = await response.json();
      return data.markets || [];
    },
    { ttl: CACHE_TTL.MARKETS }
  );
}

export async function fetchEvents(
  limit: number = 500,
  options?: {
    status?: string;
    withNestedMarkets?: boolean;
    cursor?: string;
  }
): Promise<EventsResponse> {
  // Don't cache paginated requests (with cursor)
  if (options?.cursor) {
    return fetchEventsUncached(limit, options);
  }

  return withCache(
    cacheKeys.events(limit, options?.status),
    () => fetchEventsUncached(limit, options),
    { ttl: CACHE_TTL.EVENTS }
  );
}

async function fetchEventsUncached(
  limit: number,
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
      headers: {
        "Content-Type": "application/json",
      },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`API Error (${response.status}):`, errorText);
    throw new Error(`Failed to fetch events: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

export async function fetchEventDetails(eventTicker: string): Promise<EventDetails> {
  return withCache(
    cacheKeys.eventDetails(eventTicker),
    async () => {
      const response = await fetch(
        `${METADATA_API_BASE_URL}/api/v1/event/${encodeURIComponent(eventTicker)}?withNestedMarkets=true`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          cache: 'no-store',
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error (${response.status}):`, errorText);
        throw new Error(`Failed to fetch event details: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    },
    { ttl: CACHE_TTL.EVENT_DETAILS }
  );
}

export interface TagsByCategories {
  [category: string]: string[];
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

/**
 * Fetch tags organized by categories
 */
export async function fetchTagsByCategories(): Promise<TagsByCategories> {
  try {
    const response = await fetch(
      `${METADATA_API_BASE_URL}/api/v1/tags_by_categories`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch tags by categories: ${response.statusText}`);
    }

    const data = await response.json();
    return data.tagsByCategories || {};
  } catch (error) {
    console.error("Error fetching tags by categories:", error);
    throw error;
  }
}

/**
 * Fetch series filtered by category and/or tags
 */
export async function fetchSeries(params?: {
  category?: string;
  tags?: string;
}): Promise<Series[]> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.category) {
      queryParams.append("category", params.category);
    }
    if (params?.tags) {
      queryParams.append("tags", params.tags);
    }

    const url = `${METADATA_API_BASE_URL}/api/v1/series${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch series: ${response.statusText}`);
    }

    const data: SeriesResponse = await response.json();
    return data.series || [];
  } catch (error) {
    console.error("Error fetching series:", error);
    throw error;
  }
}

/**
 * Fetch events filtered by series tickers
 */
export async function fetchEventsBySeries(
  seriesTickers: string | string[],
  options?: {
    withNestedMarkets?: boolean;
    status?: string;
    limit?: number;
  }
): Promise<Event[]> {
  try {
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
    }

    const response = await fetch(
      `${METADATA_API_BASE_URL}/api/v1/events?${queryParams.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch events by series: ${response.statusText}`);
    }

    const data: EventsResponse = await response.json();
    return data.events || [];
  } catch (error) {
    console.error("Error fetching events by series:", error);
    throw error;
  }
}

/**
 * Filter outcome mints from a list of addresses
 */
export async function filterOutcomeMints(addresses: string[]): Promise<string[]> {
  try {
    console.log('filterOutcomeMints - Request:', JSON.stringify({ addresses }, null, 2));
    
    const response = await fetch(
      `${METADATA_API_BASE_URL}/api/v1/filter_outcome_mints`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ addresses }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('filterOutcomeMints - Error response:', errorText);
      throw new Error(`Failed to filter outcome mints: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('filterOutcomeMints - Response:', JSON.stringify(data, null, 2));
    return data.outcomeMints || [];
  } catch (error) {
    console.error("Error filtering outcome mints:", error);
    throw error;
  }
}

/**
 * Fetch market details by mint address
 */
export async function fetchMarketByMint(mintAddress: string): Promise<Market> {
  try {
    const response = await fetch(
      `${METADATA_API_BASE_URL}/api/v1/market/by-mint/${mintAddress}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch market by mint: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching market by mint:", error);
    throw error;
  }
}

/**
 * Fetch market details for multiple mints in batch
 */
export async function fetchMarketsBatch(mints: string[]): Promise<Market[]> {
  try {
    console.log('fetchMarketsBatch - Request:', JSON.stringify({ mints }, null, 2));
    
    const response = await fetch(
      `${METADATA_API_BASE_URL}/api/v1/markets/batch`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mints }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('fetchMarketsBatch - Error response:', errorText);
      throw new Error(`Failed to fetch markets batch: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('fetchMarketsBatch - Response:', JSON.stringify(data, null, 2));
    return data.markets || [];
  } catch (error) {
    console.error("Error fetching markets batch:", error);
    throw error;
  }
}

/**
 * Fetch detailed market information by ticker
 */
export async function fetchMarketDetails(ticker: string): Promise<Market> {
  return withCache(
    cacheKeys.marketDetails(ticker),
    async () => {
      const response = await fetch(
        `${METADATA_API_BASE_URL}/api/v1/market/${encodeURIComponent(ticker)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          cache: 'no-store',
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error (${response.status}):`, errorText);
        throw new Error(`Failed to fetch market details: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    },
    { ttl: CACHE_TTL.MARKET_DETAILS }
  );
}

