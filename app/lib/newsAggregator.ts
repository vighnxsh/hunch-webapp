import Parser from 'rss-parser';

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_URL = 'https://newsapi.org/v2/everything';

interface NewsSource {
  name: string;
  type: 'newsapi' | 'rss';
  url?: string;
  enabled: boolean;
}

// Default RSS feeds for major news sources
const DEFAULT_RSS_FEEDS: NewsSource[] = [
  { name: 'BBC News', type: 'rss', url: 'https://feeds.bbci.co.uk/news/rss.xml', enabled: true },
  { name: 'Reuters', type: 'rss', url: 'https://www.reuters.com/rssFeed/worldNews', enabled: true },
  { name: 'AP News', type: 'rss', url: 'https://apnews.com/rss', enabled: true },
  { name: 'NewsAPI', type: 'newsapi', enabled: !!NEWS_API_KEY },
];

export interface RawNewsArticle {
  title: string;
  content: string;
  url: string;
  source: string;
  publishedAt: Date;
  imageUrl?: string;
  author?: string;
  description?: string;
}

const parser = new Parser({
  customFields: {
    item: ['media:content', 'media:thumbnail'],
  },
});

/**
 * Fetch news from NewsAPI.org
 */
async function fetchFromNewsAPI(query?: string, limit = 100): Promise<RawNewsArticle[]> {
  if (!NEWS_API_KEY) {
    console.warn('NewsAPI key not configured');
    return [];
  }

  try {
    const params = new URLSearchParams({
      sortBy: 'publishedAt',
      language: 'en',
      pageSize: limit.toString(),
      apiKey: NEWS_API_KEY,
    });

    if (query) {
      params.append('q', query);
    } else {
      // Fetch general news if no query
      params.append('q', 'news');
    }

    const response = await fetch(`${NEWS_API_URL}?${params.toString()}`);

    if (!response.ok) {
      const text = await response.text();
      console.error('NewsAPI error:', response.status, text);
      return [];
    }

    const data = await response.json();

    return (data.articles || []).map((article: any) => ({
      title: article.title || '',
      content: article.content || article.description || '',
      url: article.url || '',
      source: article.source?.name || 'Unknown',
      publishedAt: new Date(article.publishedAt || Date.now()),
      imageUrl: article.urlToImage,
      author: article.author,
      description: article.description,
    })).filter((article: RawNewsArticle) => article.title && article.url);
  } catch (error) {
    console.error('Error fetching from NewsAPI:', error);
    return [];
  }
}

/**
 * Fetch news from RSS feed
 */
async function fetchFromRSS(feedUrl: string, sourceName: string): Promise<RawNewsArticle[]> {
  try {
    const feed = await parser.parseURL(feedUrl);

    return (feed.items || []).map((item) => {
      // Extract image from media:content or media:thumbnail
      let imageUrl: string | undefined;
      if ((item as any)['media:content']) {
        imageUrl = (item as any)['media:content'].$.url;
      } else if ((item as any)['media:thumbnail']) {
        imageUrl = (item as any)['media:thumbnail'].$.url;
      } else if (item.enclosure?.type?.startsWith('image/')) {
        imageUrl = item.enclosure.url;
      }

      return {
        title: item.title || '',
        content: item.contentSnippet || item.content || item.description || '',
        url: item.link || '',
        source: sourceName,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        imageUrl,
        author: item.creator || item['dc:creator'],
        description: item.contentSnippet || item.description,
      };
    }).filter((article) => article.title && article.url);
  } catch (error) {
    console.error(`Error fetching RSS feed ${feedUrl}:`, error);
    return [];
  }
}

/**
 * Aggregate news from all configured sources
 */
export async function aggregateNews(options: {
  query?: string;
  limit?: number;
  sources?: NewsSource[];
}): Promise<RawNewsArticle[]> {
  const { query, limit = 100, sources = DEFAULT_RSS_FEEDS } = options;

  const enabledSources = sources.filter((s) => s.enabled);
  const allArticles: RawNewsArticle[] = [];

  // Fetch from NewsAPI
  const newsAPISource = enabledSources.find((s) => s.type === 'newsapi');
  if (newsAPISource) {
    const articles = await fetchFromNewsAPI(query, limit);
    allArticles.push(...articles);
  }

  // Fetch from RSS feeds
  const rssSources = enabledSources.filter((s) => s.type === 'rss' && s.url);
  const rssPromises = rssSources.map((source) =>
    fetchFromRSS(source.url!, source.name).catch((error) => {
      console.error(`Failed to fetch from ${source.name}:`, error);
      return [];
    })
  );

  const rssResults = await Promise.all(rssPromises);
  rssResults.forEach((articles) => {
    allArticles.push(...articles);
  });

  // Deduplicate by URL
  const uniqueArticles = new Map<string, RawNewsArticle>();
  for (const article of allArticles) {
    if (!uniqueArticles.has(article.url)) {
      uniqueArticles.set(article.url, article);
    }
  }

  // Sort by published date (newest first)
  return Array.from(uniqueArticles.values()).sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
  );
}

/**
 * Get custom RSS feeds from environment variable
 */
export function getCustomRSSFeeds(): NewsSource[] {
  const feedsConfig = process.env.RSS_FEEDS_CONFIG;
  if (!feedsConfig) return [];

  return feedsConfig.split(',').map((feedConfig) => {
    const [name, url] = feedConfig.split('|').map((s) => s.trim());
    return {
      name: name || 'Custom Feed',
      type: 'rss' as const,
      url,
      enabled: !!url,
    };
  });
}

