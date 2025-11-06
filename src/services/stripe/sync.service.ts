/**
 * Serviço de sincronização de assinaturas Stripe com o banco de dados
 * Garante que as assinaturas estejam sempre em sincronia
 */

import Stripe from 'stripe';
import { prisma } from '@/services/prisma';
import { updateSessionWithPlanStatus } from '@/utils/security/session';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

interface SyncResult {
  success: boolean;
  processed: number;
  errors: number;
  details: Array<{
    userId: number;
    email?: string;
    subscriptionId: string;
    action: string;
    error?: string;
  }>;
}

/**
 * Sincronizar todas as assinaturas do Stripe com o banco de dados
 * Útil para reconciliar diferenças ou após deploy/outage
 */
export async function syncAllSubscriptions(): Promise<SyncResult> {
  console.log('🔄 Iniciando sincronização completa de assinaturas...');

  const result: SyncResult = {
    success: true,
    processed: 0,
    errors: 0,
    details: [],
  };

  try {
    // Buscar todas as assinaturas do Stripe (apenas ativas, trialing, past_due)
    const subscriptions = await stripe.subscriptions.list({
      limit: 100, // Stripe paginação
      status: 'all', // Buscar todas para reconciliar
    });

    console.log(
      `📊 Encontradas ${subscriptions.data.length} assinaturas no Stripe`,
    );

    // Processar cada assinatura
    for (const subscription of subscriptions.data) {
      try {
        await syncSingleSubscription(subscription);
        result.processed++;
        result.details.push({
          userId: 0, // Será preenchido na função
          subscriptionId: subscription.id,
          action: 'synced',
        });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        result.errors++;
        result.success = false;
        result.details.push({
          userId: 0,
          subscriptionId: subscription.id,
          action: 'error',
          error: errorMessage,
        });
        console.error(
          `❌ Erro ao sincronizar assinatura ${subscription.id}:`,
          errorMessage,
        );
      }
    }

    console.log(
      `✅ Sincronização concluída: ${result.processed} processadas, ${result.errors} erros`,
    );
    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Erro crítico ao sincronizar assinaturas:', error);
    result.success = false;
    result.details.push({
      userId: 0,
      subscriptionId: 'all',
      action: 'critical_error',
      error: errorMessage,
    });
    return result;
  }
}

/**
 * Sincronizar uma assinatura específica do Stripe com o banco de dados
 */
export async function syncSingleSubscription(
  subscription: Stripe.Subscription,
): Promise<void> {
  console.log(`🔄 Sincronizando assinatura: ${subscription.id}`);

  // Buscar assinatura no banco
  const dbSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    include: {
      user: {
        select: { email: true },
      },
    },
  });

  // Se não existe no banco, tentar criar
  if (!dbSubscription) {
    console.log(
      `⚠️ Assinatura ${subscription.id} não encontrada no banco, tentando criar...`,
    );

    // Tentar encontrar o usuário pelo customer ID
    const customer = await stripe.customers.retrieve(
      subscription.customer as string,
    );

    if (customer.deleted || !customer.email) {
      throw new Error(
        `Customer inválido ou deletado: ${subscription.customer}`,
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: customer.email },
    });

    if (!user) {
      throw new Error(`Usuário não encontrado para email: ${customer.email}`);
    }

    // Buscar planId pelo priceId
    const priceId = subscription.items.data[0]?.price.id;
    const planId = await findPlanIdByPriceId(priceId);

    if (!planId) {
      throw new Error(`Plano não encontrado para priceId: ${priceId}`);
    }

    // Criar assinatura no banco
    await createSubscriptionFromStripe(subscription, user.id, planId);
    console.log(`✅ Assinatura criada no banco: ${subscription.id}`);
    return;
  }

  // Se existe, atualizar com dados do Stripe
  await updateSubscriptionFromStripe(subscription, dbSubscription.id);
  console.log(`✅ Assinatura atualizada no banco: ${subscription.id}`);
}

