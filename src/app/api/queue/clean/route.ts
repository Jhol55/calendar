import { NextRequest, NextResponse } from 'next/server';
import { cleanQueues } from '@/services/queue';

export async function POST(request: NextRequest) {
  try {
    await cleanQueues();

    return NextResponse.json({
      status: 'success',
      message: 'Queues cleaned successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error cleaning queues:', error);
    return NextResponse.json(
      {
        error: 'Failed to clean queues',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
