import { userService } from '@/services/user';
import { supabase } from '@/services/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  const { data } = await supabase
    .from('users')
    .select('confirmed')
    .eq('email', email)
    .single();

  return NextResponse.json({ success: data?.confirmed });
}

export async function POST(request: NextRequest) {
  const requestData = await request.json();
  const validationCode = userService.generateValidationCodeFromEmail(
    requestData.email,
  );

  if (requestData.validationCode !== validationCode) {
    return NextResponse.json({ success: false });
  }

  await supabase
    .from('users')
    .update({ confirmed: true })
    .eq('email', requestData.email);

  return NextResponse.json({ success: true });
}
