'use server';

import { getUserIdFromSession } from '@/lib/auth/session';
import { getUserPlan } from '@/services/subscription/subscription.service';

/**
 * Verifica se o usuário tem um plano ativo (incluindo trial)
 * Usa a mesma lógica do getUserPlan que já verifica todos os casos
 */
export async function hasActivePlan(): Promise<{
  success: boolean;
  hasActivePlan?: boolean;
  message?: string;
}> {
  try {
    const userId = await getUserIdFromSession();

    console.log('[hasActivePlan] userId:', userId);

    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
      };
    }

    // Usar getUserPlan que já tem toda a lógica de verificação
    const userPlan = await getUserPlan(userId);

    console.log('[hasActivePlan] userPlan:', userPlan);
    console.log(
      '[hasActivePlan] hasActivePlan:',
      userPlan !== null && userPlan.isActive,
    );

    return {
      success: true,
      hasActivePlan: userPlan !== null && userPlan.isActive,
    };
  } catch (error: any) {
    console.error(
      '[hasActivePlan] Error checking if user has active plan:',
      error,
    );
    return {
      success: false,
      message: 'Failed to check plan status',
    };
  }
}
