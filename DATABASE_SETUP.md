# Database Setup Guide

This guide will help you set up the database and Redis caching for the social feed functionality.

## Prerequisites

1. PostgreSQL database (local or cloud)
2. Upstash Redis instance

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# PostgreSQL Database URL
DATABASE_URL="postgresql://username:password@localhost:5432/hunch?schema=public"

# Upstash Redis Configuration
UPSTASH_REDIS_REST_URL="https://your-redis-instance.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-redis-token"
```

## Database Setup Steps

1. **Install dependencies** (already done):
   ```bash
   npm install
   ```

2. **Generate Prisma Client**:
   ```bash
   npm run db:generate
   ```

3. **Push schema to database** (for development):
   ```bash
   npm run db:push
   ```
   
   Or create a migration (for production):
   ```bash
   npm run db:migrate
   ```

4. **Verify setup** (optional):
   ```bash
   npm run db:studio
   ```
   This opens Prisma Studio where you can view and manage your database.

## Database Schema

The schema includes three main models:

- **User**: Stores user information (Privy ID, wallet address, display name, avatar)
- **Trade**: Stores trade records (user, market ticker, side, amount, transaction signature)
- **Follow**: Stores follow relationships between users

## Redis Caching

Redis is used to cache:
- Follow relationships (10 minute TTL)
- Social feed data (45 second TTL)
- User profiles (5 minute TTL)

Cache is automatically invalidated when:
- A user makes a new trade
- A follow/unfollow action occurs

## API Endpoints

### User Endpoints
- `POST /api/users/sync` - Sync/create user from Privy auth
- `GET /api/users/[userId]` - Get user profile

### Follow Endpoints
- `POST /api/follow` - Follow a user
- `DELETE /api/follow` - Unfollow a user
- `GET /api/follow/following?userId=...` - Get following list
- `GET /api/follow/followers?userId=...` - Get followers list

### Trade Endpoints
- `POST /api/trades` - Store a trade
- `GET /api/trades?userId=...` - Get user's trades

### Feed Endpoint
- `GET /api/feed?userId=...` - Get social feed (trades from followed users)

## Features

1. **User Management**: Automatic user sync when they authenticate
2. **Follow System**: Follow/unfollow users with real-time counts
3. **Trade Storage**: Trades are automatically stored after successful execution
4. **Social Feed**: View trades from users you follow
5. **Caching**: Optimized performance with Redis caching

## Troubleshooting

If you encounter issues:

1. **Database connection errors**: Verify your `DATABASE_URL` is correct
2. **Redis errors**: Check your Upstash Redis credentials
3. **Prisma errors**: Run `npm run db:generate` to regenerate the client
4. **Migration issues**: Use `npm run db:push` for development or create proper migrations for production

