import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession } from '@/utils/security/session';

// Rotas dentro de (auth) que PRECISAM de plano
const PROTECTED_AUTH_ROUTES = ['/index', '/instances', '/workflows'];

// Verificar se a rota está dentro de (auth) e precisa de plano
function requiresPlan(path: string): boolean {
  // Verificar se está em uma rota protegida
  return PROTECTED_AUTH_ROUTES.some((route) => path.startsWith(route));
}

export async function middleware(request: NextRequest) {
  const session = await getSession();
  const path = request.nextUrl.pathname;

  // 1. Verificar autenticação
  if (!session && path !== '/') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Se não há sessão, continuar apenas para rotas públicas
  if (!session) {
    return NextResponse.next();
  }

  // 2. Extrair informações da sessão (JWT contém hasPlan e confirmed)
  const sessionData = session as {
    user?: { email?: string };
    confirmed?: boolean;
    hasPlan?: boolean;
  } | null;

  console.log(`🔍 Middleware - Path: ${path}, Session data:`, {
    email: sessionData?.user?.email,
    confirmed: sessionData?.confirmed,
    hasPlan: sessionData?.hasPlan,
  });

  if (!sessionData?.user?.email) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const confirmed = sessionData.confirmed ?? false;
  const hasPlan = sessionData.hasPlan ?? false;

  // 3. Verificar confirmação de email (exceto rotas públicas)
  if (!confirmed && path !== '/confirm' && path !== '/') {
    console.log(`🚫 Redirecting to /confirm - Email not confirmed`);
    return NextResponse.redirect(new URL('/confirm', request.url));
  }

  if (confirmed && path === '/confirm') {
    return NextResponse.redirect(new URL('/index', request.url));
  }

  // 4. Verificar plano ativo apenas para rotas protegidas dentro de (auth)
  if (requiresPlan(path) && !hasPlan) {
    console.log(
      `🚫 Blocking access to ${path} - No active plan (hasPlan: ${hasPlan})`,
    );
    return NextResponse.redirect(new URL('/plans', request.url));
  }

  if (requiresPlan(path) && hasPlan) {
    console.log(`✅ Allowing access to ${path} - Has active plan`);
  }

  // 5. Atualizar sessão APÓS todas as verificações (para renovar expiração)
  const response = await updateSession(request);
  if (response) return response;

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|static|.*\\..*|_next).*)'],
};
