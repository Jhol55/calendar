import { sessionService } from '@/services/session';
import { supabase } from '@/services/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await sessionService.getSession();
  const { email } = session?.user as { email: string };

  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  return NextResponse.json(data);
}
