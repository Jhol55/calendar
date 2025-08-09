import { NextRequest, NextResponse } from 'next/server';
import { sessionService } from '@/services/session';
import { userService } from '@/services/user';

export async function middleware(request: NextRequest) {
  const session = await sessionService.getSession();
  const response = await sessionService.updateSession(request);
  const path = request.nextUrl.pathname;

  if (!session && path !== '/') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (session && path !== '/' && path !== '/confirm') {
    const response = await userService.verifyConfirmedEmailStatus(session);
    if (!response?.success) {
      return NextResponse.redirect(new URL('/confirm', request.url));
    }
  }

  if (session && path === '/confirm') {
    const response = await userService.verifyConfirmedEmailStatus(session);
    if (response?.success) {
      return NextResponse.redirect(new URL('/index', request.url));
    }
  }

  if (response) return response;

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|static|.*\\..*|_next).*)'],
};