/**
 * Criar assinatura no banco a partir de dados do Stripe
 */
async function createSubscriptionFromStripe(
  subscription: Stripe.Subscription,
  userId: number,
  planId: number,
): Promise<void> {
  const safeUnixToDate = (
    timestamp: number | null | undefined,
  ): Date | null => {
    if (
      timestamp &&
      typeof timestamp === 'number' &&
      !isNaN(timestamp) &&
      timestamp > 0
    ) {
      return new Date(timestamp * 1000);
    }
    return null;
  };

  const billingPeriod =
    subscription.items.data[0]?.price.recurring?.interval === 'year'
      ? 'yearly'
      : 'monthly';

  await prisma.subscription.create({
    data: {
      userId,
      planId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      status: subscription.status,
      billingPeriod,
      trialEndsAt: safeUnixToDate(subscription.trial_end),
      currentPeriodStart: safeUnixToDate(subscription.current_period_start),
      currentPeriodEnd: safeUnixToDate(subscription.current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: safeUnixToDate(subscription.cancel_at),
    },
  });

  // Atualizar plano do usuário
  await prisma.user.update({
    where: { id: userId },
    data: { planId },
  });

  // Atualizar sessão
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (user) {
    await updateSessionWithPlanStatus(user.email, undefined, true);
  }
}

/**
 * Atualizar assinatura no banco a partir de dados do Stripe
 */
async function updateSubscriptionFromStripe(
  subscription: Stripe.Subscription,
  dbSubscriptionId: number,
): Promise<void> {
  const safeUnixToDate = (
    timestamp: number | null | undefined,
  ): Date | null => {
    if (
      timestamp &&
      typeof timestamp === 'number' &&
      !isNaN(timestamp) &&
      timestamp > 0
    ) {
      return new Date(timestamp * 1000);
    }
    return null;
  };

  // Buscar planId pelo priceId
  const priceId = subscription.items.data[0]?.price.id;
  const planId = await findPlanIdByPriceId(priceId);

  const billingPeriod =
    subscription.items.data[0]?.price.recurring?.interval === 'year'
      ? 'yearly'
      : 'monthly';

  const updateData: Parameters<typeof prisma.subscription.update>[0]['data'] = {
    status: subscription.status,
    billingPeriod: planId ? billingPeriod : undefined, // Só atualizar se encontrou o plano
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };

  // Adicionar planId se encontrado
  if (planId) {
    updateData.planId = planId;
  }

  // Adicionar datas apenas se não forem null
  const trialEndsAt = safeUnixToDate(subscription.trial_end);
  const currentPeriodStart = safeUnixToDate(subscription.current_period_start);
  const currentPeriodEnd = safeUnixToDate(subscription.current_period_end);
  const canceledAt = safeUnixToDate(subscription.cancel_at);

  if (trialEndsAt !== null) updateData.trialEndsAt = trialEndsAt;
  if (currentPeriodStart !== null)
    updateData.currentPeriodStart = currentPeriodStart;
  if (currentPeriodEnd !== null) updateData.currentPeriodEnd = currentPeriodEnd;
  if (canceledAt !== null) updateData.canceledAt = canceledAt;

  await prisma.subscription.update({
    where: { id: dbSubscriptionId },
    data: updateData,
  });

  // Atualizar plano do usuário se o planId mudou
  if (planId) {
    const dbSubscription = await prisma.subscription.findUnique({
      where: { id: dbSubscriptionId },
    });

    if (dbSubscription && dbSubscription.planId !== planId) {
      await prisma.user.update({
        where: { id: dbSubscription.userId },
        data: { planId },
      });
    }
  }
}

/**
 * Buscar planId correspondente a um priceId do Stripe
 */
async function findPlanIdByPriceId(priceId?: string): Promise<number | null> {
  if (!priceId) return null;

  const plans = await prisma.plan.findMany({
    where: { isActive: true },
  });

  for (const plan of plans) {
    const monthlyKey = `STRIPE_PRICE_${plan.slug.toUpperCase()}_MONTHLY`;
    const yearlyKey = `STRIPE_PRICE_${plan.slug.toUpperCase()}_YEARLY`;
    const monthlyPriceId = process.env[monthlyKey];
    const yearlyPriceId = process.env[yearlyKey];

    if (priceId === monthlyPriceId || priceId === yearlyPriceId) {
      return plan.id;
    }
  }

  return null;
}

/**
 * Verificar e reportar dessincronização entre Stripe e banco de dados
 */
export async function checkSyncStatus(): Promise<{
  inSync: number;
  outOfSync: number;
  missing: number;
  details: Array<{
    subscriptionId: string;
    issue: string;
    dbStatus?: string;
    stripeStatus?: string;
    dbPlanId?: number;
    stripePriceId?: string;
  }>;
}> {
  console.log('🔍 Verificando status de sincronização...');

  const result = {
    inSync: 0,
    outOfSync: 0,
    missing: 0,
    details: [] as Array<{
      subscriptionId: string;
      issue: string;
      dbStatus?: string;
      stripeStatus?: string;
      dbPlanId?: number;
      stripePriceId?: string;
    }>,
  };

  try {
    // Buscar todas as assinaturas do banco
    const dbSubscriptions = await prisma.subscription.findMany({
      where: {
        stripeSubscriptionId: { not: null },
      },
      include: { plan: true },
    });

    console.log(
      `📊 Encontradas ${dbSubscriptions.length} assinaturas no banco`,
    );

    for (const dbSub of dbSubscriptions) {
      if (!dbSub.stripeSubscriptionId) continue;

      try {
        // Buscar assinatura no Stripe
        const stripeSub = await stripe.subscriptions.retrieve(
          dbSub.stripeSubscriptionId,
        );

        // Verificar se status está sincronizado
        if (stripeSub.status !== dbSub.status) {
          result.outOfSync++;
          result.details.push({
            subscriptionId: dbSub.stripeSubscriptionId,
            issue: 'status_mismatch',
            dbStatus: dbSub.status,
            stripeStatus: stripeSub.status,
          });
          continue;
        }

        // Verificar se planId está sincronizado
        const priceId = stripeSub.items.data[0]?.price.id;
        const expectedPlanId = await findPlanIdByPriceId(priceId);

        if (expectedPlanId && expectedPlanId !== dbSub.planId) {
          result.outOfSync++;
          result.details.push({
            subscriptionId: dbSub.stripeSubscriptionId,
            issue: 'plan_mismatch',
            dbPlanId: dbSub.planId,
            stripePriceId: priceId,
          });
          continue;
        }

        result.inSync++;
      } catch (error: unknown) {
        const stripeError = error as {
          type?: string;
          statusCode?: number;
          message?: string;
        };
        if (
          stripeError.type === 'StripeInvalidRequestError' &&
          stripeError.statusCode === 404
        ) {
          // Assinatura deletada no Stripe mas ainda no banco
          result.missing++;
          result.details.push({
            subscriptionId: dbSub.stripeSubscriptionId,
            issue: 'missing_in_stripe',
            dbStatus: dbSub.status,
          });
        } else {
          const errorMessage = stripeError.message || 'Unknown error';
          console.error(
            `❌ Erro ao verificar assinatura ${dbSub.stripeSubscriptionId}:`,
            errorMessage,
          );
        }
      }
    }

    console.log(
      `✅ Verificação concluída: ${result.inSync} sincronizadas, ${result.outOfSync} dessincronizadas, ${result.missing} faltando`,
    );
    return result;
  } catch (error: unknown) {
    console.error('❌ Erro ao verificar status de sincronização:', error);
    throw error;
  }
}
