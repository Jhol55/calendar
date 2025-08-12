import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/services/auth';
import { sessionService } from '@/services/session';

export async function POST(request: NextRequest) {
  const requestData = await request.json();

  const data = { password: '1' };

  const success = await authService.verifyPassword(
    requestData.password,
    data?.password,
  );
  if (success) {
    await sessionService.createSession(requestData);
  }

  return NextResponse.json({ success });
}
