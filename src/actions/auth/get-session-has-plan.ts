'use server';

import { getSession } from '@/utils/security/session';

/**
 * Verifica se o usuário tem plano ativo baseado na sessão
 * Usa a informação já calculada durante o login
 */
export async function getSessionHasPlan(): Promise<{
  success: boolean;
  hasPlan?: boolean;
  message?: string;
}> {
  try {
    console.log('[getSessionHasPlan] Buscando sessão...');
    const session = await getSession();
    console.log('[getSessionHasPlan] Sessão encontrada:', !!session);

    if (!session) {
      console.log('[getSessionHasPlan] Sem sessão');
      return {
        success: false,
        message: 'No session found',
      };
    }

    const sessionData = session as {
      user?: { email?: string };
      confirmed?: boolean;
      hasPlan?: boolean;
    } | null;

    console.log('[getSessionHasPlan] sessionData:', {
      email: sessionData?.user?.email,
      confirmed: sessionData?.confirmed,
      hasPlan: sessionData?.hasPlan,
    });

    if (!sessionData?.user?.email) {
      console.log('[getSessionHasPlan] Sem email na sessão');
      return {
        success: false,
        message: 'Unauthorized',
      };
    }

    const hasPlan = sessionData.hasPlan ?? false;
    console.log('[getSessionHasPlan] hasPlan final:', hasPlan);

    return {
      success: true,
      hasPlan,
    };
  } catch (error: any) {
    console.error('[getSessionHasPlan] Erro:', error);
    return {
      success: false,
      message: 'Failed to get session data',
    };
  }
}
