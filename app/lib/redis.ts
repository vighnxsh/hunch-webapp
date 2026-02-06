import { Redis } from '@upstash/redis';

// Initialize Redis client with Upstash configuration
// These environment variables should be set in .env:
// UPSTASH_REDIS_REST_URL
// UPSTASH_REDIS_REST_TOKEN
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

export default redis;

// Cache key helpers
export const CacheKeys = {
  user: (userId: string) => `user:${userId}`,
  counts: (userId: string) => `counts:${userId}`,
  follows: (userId: string) => `follows:${userId}`,
  feed: (userId: string) => `feed:${userId}`,
  followers: (userId: string) => `followers:${userId}`,
  following: (userId: string) => `following:${userId}`,
  eventMetadata: (ticker: string) => `event_meta:${ticker}`,
  events: (params: string) => `events:${params}`,
};

// Cache TTL constants (in seconds)
export const CacheTTL = {
  FEED: 45, // 45 seconds for social feed
  USER: 300, // 5 minutes for user profiles
  COUNTS: 600, // 10 minutes for counts
  FOLLOWS: 600, // 10 minutes for follow relationships
  EVENT_METADATA: 86400, // 24 hours for event metadata (rarely changes)
  EVENTS_LIST: 60, // 1 minute for events list (with metadata)
};

