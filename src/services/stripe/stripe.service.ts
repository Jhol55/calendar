import Stripe from 'stripe';
import { prisma } from '@/services/prisma';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined');
}

// Usar a versão mais recente suportada pela biblioteca
// O tipo esperado é '2025-10-29.clover', mas a API aceita '2024-12-18.acacia'
// Vamos usar type assertion para garantir compatibilidade
const STRIPE_API_VERSION = '2024-12-18.acacia' as Stripe.LatestApiVersion;
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: STRIPE_API_VERSION,
  typescript: true,
});

const TRIAL_DAYS = 7;

/**
 * Interface auxiliar para propriedades de período de assinatura do Stripe
 * Essas propriedades existem em runtime mas podem não estar nos tipos da biblioteca
 */
interface StripeSubscriptionWithPeriod extends Stripe.Subscription {
  current_period_start: number;
  current_period_end: number;
}

/**
 * Type guard para verificar se subscription tem as propriedades de período
 */
function hasPeriodProperties(
  subscription: Stripe.Subscription,
): subscription is StripeSubscriptionWithPeriod {
  return (
    'current_period_start' in subscription &&
    'current_period_end' in subscription &&
    typeof (subscription as StripeSubscriptionWithPeriod)
      .current_period_start === 'number' &&
    typeof (subscription as StripeSubscriptionWithPeriod).current_period_end ===
      'number'
  );
}

/**
 * Interface auxiliar para Invoice com subscription
 */
interface StripeInvoiceWithSubscription extends Stripe.Invoice {
  subscription: string | Stripe.Subscription | null;
}

/**
 * Função auxiliar para converter timestamp Unix para Date de forma segura
 */
function safeUnixToDate(timestamp: number | null | undefined): Date | null {
  if (
    timestamp &&
    typeof timestamp === 'number' &&
    !isNaN(timestamp) &&
    timestamp > 0
  ) {
    return new Date(timestamp * 1000);
  }
  return null;
}

export interface CreateCustomerParams {
  email: string;
  name?: string;
}

export interface CreateSubscriptionParams {
  customerId: string;
  priceId: string;
  trialDays?: number;
  metadata?: Record<string, string>;
}

/**
 * Criar ou buscar customer no Stripe
 */
export async function createOrGetCustomer({
  email,
  name,
}: CreateCustomerParams): Promise<Stripe.Customer> {
  // Verificar se já existe customer no banco
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (user) {
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
      select: { stripeCustomerId: true },
    });

    if (existingSubscription?.stripeCustomerId) {
      try {
        return (await stripe.customers.retrieve(
          existingSubscription.stripeCustomerId,
        )) as Stripe.Customer;
      } catch (error) {
        // Customer não existe no Stripe, criar novo
      }
    }
  }

  // Criar novo customer
  return await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: {
      userId: user?.id.toString() || '',
    },
  });
}

/**
 * Criar subscription no Stripe
 */
export async function createSubscription({
  customerId,
  priceId,
  trialDays = TRIAL_DAYS,
  metadata,
}: CreateSubscriptionParams): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    trial_period_days: trialDays,
    metadata: metadata || {},
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
  });
}

/**
 * Atualizar subscription (trocar plano)
 */
export async function updateSubscription(
  subscriptionId: string,
  newPriceId: string,
): Promise<Stripe.Subscription> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  return await stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: subscription.items.data[0].id,
        price: newPriceId,
      },
    ],
    proration_behavior: 'always_invoice',
  });
}

/**
 * Fazer upgrade/downgrade de plano
 */
