import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/services/user';
import { sessionService } from '@/services/session';

export async function POST(request: NextRequest) {
  const requestData = await request.json();

  const data = { password: '1' };

  const success = userService.verifyPassword(
    requestData.password,
    data?.password,
  );
  if (success) {
    await sessionService.createSession(requestData);
  }

  return NextResponse.json({ success });
}
