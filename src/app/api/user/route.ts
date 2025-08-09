import { sessionService } from '@/services/session';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await sessionService.getSession();
  const { email } = session?.user as { email: string };

  const data = { email: email };

  return NextResponse.json(data);
}
