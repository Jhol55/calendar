'use server';

import { getUserIdFromSession } from '@/lib/auth/session';
import { prisma } from '@/services/prisma';
import { cancelSubscription } from '@/services/stripe/stripe.service';
import { updateSessionWithPlanStatus } from '@/utils/security/session';

export async function cancelUserSubscription(
  cancelAtPeriodEnd: boolean = true,
): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
      };
    }

    // Buscar subscription do usuário
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: {
        user: {
          select: { email: true },
        },
      },
    });

    if (!subscription) {
      return {
        success: false,
        message: 'Nenhuma assinatura encontrada',
      };
    }

    // Verificar se já está cancelada
    if (subscription.status === 'canceled') {
      return {
        success: false,
        message: 'Assinatura já está cancelada',
      };
    }

    // Se for trial (sem stripeSubscriptionId), apenas cancelar no banco
    if (!subscription.stripeSubscriptionId) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'canceled',
          canceledAt: new Date(),
          cancelAtPeriodEnd: false,
        },
      });

      // Resetar plano do usuário
      await prisma.user.update({
        where: { id: userId },
        data: { planId: null },
      });

      // Atualizar sessão
      if (subscription.user?.email) {
        await updateSessionWithPlanStatus(
          subscription.user.email,
          undefined,
          false,
        );
      }

      return {
        success: true,
        message: 'Assinatura de trial cancelada com sucesso',
      };
    }

    // Para subscriptions do Stripe, cancelar via API
    await cancelSubscription(
      subscription.stripeSubscriptionId,
      cancelAtPeriodEnd,
    );

    // Atualizar no banco
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: cancelAtPeriodEnd ? subscription.status : 'canceled',
        canceledAt: cancelAtPeriodEnd ? null : new Date(),
        cancelAtPeriodEnd,
      },
    });

    // Se cancelamento imediato, resetar plano e sessão
    if (!cancelAtPeriodEnd) {
      await prisma.user.update({
        where: { id: userId },
        data: { planId: null },
      });

      if (subscription.user?.email) {
        await updateSessionWithPlanStatus(
          subscription.user.email,
          undefined,
          false,
        );
      }
    }

    return {
      success: true,
      message: cancelAtPeriodEnd
        ? 'Assinatura será cancelada ao final do período atual'
        : 'Assinatura cancelada com sucesso',
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Error canceling subscription:', err);
    return {
      success: false,
      message: 'Erro ao cancelar assinatura. Tente novamente.',
    };
  }
}
