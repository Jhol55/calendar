'use server';

import { deleteSession } from '@/utils/security/session';

type LogoutResponse = {
  success: boolean;
  message?: string;
  code?: number;
};

export async function logout(): Promise<LogoutResponse> {
  try {
    await deleteSession();

    return {
      success: true,
      message: 'Logout realizado com sucesso',
      code: 200,
    };
  } catch (error) {
    console.error('Erro ao fazer logout:', error);

    return {
      success: false,
      message: 'Erro ao fazer logout',
      code: 500,
    };
  }
}