export async function changeSubscriptionPlan(
  subscriptionId: string,
  newPriceId: string,
  applyImmediately: boolean = true,
): Promise<Stripe.Subscription> {
  // Buscar subscription atual
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  if (applyImmediately) {
    // Trocar imediatamente: atualizar o item da subscription
    const subscriptionItemId = subscription.items.data[0]?.id;

    if (!subscriptionItemId) {
      throw new Error('Subscription item not found');
    }

    // Atualizar subscription com proration e tentar cobrar imediatamente
    const updatedSubscription = await stripe.subscriptions.update(
      subscriptionId,
      {
        items: [
          {
            id: subscriptionItemId,
            price: newPriceId,
          },
        ],
        proration_behavior: 'always_invoice', // Criar proration imediata
      },
    );

    return updatedSubscription;
  } else {
    // Agendar para o final do período
    const subscriptionItemId = subscription.items.data[0]?.id;

    if (!subscriptionItemId) {
      throw new Error('Subscription item not found');
    }

    return await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscriptionItemId,
          price: newPriceId,
        },
      ],
      billing_cycle_anchor: 'unchanged', // Manter a data de cobrança
      proration_behavior: 'none', // Sem proration, aplicar no próximo ciclo
    });
  }
}

/**
 * Cancelar subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd = true,
): Promise<Stripe.Subscription> {
  if (cancelAtPeriodEnd) {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  } else {
    return await stripe.subscriptions.cancel(subscriptionId);
  }
}

/**
 * Buscar subscription no Stripe
 */
export async function getSubscription(
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['customer', 'latest_invoice'],
  });
}

/**
 * Criar sessão de checkout
 */
export async function createCheckoutSession({
  customerId,
  priceId,
  userId,
  planId,
  successUrl,
  cancelUrl,
  hasUsedTrial = false,
}: {
  customerId: string;
  priceId: string;
  userId: number;
  planId: number;
  successUrl: string;
  cancelUrl: string;
  hasUsedTrial?: boolean;
}): Promise<Stripe.Checkout.Session> {
  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData =
    {
      metadata: {
        userId: userId.toString(),
        planId: planId.toString(),
      },
    };

  // Só adicionar trial se o usuário NUNCA usou trial antes
  if (!hasUsedTrial) {
    subscriptionData.trial_period_days = TRIAL_DAYS;
  }

  return await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    subscription_data: subscriptionData,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId: userId.toString(),
      planId: planId.toString(),
    },
  });
}

/**
 * Criar sessão do Customer Portal
 */
export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  return await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

/**
 * Processar webhook do Stripe
 */
