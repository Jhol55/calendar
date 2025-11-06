'use server';

import { getUserIdFromSession } from '@/lib/auth/session';
import { prisma } from '@/services/prisma';

export async function hasUsedTrial(): Promise<{
  success: boolean;
  hasUsedTrial: boolean;
  message?: string;
}> {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return {
        success: false,
        hasUsedTrial: false,
        message: 'Unauthorized',
      };
    }

    // Verificar se tem subscription com plano Trial (mesmo que cancelada)
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: {
        plan: true,
      },
    });

    if (subscription && subscription.plan?.slug === 'trial') {
      return {
        success: true,
        hasUsedTrial: true,
      };
    }

    // Verificar se o plano atual do usuário é Trial
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        plan: true,
      },
    });

    if (user?.plan?.slug === 'trial') {
      return {
        success: true,
        hasUsedTrial: true,
      };
    }

    return {
      success: true,
      hasUsedTrial: false,
    };
  } catch (error: unknown) {
    console.error('Error checking if user has used trial:', error);
    return {
      success: false,
      hasUsedTrial: false,
      message: 'Failed to check trial usage',
    };
  }
}
