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

    // Usar o domínio atual da requisição (importante para ngrok)
    const currentOrigin = request.nextUrl.origin;

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
    const result = await processOAuthCallback(
      code,
      state,
      email,
      currentOrigin,
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
