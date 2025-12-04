import { NextRequest, NextResponse } from 'next/server';
import { followUser, unfollowUser } from '@/app/lib/followService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { followerId, followingId } = body;

    console.log('POST /api/follow - Request body:', { followerId, followingId });

    if (!followerId || !followingId) {
      return NextResponse.json(
        { error: 'followerId and followingId are required' },
        { status: 400 }
      );
    }

    const follow = await followUser(followerId, followingId);
    console.log('POST /api/follow - Success:', follow.id);

    return NextResponse.json(follow, { status: 200 });
  } catch (error: any) {
    console.error('Error following user:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: error.message || 'Failed to follow user' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { followerId, followingId } = body;

    console.log('DELETE /api/follow - Request body:', { followerId, followingId });

    if (!followerId || !followingId) {
      return NextResponse.json(
        { error: 'followerId and followingId are required' },
        { status: 400 }
      );
    }

    const result = await unfollowUser(followerId, followingId);
    console.log('DELETE /api/follow - Success:', result.count, 'relationships deleted');

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error unfollowing user:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: error.message || 'Failed to unfollow user' },
      { status: 500 }
    );
  }
}

