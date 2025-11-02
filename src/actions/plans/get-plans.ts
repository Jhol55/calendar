'use server';

import { prisma } from '@/services/prisma';
import { Plan } from '@/types/subscription';

export async function getPlans(): Promise<{
  success: boolean;
  data?: Plan[];
  message?: string;
}> {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ priceMonthly: 'asc' }, { id: 'asc' }],
    });

    return {
      success: true,
      data: plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        description: plan.description || undefined,
        maxStorageMB: plan.maxStorageMB,
        maxInstances: plan.maxInstances,
        priceMonthly: Number(plan.priceMonthly),
        priceYearly: Number(plan.priceYearly),
        features: (plan.features as string[]) || [],
        isActive: plan.isActive,
      })),
    };
  } catch (error: any) {
    console.error('Error fetching plans:', error);
    return {
      success: false,
      message: 'Failed to fetch plans',
    };
  }
}
