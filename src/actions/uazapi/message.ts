'use server';

import { getSession } from '@/utils/security/session';

interface SessionUser {
  user: {
    email: string;
  };
  expires: Date;
  remember: boolean;
}

type UazapiResponse = {
  success: boolean;
  message?: string;
  code?: number;
  field?: string;
  data?: unknown;
};

export async function sendMessage({
  token,
  formData,
}: {
  token: string;
  formData: object;
}): Promise<UazapiResponse> {
  try {
    const session = (await getSession()) as SessionUser | null;
    const email = session?.user?.email;

    if (!email || !token) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    const response = await fetch(
      `http://localhost:3000/api/uazapi/user/message/text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          token,
          formData,
        }),
      },
    );

    const data = await response.json();

    return {
      success: response.ok,
      message: response.ok
        ? 'Mensagem enviada com sucesso'
        : response.statusText,
      code: response.status,
      data: data,
    };
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    return {
      success: false,
      message: 'Erro ao enviar mensagem',
      code: 500,
    };
  }
}
