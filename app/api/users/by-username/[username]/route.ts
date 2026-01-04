import { NextRequest, NextResponse } from 'next/server';
import { getUserByDisplayName } from '@/app/lib/userService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // Decode username (in case it has special characters)
    const decodedUsername = decodeURIComponent(username);

    // Check if we should skip cache (e.g., after follow/unfollow operations)
    const skipCache = request.headers.get('cache-control') === 'no-cache';
    const user = await getUserByDisplayName(decodedUsername);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Add cache-control header to prevent browser caching when skipCache is requested
    const response = NextResponse.json(user, { status: 200 });
    if (skipCache) {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
    return response;
  } catch (error: any) {
    console.error('Error fetching user by username:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

