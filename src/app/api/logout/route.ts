import { NextResponse } from 'next/server';
import { sessionService } from '@/services/session';

export async function POST() {
  await sessionService.deleteSession();

  return NextResponse.json({
    success: true,
  });
}
