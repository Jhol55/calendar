import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export class sessionService {
  private static get key(): Uint8Array {
    const secretKey = process.env.SECRET_KEY;
    if (!secretKey) {
      throw new Error('Secret key is required');
    }
    return new TextEncoder().encode(secretKey);
  }

  private static async encrypt(
    payload: JWTPayload,
    time: number,
  ): Promise<string> {
    return await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${time}s`)
      .sign(this.key);
  }

  private static async decrypt(input: string): Promise<JWTPayload> {
    const { payload } = await jwtVerify(input, this.key, {
      algorithms: ['HS256'],
    });
    return payload;
  }

  public static async createSession(formData: {
    email: string;
    remember: boolean;
  }): Promise<void> {
    const user = { email: formData.email };
    const remember = formData.remember;
    const time = remember ? 7 * 24 * 60 * 60 : 60 * 60; // 7 dias ou 1 hora
    const expires = new Date(Date.now() + time * 1000);
    const session = await this.encrypt({ user, expires, remember }, time);
    cookies().set('session', session, {
      expires,
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });
  }

  public static async deleteSession(): Promise<void> {
    cookies().delete('session');
  }

  public static async getSession(): Promise<JWTPayload | null> {
    const session = cookies().get('session')?.value;
    if (!session) return null;
    return await this.decrypt(session);
  }

  public static async updateSession(
    request: NextRequest,
  ): Promise<NextResponse | void> {
    const session = request.cookies.get('session')?.value;
    if (!session) return;

    const parsed = (await this.decrypt(session)) as {
      expires: Date;
      remember: boolean;
    };
    const time = parsed.remember ? 7 * 24 * 60 * 60 : 60 * 60;
    parsed.expires = new Date(Date.now() + time * 1000);
    const res = NextResponse.next();
    res.cookies.set({
      name: 'session',
      value: await this.encrypt(parsed, time),
      expires: parsed.expires,
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });
    return res;
  }
}
