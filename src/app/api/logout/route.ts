import { NextResponse } from 'next/server';
import { deleteSession } from '@/utils/security/session';

export async function POST() {
  await deleteSession();

  return NextResponse.json({
    success: true,
  });
}
