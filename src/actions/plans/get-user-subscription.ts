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

    // SEMPRE recalcular storage e instances (função crítica para billing)
    const { getStorageUsage, getInstanceCount } = await import(
      '@/services/subscription/subscription.service'
    );
    const currentStorageMB = await getStorageUsage(userId);
    const currentInstances = await getInstanceCount(userId);

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
          storageMB: currentStorageMB,
          instances: currentInstances,
        },
      },
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error fetching user subscription:', errorMessage);
    return {
      success: false,
      message: 'Failed to fetch subscription',
    };
  }
}
