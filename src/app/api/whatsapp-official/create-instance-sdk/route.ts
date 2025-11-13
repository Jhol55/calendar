import { NextResponse, NextRequest } from 'next/server';
import { getSession } from '@/utils/security/session';
import { createCloudInstanceWithIds } from '@/actions/whatsapp-official/embedded-signup';

interface SessionUser {
  user: {
    email: string;
  };
  expires: Date;
  remember: boolean;
}

/**
 * Criar instância Cloud usando waba_id e phone_number_id diretamente
 *
 * Este endpoint é usado quando o Embedded Signup é feito via SDK do Facebook (FB.login)
 * Neste caso, recebemos waba_id e phone_number_id via postMessage e não precisamos
 * trocar código por token via redirect_uri
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code, wabaId, phoneNumberId, twoFactorPin } = body;

    console.log('📥 Requisição recebida no backend:');
    console.log('  - body completo:', body);
    console.log('  - name:', name || '❌ AUSENTE');
    console.log('  - code:', code ? '✅ presente' : '❌ AUSENTE');
    console.log('  - wabaId:', wabaId || '❌ AUSENTE');
    console.log('  - phoneNumberId:', phoneNumberId || '❌ AUSENTE');
    console.log(
      '  - twoFactorPin:',
      twoFactorPin ? '✅ fornecido (6 dígitos)' : '❌ não fornecido',
    );

    if (!name || !code || !wabaId || !phoneNumberId) {
      console.error('❌ Parâmetros faltando!');
      return NextResponse.json(
        {
          success: false,
          message: 'Parâmetros obrigatórios: name, code, wabaId, phoneNumberId',
        },
        { status: 400 },
      );
    }

    // Trocar code por access token (server-to-server, SEM redirect_uri)
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      return NextResponse.json(
        {
          success: false,
          message: 'Facebook App ID ou Secret não configurado',
        },
        { status: 500 },
      );
    }

    console.log('🔄 Trocando code por access token...');

    const tokenResponse = await fetch(
      'https://graph.facebook.com/v23.0/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: appId,
          client_secret: appSecret,
          code: code,
        }).toString(),
      },
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Erro ao trocar code por token:', errorText);
      return NextResponse.json(
        {
          success: false,
          message: 'Erro ao obter access token do Facebook',
        },
        { status: tokenResponse.status },
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error('❌ Token não retornado pela API do Facebook');
      return NextResponse.json(
        {
          success: false,
          message: 'Token não foi retornado pelo Facebook',
        },
        { status: 500 },
      );
    }

    console.log('✅ Access token obtido com sucesso!');

    const session = (await getSession()) as SessionUser | null;
    const email = session?.user?.email;

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          message: 'Unauthorized',
        },
        { status: 401 },
      );
    }

    console.log('📥 Criando instância Cloud via SDK');
    console.log('📥 Name:', name);
    console.log('📥 WABA ID:', wabaId);
    console.log('📥 Phone Number ID:', phoneNumberId);
    console.log('📥 Email:', email);

    // Criar instância diretamente com os IDs e token
    const result = await createCloudInstanceWithIds(
      name,
      wabaId,
      phoneNumberId,
      accessToken,
      email,
      twoFactorPin, // Passar PIN para função
      false, // Não é conta de teste
    );

    if (!result.success) {
      return NextResponse.json(result, { status: result.code || 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao criar instância Cloud via SDK:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Erro ao criar instância',
      },
      { status: 500 },
    );
  }
}
