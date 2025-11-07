import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/security/session';
import { prisma } from '@/services/prisma';
import { stripe } from '@/services/stripe/stripe.service';
import { updateSessionWithPlanStatus } from '@/utils/security/session';

/**
 * Rota de debug para sincronizar manualmente uma subscription do Stripe para o banco
 * Útil quando o webhook falhou ou não foi recebido
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const sessionData = session as {
      user?: { email?: string };
    } | null;

    if (!sessionData?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subscriptionId, planId } = body;

    if (!subscriptionId || !planId) {
      return NextResponse.json(
        { error: 'subscriptionId and planId are required' },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: sessionData.user.email },
      select: {
        id: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Buscar subscription do Stripe
    const stripeSubscription =
      await stripe.subscriptions.retrieve(subscriptionId);

    // Type assertion para acessar propriedades de período
    const subscriptionWithPeriod =
      stripeSubscription as typeof stripeSubscription & {
        current_period_start: number;
        current_period_end: number;
      };

    // Buscar customer
    const customerId =
      typeof subscriptionWithPeriod.customer === 'string'
        ? subscriptionWithPeriod.customer
        : subscriptionWithPeriod.customer.id;

    // Criar ou atualizar subscription no banco
    const subscriptionRecord = await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        planId: parseInt(planId),
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: customerId,
        status: subscriptionWithPeriod.status,
        billingPeriod:
          subscriptionWithPeriod.items.data[0]?.price.recurring?.interval ===
          'year'
            ? 'yearly'
            : 'monthly',
        trialEndsAt: subscriptionWithPeriod.trial_end
          ? new Date(subscriptionWithPeriod.trial_end * 1000)
          : null,
        currentPeriodStart: new Date(
          subscriptionWithPeriod.current_period_start * 1000,
        ),
        currentPeriodEnd: new Date(
          subscriptionWithPeriod.current_period_end * 1000,
        ),
      },
      update: {
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: customerId,
        status: subscriptionWithPeriod.status,
        billingPeriod:
          subscriptionWithPeriod.items.data[0]?.price.recurring?.interval ===
          'year'
            ? 'yearly'
            : 'monthly',
        trialEndsAt: subscriptionWithPeriod.trial_end
          ? new Date(subscriptionWithPeriod.trial_end * 1000)
          : null,
        currentPeriodStart: new Date(
          subscriptionWithPeriod.current_period_start * 1000,
        ),
        currentPeriodEnd: new Date(
          subscriptionWithPeriod.current_period_end * 1000,
        ),
      },
    });

    // Atualizar plano do usuário
    await prisma.user.update({
      where: { id: user.id },
      data: { planId: parseInt(planId) },
    });

    // Atualizar sessão
    await updateSessionWithPlanStatus(user.email, undefined, true);

    // Calcular uso atual para preservar dados existentes
    const { getStorageUsage, getInstanceCount } = await import(
      '@/services/subscription/subscription.service'
    );

    const currentStorageMB = await getStorageUsage(user.id);
    const currentInstances = await getInstanceCount(user.id);

    // Criar ou atualizar limites com valores reais (não zerar!)
    await prisma.user_plan_limits.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        currentStorageMB,
        currentInstances,
      },
      update: {
        currentStorageMB,
        currentInstances,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription synchronized successfully',
      subscription: {
        id: subscriptionRecord.id,
        userId: subscriptionRecord.userId,
        planId: subscriptionRecord.planId,
        status: subscriptionRecord.status,
      },
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error syncing subscription:', error);
    return NextResponse.json(
      { error: errorMessage, ...(errorStack && { stack: errorStack }) },
      { status: 500 },
    );
  }
}
