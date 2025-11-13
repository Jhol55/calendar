import { NextResponse, NextRequest } from 'next/server';
import { getSession } from '@/utils/security/session';
import { processOAuthCallback } from '@/actions/whatsapp-official/embedded-signup';

interface SessionUser {
  user: {
    email: string;
  };
  expires: Date;
  remember: boolean;
}

/**
 * Callback para criar instância Cloud após OAuth bem-sucedido
 *
 * Este endpoint é chamado pelo Facebook após o usuário completar o fluxo de Embedded Signup:
 * 1. Escolheu "Conectar app WhatsApp Business existente"
 * 2. Digitou o número de telefone
 * 3. Escaneou o QR code
 * 4. Selecionou contas WhatsApp Business
 * 5. Facebook redireciona para aqui com code e state
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // tempToken contendo email:timestamp:nome
    const error = searchParams.get('error');

    // Embedded Signup pode enviar waba_id e phone_number_id diretamente
    const wabaId = searchParams.get('waba_id');
    const phoneNumberId = searchParams.get('phone_number_id');

    console.log('📥 Parâmetros recebidos:');
    console.log('  - code:', code ? '✅ presente' : '❌ ausente');
    console.log('  - state:', state ? '✅ presente' : '❌ ausente');
    console.log('  - waba_id:', wabaId || '❌ não enviado');
    console.log('  - phone_number_id:', phoneNumberId || '❌ não enviado');

    // Construir origin correto usando headers (importante para proxies/ngrok)
    // request.nextUrl.origin retorna localhost quando atrás de proxy
    // Devemos usar os headers x-forwarded-proto e host para o domínio real
    const host = request.headers.get('host') || request.nextUrl.hostname;
    const protocol =
      request.headers.get('x-forwarded-proto') ||
      request.nextUrl.protocol.replace(':', '');
    const currentOrigin = `${protocol}://${host}`;

    console.log('📥 Callback recebido com origem construída:', currentOrigin);
    console.log(
      '📥 request.nextUrl.origin (original):',
      request.nextUrl.origin,
    );
    console.log('📥 host:', host);
    console.log('📥 protocol:', protocol);

    if (error) {
      return NextResponse.redirect(
        `${currentOrigin}/instances?error=${encodeURIComponent(error)}`,
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${currentOrigin}/instances?error=missing_params`,
      );
    }

    const session = (await getSession()) as SessionUser | null;
    const email = session?.user?.email;

    if (!email) {
      return NextResponse.redirect(
        `${currentOrigin}/instances?error=unauthorized`,
      );
    }

    // Processar callback OAuth usando a função centralizada
    // Passar waba_id e phone_number_id caso venham na URL (Embedded Signup)
    const result = await processOAuthCallback(
      code,
      state,
      email,
      currentOrigin,
      wabaId || undefined,
      phoneNumberId || undefined,
    );

    if (!result.success) {
      return NextResponse.redirect(
        `${currentOrigin}/instances?error=${encodeURIComponent(result.message || 'callback_error')}`,
      );
    }

    return NextResponse.redirect(
      `${currentOrigin}/instances?success=cloud_instance_created`,
    );
  } catch (error) {
    console.error('Erro no callback criação Cloud:', error);
    // Usar domínio atual da requisição mesmo em caso de erro
    const currentOrigin = request.nextUrl.origin;
    return NextResponse.redirect(
      `${currentOrigin}/instances?error=callback_error`,
    );
  }
}
