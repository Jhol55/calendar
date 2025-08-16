import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession } from '@/utils/security/session';
import { verifyConfirmedEmailStatus } from '@/services/user';

export async function middleware(request: NextRequest) {
  const session = await getSession();
  const response = await updateSession(request);
  const path = request.nextUrl.pathname;

  if (!session && path !== '/') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (session && path !== '/' && path !== '/confirm') {
    const response = await verifyConfirmedEmailStatus(session);
    const data = response?.data as { confirmed: boolean };
    if (!data?.confirmed) {
      return NextResponse.redirect(new URL('/confirm', request.url));
    }
  }

  if (session && path === '/confirm') {
    const response = await verifyConfirmedEmailStatus(session);
    const data = response?.data as { confirmed: boolean };
    if (data?.confirmed) {
      return NextResponse.redirect(new URL('/index', request.url));
    }
  }

  if (response) return response;

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|static|.*\\..*|_next).*)'],
};