export async function handleWebhook(
  event: Stripe.Event,
): Promise<{ success: boolean; message?: string }> {
  try {
    console.log(`🎯 Processando webhook: ${event.type}`);
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('✅ Evento checkout.session.completed detectado');
        await handleCheckoutCompleted(session);
        console.log('✅ handleCheckoutCompleted concluído');
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('✅ Evento customer.subscription.updated detectado');
        await handleSubscriptionUpdated(subscription);
        console.log('✅ handleSubscriptionUpdated concluído');
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('✅ Evento customer.subscription.deleted detectado');
        await handleSubscriptionDeleted(subscription);
        console.log('✅ handleSubscriptionDeleted concluído');
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    console.log(`✅ Webhook ${event.type} processado com sucesso`);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Erro ao processar webhook:', {
      eventType: event.type,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    return { success: false, message: error.message };
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('🔄 Processando checkout.session.completed:', {
    sessionId: session.id,
    subscriptionId: session.subscription,
    customerId: session.customer,
    metadata: session.metadata,
  });

  const userId = parseInt(session.metadata?.userId || '0');
  const planId = parseInt(session.metadata?.planId || '0');

  console.log('📋 Dados extraídos:', { userId, planId });

  if (!userId || !planId) {
    const error = 'Missing userId or planId in checkout session metadata';
    console.error('❌ Erro:', error, { metadata: session.metadata });
    throw new Error(error);
  }

  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  if (!subscriptionId || !customerId) {
    const error = 'Missing subscriptionId or customerId';
    console.error('❌ Erro:', error, { subscriptionId, customerId });
    throw new Error(error);
  }

  // Buscar subscription do Stripe para obter detalhes
  console.log('🔍 Buscando subscription do Stripe:', subscriptionId);
  const stripeSubscription =
    await stripe.subscriptions.retrieve(subscriptionId);

  console.log('📊 Dados da subscription do Stripe:', {
    status: stripeSubscription.status,
    billingInterval:
      stripeSubscription.items.data[0]?.price.recurring?.interval,
    trialEnd: stripeSubscription.trial_end,
    current_period_start: hasPeriodProperties(stripeSubscription)
      ? stripeSubscription.current_period_start
      : undefined,
    current_period_end: hasPeriodProperties(stripeSubscription)
      ? stripeSubscription.current_period_end
      : undefined,
  });

  // Função auxiliar para converter timestamp Unix para Date de forma segura
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

  // Converter timestamps de forma segura
  const currentPeriodStart = hasPeriodProperties(stripeSubscription)
    ? safeUnixToDate(stripeSubscription.current_period_start)
    : null;
  const currentPeriodEnd = hasPeriodProperties(stripeSubscription)
    ? safeUnixToDate(stripeSubscription.current_period_end)
    : null;
  const trialEndsAt = safeUnixToDate(stripeSubscription.trial_end ?? null);

  console.log('📅 Datas convertidas (checkout):', {
    currentPeriodStart,
    currentPeriodEnd,
    trialEndsAt,
  });

  // Verificar se usuário já tem subscription (pode ser trial)
  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      id: true,
      status: true,
      stripeSubscriptionId: true,
      planId: true,
    },
  });

  const oldPlanId = existingSubscription?.planId || null;

  // Se já tem subscription (especialmente trial), cancelar antes de criar a nova
  if (existingSubscription && existingSubscription.status === 'trialing') {
    console.log(
      '🔄 Cancelando subscription de trial para iniciar plano pago...',
    );

    // Se tiver stripeSubscriptionId, tentar cancelar no Stripe
    // Mas verificar primeiro se realmente existe no Stripe
    if (existingSubscription.stripeSubscriptionId) {
      try {
        // Verificar se a subscription existe no Stripe antes de cancelar
        try {
          await stripe.subscriptions.retrieve(
            existingSubscription.stripeSubscriptionId,
          );
          // Se chegou aqui, a subscription existe, então pode cancelar
          await stripe.subscriptions.cancel(
            existingSubscription.stripeSubscriptionId,
          );
          console.log('✅ Trial subscription cancelado no Stripe');
        } catch (retrieveError: any) {
          // Se não encontrar no Stripe, significa que foi criada apenas no banco
          if (retrieveError?.code === 'resource_missing') {
            console.log(
              'ℹ️ Trial subscription não existe no Stripe (criada apenas no banco)',
            );
          } else {
            throw retrieveError;
          }
        }
      } catch (error) {
        console.warn('⚠️ Não foi possível cancelar trial no Stripe:', error);
        // Continua mesmo se falhar no Stripe, pois pode não existir lá
      }
    } else {
      console.log(
        'ℹ️ Trial subscription sem stripeSubscriptionId (criada apenas no banco)',
      );
    }

    // Sempre cancelar no banco, independente do Stripe
    await prisma.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        status: 'canceled',
        canceledAt: new Date(),
      },
    });
    console.log('✅ Trial subscription cancelado no banco');
  }

  // Criar ou atualizar subscription no banco
  console.log('💾 Criando/atualizando subscription no banco...');

  // Se for um plano pago (status active), não deve ter trialEndsAt
  // Também considerar se trial_end é null no Stripe
  const finalTrialEndsAt =
    stripeSubscription.status === 'active' || !stripeSubscription.trial_end
      ? null
      : trialEndsAt;

  console.log('🔍 Definindo trialEndsAt:', {
    stripeStatus: stripeSubscription.status,
    stripeTrialEnd: stripeSubscription.trial_end,
    finalTrialEndsAt,
  });

  const subscriptionRecord = await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      planId,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      status: stripeSubscription.status,
      billingPeriod:
        stripeSubscription.items.data[0]?.price.recurring?.interval === 'year'
          ? 'yearly'
          : 'monthly',
      trialEndsAt: finalTrialEndsAt,
      currentPeriodStart,
      currentPeriodEnd,
      canceledAt: null,
      cancelAtPeriodEnd: false,
    },
    update: {
      planId, // ATUALIZAR O PLANID NO UPDATE!
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      status: stripeSubscription.status,
      billingPeriod:
        stripeSubscription.items.data[0]?.price.recurring?.interval === 'year'
          ? 'yearly'
          : 'monthly',
      trialEndsAt: finalTrialEndsAt,
      currentPeriodStart,
      currentPeriodEnd,
      canceledAt: null, // Remover cancelamento se havia um
      cancelAtPeriodEnd: false,
    },
  });

  console.log('✅ Subscription criada/atualizada no banco:', {
    id: subscriptionRecord.id,
    userId: subscriptionRecord.userId,
    planId: subscriptionRecord.planId,
    status: subscriptionRecord.status,
    isUpdate: existingSubscription !== null,
    oldPlanId: oldPlanId,
    newPlanId: planId,
  });

  // Buscar email do usuário para atualizar sessão
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  // Atualizar plano do usuário
  await prisma.user.update({
    where: { id: userId },
    data: { planId },
  });

  // Atualizar sessão com hasPlan: true
  try {
    const { updateSessionWithPlanStatus } = await import(
      '@/utils/security/session'
    );
    await updateSessionWithPlanStatus(user.email, undefined, true);
  } catch (error) {
    console.warn('Could not update session:', error);
  }

  // Calcular uso atual (armazenamento e instâncias) para preservar dados existentes
  console.log('📊 Calculando uso atual do usuário...');
  const { getStorageUsage, getInstanceCount } = await import(
    '@/services/subscription/subscription.service'
  );

  const currentStorageMB = await getStorageUsage(userId);
  const currentInstances = await getInstanceCount(userId);

  console.log('📈 Uso atual calculado:', {
    currentStorageMB,
    currentInstances,
  });

  // Criar ou atualizar limites com valores reais (não zerar!)
  await prisma.user_plan_limits.upsert({
    where: { userId },
    create: {
      userId,
      currentStorageMB,
      currentInstances,
    },
    update: {
      currentStorageMB,
      currentInstances,
    },
  });

  console.log('✅ Limites atualizados com uso real');

  console.log('✅ Checkout processado com sucesso:', {
    userId,
    planId,
    subscriptionId,
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('🔄 Processando customer.subscription.updated:', {
    subscriptionId: subscription.id,
    status: subscription.status,
    customerId: subscription.customer,
  });

  const subscriptionRecord = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    include: {
      user: {
        select: { email: true },
      },
    },
  });

  if (!subscriptionRecord) {
    console.warn(
      '⚠️ Subscription não encontrada no banco para stripeSubscriptionId:',
      subscription.id,
    );
    console.log(
      '💡 Isso pode acontecer se o evento customer.subscription.updated foi recebido antes do checkout.session.completed',
    );
    return;
  }

  console.log('📊 Atualizando subscription no banco:', {
    subscriptionRecordId: subscriptionRecord.id,
    userId: subscriptionRecord.userId,
    oldStatus: subscriptionRecord.status,
    newStatus: subscription.status,
  });

  // Converter timestamps Unix para Date (multiplicar por 1000 para milissegundos)
  // Validar que os valores são números válidos antes de converter
  const currentPeriodStart = hasPeriodProperties(subscription)
    ? safeUnixToDate(subscription.current_period_start)
    : null;

  const currentPeriodEnd = hasPeriodProperties(subscription)
    ? safeUnixToDate(subscription.current_period_end)
    : null;

  const trialEndsAt =
    subscription.trial_end &&
    typeof subscription.trial_end === 'number' &&
    !isNaN(subscription.trial_end)
      ? new Date(subscription.trial_end * 1000)
      : null;

  const canceledAt =
    subscription.cancel_at &&
    typeof subscription.cancel_at === 'number' &&
    !isNaN(subscription.cancel_at)
      ? new Date(subscription.cancel_at * 1000)
      : null;

  console.log('📅 Datas convertidas:', {
    currentPeriodStart,
    currentPeriodEnd,
    trialEndsAt,
    canceledAt,
    raw: {
      current_period_start: hasPeriodProperties(subscription)
        ? subscription.current_period_start
        : null,
      current_period_end: hasPeriodProperties(subscription)
        ? subscription.current_period_end
        : null,
      trial_end: subscription.trial_end ?? null,
      cancel_at: subscription.cancel_at ?? null,
    },
  });

  // Buscar o priceId atual da subscription para identificar o plano
  const currentPriceId = subscription.items.data[0]?.price?.id;

  // Se o priceId mudou, precisamos atualizar o planId
  // Buscar todos os planos e seus price IDs para fazer match
  if (currentPriceId) {
    const allPlans = await prisma.plan.findMany({
      where: { isActive: true },
    });

    let newPlanId: number | null = null;

    // Buscar planId correspondente ao priceId atual
    for (const plan of allPlans) {
      const monthlyPriceKey = `STRIPE_PRICE_${plan.slug.toUpperCase()}_MONTHLY`;
      const yearlyPriceKey = `STRIPE_PRICE_${plan.slug.toUpperCase()}_YEARLY`;
      const monthlyPriceId = process.env[monthlyPriceKey];
      const yearlyPriceId = process.env[yearlyPriceKey];

      if (
        currentPriceId === monthlyPriceId ||
        currentPriceId === yearlyPriceId
      ) {
        newPlanId = plan.id;
        const newBillingPeriod =
          currentPriceId === monthlyPriceId ? 'monthly' : 'yearly';

        console.log('🔄 Plano mudou no Stripe:', {
          oldPlanId: subscriptionRecord.planId,
          newPlanId: plan.id,
          planName: plan.name,
          billingPeriod: newBillingPeriod,
          priceId: currentPriceId,
        });

        // Atualizar planId e billingPeriod se mudou
        const updateData: any = {
          planId: newPlanId,
          billingPeriod: newBillingPeriod,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        };

        // Só adicionar campos de data se não forem null (não sobrescrever dados existentes)
        if (trialEndsAt !== null) updateData.trialEndsAt = trialEndsAt;
        if (currentPeriodStart !== null)
          updateData.currentPeriodStart = currentPeriodStart;
        if (currentPeriodEnd !== null)
          updateData.currentPeriodEnd = currentPeriodEnd;
        if (canceledAt !== null) updateData.canceledAt = canceledAt;

        await prisma.subscription.update({
          where: { id: subscriptionRecord.id },
          data: updateData,
        });

        // Atualizar plano do usuário
        await prisma.user.update({
          where: { id: subscriptionRecord.userId },
          data: { planId: newPlanId },
        });

        console.log('✅ PlanId atualizado no banco:', {
          userId: subscriptionRecord.userId,
          newPlanId,
        });

        break;
      }
    }

    // Se não encontrou correspondência, apenas atualizar os outros campos
    if (newPlanId === null) {
      const updateData: any = {
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      };

      // Só adicionar campos de data se não forem null (não sobrescrever dados existentes)
      if (trialEndsAt !== null) updateData.trialEndsAt = trialEndsAt;
      if (currentPeriodStart !== null)
        updateData.currentPeriodStart = currentPeriodStart;
      if (currentPeriodEnd !== null)
        updateData.currentPeriodEnd = currentPeriodEnd;
      if (canceledAt !== null) updateData.canceledAt = canceledAt;

      await prisma.subscription.update({
        where: { id: subscriptionRecord.id },
        data: updateData,
      });
    }
  } else {
    // Se não há priceId, apenas atualizar outros campos
    const updateData: any = {
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };

    // Só adicionar campos de data se não forem null (não sobrescrever dados existentes)
    if (trialEndsAt !== null) updateData.trialEndsAt = trialEndsAt;
    if (currentPeriodStart !== null)
      updateData.currentPeriodStart = currentPeriodStart;
    if (currentPeriodEnd !== null)
      updateData.currentPeriodEnd = currentPeriodEnd;
    if (canceledAt !== null) updateData.canceledAt = canceledAt;

    await prisma.subscription.update({
      where: { id: subscriptionRecord.id },
      data: updateData,
    });
  }

  // Atualizar sessão se necessário
  if (subscriptionRecord.user?.email) {
    try {
      const { updateSessionWithPlanStatus } = await import(
        '@/utils/security/session'
      );
      // Calcular hasPlan baseado no status
      const hasPlan =
        subscription.status === 'active' ||
        subscription.status === 'trialing' ||
        (subscription.status === 'past_due' &&
          !subscription.cancel_at_period_end);
      await updateSessionWithPlanStatus(
        subscriptionRecord.user.email,
        undefined,
        hasPlan,
      );
      console.log('✅ Sessão atualizada:', {
        email: subscriptionRecord.user.email,
        hasPlan,
      });
    } catch (error) {
      console.warn('⚠️ Could not update session:', error);
    }
  }

  console.log('✅ Subscription atualizada com sucesso');
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('🔄 Processando customer.subscription.deleted:', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
  });

  const subscriptionRecord = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    include: {
      user: {
        select: { email: true },
      },
    },
  });

  if (!subscriptionRecord) {
    console.warn(
      '⚠️ Subscription não encontrada no banco para stripeSubscriptionId:',
      subscription.id,
    );
    return;
  }

  console.log('📊 Deletando/cancelando subscription:', {
    subscriptionRecordId: subscriptionRecord.id,
    userId: subscriptionRecord.userId,
  });

  await prisma.subscription.update({
    where: { id: subscriptionRecord.id },
    data: {
      status: 'canceled',
      canceledAt: new Date(),
    },
  });

  // Resetar plano do usuário para null
  await prisma.user.update({
    where: { id: subscriptionRecord.userId },
    data: { planId: null },
  });

  // IMPORTANTE: Atualizar sessão com hasPlan: false
  if (subscriptionRecord.user?.email) {
    try {
      const { updateSessionWithPlanStatus } = await import(
        '@/utils/security/session'
      );
      await updateSessionWithPlanStatus(
        subscriptionRecord.user.email,
        undefined,
        false, // Sem plano após deletar subscription
      );
      console.log('✅ Sessão atualizada: hasPlan = false', {
        email: subscriptionRecord.user.email,
      });
    } catch (error) {
      console.warn('⚠️ Could not update session:', error);
    }
  }

  console.log('✅ Subscription deletada/cancelada com sucesso');
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const invoiceWithSubscription = invoice as StripeInvoiceWithSubscription;
  const subscriptionId =
    typeof invoiceWithSubscription.subscription === 'string'
      ? invoiceWithSubscription.subscription
      : (invoiceWithSubscription.subscription?.id ?? null);

  if (!subscriptionId) {
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await handleSubscriptionUpdated(subscription);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const invoiceWithSubscription = invoice as StripeInvoiceWithSubscription;
  const subscriptionId =
    typeof invoiceWithSubscription.subscription === 'string'
      ? invoiceWithSubscription.subscription
      : (invoiceWithSubscription.subscription?.id ?? null);

  if (!subscriptionId) {
    return;
  }

  const subscriptionRecord = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (!subscriptionRecord) {
    return;
  }

  await prisma.subscription.update({
    where: { id: subscriptionRecord.id },
    data: {
      status: 'past_due',
    },
  });
}
