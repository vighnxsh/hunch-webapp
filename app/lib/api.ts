import { withCache, cacheKeys, CACHE_TTL } from './cache';

// Internal API route prefix - all DFlow calls now go through server-side routes
// This prevents exposing external API endpoints in the client bundle
const INTERNAL_API_PREFIX = '/api/dflow';

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

export interface EventEvidence {
  id: string;
  eventTicker: string;
  marketTicker: string;
  marketQuestion: string;
  evidenceSentence: string;
  highlightScore: number;
  classification: string;
  headline?: string | null;
  explanation?: string | null;
  sourceUrl: string;
  sourceTitle?: string | null;
  sourcePublishedAt?: string | null;
  createdAt: string;
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
        `${INTERNAL_API_PREFIX}/events?limit=${limit}&withNestedMarkets=true`,
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

      const data = await response.json();
      // Extract markets from events
      const markets: Market[] = [];
      (data.events || []).forEach((event: any) => {
        if (event.markets) {
          markets.push(...event.markets);
        }
      });
      return markets;
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
    `${INTERNAL_API_PREFIX}/events?${queryParams.toString()}`,
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
        `${INTERNAL_API_PREFIX}/event/${encodeURIComponent(eventTicker)}`,
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
      `${INTERNAL_API_PREFIX}/tags`,
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
 * Note: Series endpoint not yet proxied - using events as fallback
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

    // TODO: Create /api/dflow/series route if needed
    const url = `${INTERNAL_API_PREFIX}/series${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
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
      `${INTERNAL_API_PREFIX}/events?${queryParams.toString()}`,
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
      `${INTERNAL_API_PREFIX}/filter-outcome-mints`,
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
    // TODO: Create /api/dflow/market-by-mint route if needed
    const response = await fetch(
      `${INTERNAL_API_PREFIX}/market-by-mint/${mintAddress}`,
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

    // Use batch-by-mint route which accepts mints array
    const response = await fetch(
      `/api/markets/batch-by-mint`,
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
        `${INTERNAL_API_PREFIX}/market/${encodeURIComponent(ticker)}`,
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

export interface Candlestick {
  end_period_ts: number;
  open_interest: number;
  volume: number;
  price: {
    close: number | null;
    previous_dollars: string;
  };
}

export interface EventCandlesticksResponse {
  adjusted_end_ts: number;
  market_candlesticks: Candlestick[][];
  market_tickers: string[];
}

export async function fetchEventCandlesticks(
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

  try {
    // Note: This uses event candlesticks endpoint - may need separate API route
    const response = await fetch(
      `${INTERNAL_API_PREFIX}/event/${encodeURIComponent(eventTicker)}/candlesticks?${queryParams.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      console.warn(`Failed to fetch candlesticks for ${eventTicker}: ${response.status}`);
      return { adjusted_end_ts: 0, market_candlesticks: [], market_tickers: [] };
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching candlesticks for ${eventTicker}:`, error);
    return { adjusted_end_ts: 0, market_candlesticks: [], market_tickers: [] };
  }
}

// Candlestick data by mint address
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
  yes_ask: {
    close: number | null;
    close_dollars: string;
    high: number | null;
    high_dollars: string;
    low: number | null;
    low_dollars: string;
    open: number | null;
    open_dollars: string;
  };
  yes_bid: {
    close: number | null;
    close_dollars: string;
    high: number | null;
    high_dollars: string;
    low: number | null;
    low_dollars: string;
    open: number | null;
    open_dollars: string;
  };
}

export interface CandlesticksByMintResponse {
  candlesticks: CandlestickData[];
  ticker: string;
}

/**
 * Fetch candlestick data by mint address for social price charts
 */
/**
 * Fetch top events by category (highest volume events from each category)
 */
export async function fetchTopEventsByCategory(params?: {
  status?: string;
  useVolume24h?: boolean;
  limit?: number;
  perCategory?: number;
}): Promise<{
  categories: Record<string, Array<Event & { volume: number; category: string }>>;
  count: number;
  perCategory: number;
}> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.status) {
      queryParams.append('status', params.status);
    }
    if (params?.useVolume24h) {
      queryParams.append('useVolume24h', 'true');
    }
    if (params?.limit) {
      queryParams.append('limit', params.limit.toString());
    }
    if (params?.perCategory) {
      queryParams.append('perCategory', params.perCategory.toString());
    }

    const response = await fetch(
      `/api/events/top-by-category${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch top events by category: ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching top events by category:', error);
    throw error;
  }
}

export async function fetchEventEvidenceByTickers(
  eventTickers: string[]
): Promise<EventEvidence[]> {
  if (!eventTickers.length) return [];

  const params = new URLSearchParams();
  params.append('eventTickers', eventTickers.join(','));

  const response = await fetch(`/api/events/evidence?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch event evidence: ${errorText}`);
  }

  const data = await response.json();
  return data.evidence || [];
}

export async function fetchCandlesticksByMint(
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

  try {
    const url = `${INTERNAL_API_PREFIX}/candlesticks/${mintAddress}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn(`Failed to fetch candlesticks for mint ${mintAddress}: ${response.status}`);
      return { candlesticks: [], ticker: '' };
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching candlesticks for mint ${mintAddress}:`, error);
    return { candlesticks: [], ticker: '' };
  }
}
