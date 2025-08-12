import { authService } from '@/services/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  const data = { confirmed: true, email: email };

  return NextResponse.json({ success: data?.confirmed });
}

export async function POST(request: NextRequest) {
  const requestData = await request.json();
  const validationCode = await authService.generateValidationCodeFromEmail(
    requestData.email,
  );

  if (requestData.validationCode !== validationCode) {
    return NextResponse.json({ success: false });
  }

  return NextResponse.json({ success: true });
}
