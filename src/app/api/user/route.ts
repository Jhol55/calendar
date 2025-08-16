import { getSession } from '@/utils/security/session';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getSession();
  const { email } = session?.user as { email: string };

  const data = { email: email };

  return NextResponse.json(data);
}
