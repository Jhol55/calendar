import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/security/session';
import { createCloudInstanceWithIds } from '@/actions/whatsapp-official/embedded-signup';

interface SessionUser {
  user: {
    email: string;
  };
  expires: Date;
  remember: boolean;
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      {
        success: false,
        message: 'Endpoint disponível apenas em ambiente de desenvolvimento',
      },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const {
      name,
      wabaId,
      phoneNumberId,
      accessToken,
      twoFactorPin,
      accountType,
      isTestAccount,
    } = body ?? {};

    if (!name || !wabaId || !phoneNumberId || !accessToken) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Parâmetros obrigatórios: name, wabaId, phoneNumberId, accessToken',
        },
        { status: 400 },
      );
    }

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

    const sanitizedPin =
      typeof twoFactorPin === 'string' && twoFactorPin.trim().length === 6
        ? twoFactorPin.trim()
        : undefined;

    // Garantir que sempre enviamos um boolean em isTestAccount
    const isTest =
      typeof isTestAccount === 'boolean'
        ? isTestAccount
        : accountType === 'test';

    const result = await createCloudInstanceWithIds(
      name,
      wabaId,
      phoneNumberId,
      accessToken,
      email,
      sanitizedPin,
      isTest,
    );

    return NextResponse.json(result, {
      status: result.success ? 200 : result.code || 500,
    });
  } catch (error) {
    console.error('Erro ao criar instância de teste:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Erro ao criar instância de teste',
      },
      { status: 500 },
    );
  }
}
