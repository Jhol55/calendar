'use server';

import { getUserIdFromSession } from '@/lib/auth/session';
import { prisma } from '@/services/prisma';
import { Subscription } from '@/types/subscription';

export async function getUserSubscription(): Promise<{
  success: boolean;
  data?: Subscription;
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

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: {
        plan: true,
      },
    });

    // Buscar limites atuais (uso)
    const limits = await prisma.user_plan_limits.findUnique({
      where: { userId },
    });

    if (!subscription) {
      return {
        success: false,
        message: 'No subscription found',
      };
    }

    return {
      success: true,
      data: {
        id: subscription.id,
        userId: subscription.userId,
        planId: subscription.planId,
        stripeSubscriptionId: subscription.stripeSubscriptionId || undefined,
        stripeCustomerId: subscription.stripeCustomerId || undefined,
        status: subscription.status,
        billingPeriod: subscription.billingPeriod,
        trialEndsAt: subscription.trialEndsAt || undefined,
        currentPeriodStart: subscription.currentPeriodStart || undefined,
        currentPeriodEnd: subscription.currentPeriodEnd || undefined,
        canceledAt: subscription.canceledAt || undefined,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        plan: subscription.plan
          ? {
              id: subscription.plan.id,
              name: subscription.plan.name,
              slug: subscription.plan.slug,
              description: subscription.plan.description || undefined,
              maxStorageMB: subscription.plan.maxStorageMB,
              maxInstances: subscription.plan.maxInstances,
              priceMonthly: Number(subscription.plan.priceMonthly),
              priceYearly: Number(subscription.plan.priceYearly),
              features: (subscription.plan.features as string[]) || [],
              isActive: subscription.plan.isActive,
            }
          : undefined,
        currentUsage: {
          storageMB: limits?.currentStorageMB || 0,
          instances: limits?.currentInstances || 0,
        },
      },
    };
  } catch (error: any) {
    console.error('Error fetching user subscription:', error);
    return {
      success: false,
      message: 'Failed to fetch subscription',
    };
  }
}
