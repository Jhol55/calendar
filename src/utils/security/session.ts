import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

function getKey(): Uint8Array {
  const secretKey = process.env.SECRET_KEY;
  if (!secretKey) {
    throw new Error('Secret key is required');
  }
  return new TextEncoder().encode(secretKey);
}

async function encrypt(payload: JWTPayload, time: number): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${time}s`)
    .sign(getKey());
}

async function decrypt(input: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(input, getKey(), {
    algorithms: ['HS256'],
  });
  return payload;
}

export async function createSession(
  formData: {
    email: string;
    remember: boolean;
  },
  userData?: {
    confirmed?: boolean;
    hasPlan?: boolean;
  },
): Promise<void> {
  const user = { email: formData.email };
  const remember = formData.remember;
  const time = remember ? 7 * 24 * 60 * 60 : 60 * 60; // 7 dias ou 1 hora
  const expires = new Date(Date.now() + time * 1000);

  const sessionPayload: JWTPayload = {
    user,
    expires,
    remember,
    confirmed: userData?.confirmed ?? false,
    hasPlan: userData?.hasPlan ?? false,
  };

  const session = await encrypt(sessionPayload, time);

  cookies().set({
    name: 'session',
    value: session,
    expires: expires,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  });
}

/**
 * Atualizar sessão com informações de plano e confirmação
 * Útil quando o usuário confirma email ou cria/substitui plano
 */
export async function updateSessionWithPlanStatus(
  email: string,
  confirmed?: boolean,
  hasPlan?: boolean,
): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const sessionData = session as {
    user?: { email?: string };
    remember?: boolean;
    confirmed?: boolean;
    hasPlan?: boolean;
  };

  // Só atualizar se o email corresponder
  if (sessionData.user?.email !== email) return;

  const remember = sessionData.remember ?? false;
  const time = remember ? 7 * 24 * 60 * 60 : 60 * 60;
  const expires = new Date(Date.now() + time * 1000);

  const updatedPayload: JWTPayload = {
    ...sessionData,
    expires,
    confirmed:
      confirmed !== undefined ? confirmed : (sessionData.confirmed ?? false),
    hasPlan: hasPlan !== undefined ? hasPlan : (sessionData.hasPlan ?? false),
  };

  const updatedSession = await encrypt(updatedPayload, time);

  cookies().set({
    name: 'session',
    value: updatedSession,
    expires: expires,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  });
}

export async function deleteSession(): Promise<void> {
  cookies().delete('session');
}

export async function getSession(): Promise<JWTPayload | null> {
  const session = cookies().get('session')?.value;
  if (!session) return null;
  return await decrypt(session);
}

export async function updateSession(
  request: NextRequest,
): Promise<NextResponse | void> {
  const session = request.cookies.get('session')?.value;
  if (!session) return;

  const parsed = (await decrypt(session)) as {
    expires: Date;
    remember: boolean;
    confirmed?: boolean;
    hasPlan?: boolean;
    user?: { email?: string };
  };
  const time = parsed.remember ? 7 * 24 * 60 * 60 : 60 * 60;
  parsed.expires = new Date(Date.now() + time * 1000);
  const res = NextResponse.next();
  res.cookies.set({
    name: 'session',
    value: await encrypt(parsed, time),
    expires: parsed.expires,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  });
  return res;
}
