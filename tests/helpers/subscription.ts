// ============================================
// HELPER FUNCTIONS PARA TESTES DE ASSINATURAS
// ============================================

import { prisma } from '@/services/prisma';
import Stripe from 'stripe';

/**
 * Tipos para testes
 */
export interface TestPlan {
  id: number;
  name: string;
  slug: string;
  maxStorageMB: number;
  maxInstances: number;
  priceMonthly: number;
  priceYearly: number;
}

export interface TestSubscription {
  userId: number;
  planId: number;
  status: string;
  billingPeriod: 'monthly' | 'yearly';
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  currentPeriodStart?: Date | string | number;
  currentPeriodEnd?: Date | string | number;
}

/**
 * Cria um plano de teste no banco
 */
export async function createTestPlan(
  overrides?: Partial<TestPlan>,
): Promise<TestPlan> {
  // Garantir slug único usando timestamp + random (sempre, mesmo se overrides fornecer slug)
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const baseSlug = overrides?.slug || 'test-plan';
  const slug = `${baseSlug}-${uniqueId}`;

  const plan = await prisma.plan.create({
    data: {
      name: overrides?.name || `Test Plan ${uniqueId}`,
      slug,
      description: 'Plano de teste',
      maxStorageMB: overrides?.maxStorageMB || 1000,
      maxInstances: overrides?.maxInstances || 10,
      priceMonthly: overrides?.priceMonthly || 29.99,
      priceYearly: overrides?.priceYearly || 299.99,
      isActive: true,
    },
  });

  return {
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    maxStorageMB: plan.maxStorageMB,
    maxInstances: plan.maxInstances,
    priceMonthly: Number(plan.priceMonthly),
    priceYearly: Number(plan.priceYearly),
  };
}

/**
 * Cria uma assinatura de teste no banco
 */
export async function createTestSubscription(
  userId: number,
  planId: number,
  overrides?: Partial<TestSubscription>,
): Promise<TestSubscription> {
  const subscription = await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      planId,
      status: overrides?.status || 'active',
      billingPeriod: overrides?.billingPeriod || 'monthly',
      stripeSubscriptionId: overrides?.stripeSubscriptionId || null,
      stripeCustomerId: overrides?.stripeCustomerId || null,
      currentPeriodStart: overrides?.currentPeriodStart
        ? new Date(overrides.currentPeriodStart)
        : new Date(),
      currentPeriodEnd: overrides?.currentPeriodEnd
        ? new Date(overrides.currentPeriodEnd)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    update: {
      planId,
      status: overrides?.status || 'active',
      billingPeriod: overrides?.billingPeriod || 'monthly',
      stripeSubscriptionId: overrides?.stripeSubscriptionId || null,
      stripeCustomerId: overrides?.stripeCustomerId || null,
    },
  });

  return {
    userId: subscription.userId,
    planId: subscription.planId,
    status: subscription.status,
    billingPeriod: subscription.billingPeriod as 'monthly' | 'yearly',
    stripeSubscriptionId: subscription.stripeSubscriptionId || undefined,
    stripeCustomerId: subscription.stripeCustomerId || undefined,
  };
}

/**
 * Limpa dados de assinatura de um usuário
 */
export async function cleanSubscriptionData(userId: number): Promise<void> {
  await Promise.all([
    prisma.subscription.deleteMany({ where: { userId } }),
    prisma.user_plan_limits.deleteMany({ where: { userId } }),
  ]);
}

/**
 * Limpa planos de teste criados (opcional, útil para testes que criam muitos planos)
 */
export async function cleanTestPlans(
  slugPrefix: string = 'test-plan-',
): Promise<void> {
  // Limpar apenas planos de teste (que começam com o prefixo)
  await prisma.plan.deleteMany({
    where: {
      slug: {
        startsWith: slugPrefix,
      },
    },
  });
}

/**
 * Cria limites de uso para teste
 *
 * IMPORTANTE: currentStorageMB é salvo como centésimos (0.57MB = 57)
 * Para manter compatibilidade com testes antigos, esta função converte automaticamente.
 */
export async function createTestLimits(
  userId: number,
  currentStorageMB: number = 0,
  currentInstances: number = 0,
): Promise<void> {
  // Converter MB para centésimos (0.57MB = 57, 100MB = 10000)
  const storageMBAsCents = Math.round(currentStorageMB * 100);

  await prisma.user_plan_limits.upsert({
    where: { userId },
    create: {
      userId,
      currentStorageMB: storageMBAsCents,
      currentInstances,
    },
    update: {
      currentStorageMB: storageMBAsCents,
      currentInstances,
    },
  });
}

/**
 * Obtém assinatura do usuário
 */
export async function getSubscription(userId: number) {
  return await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });
}

/**
 * Obtém limites do usuário
 */
export async function getLimits(userId: number) {
  return await prisma.user_plan_limits.findUnique({
    where: { userId },
  });
}

/**
 * Simula evento webhook do Stripe
 */
export function createMockStripeEvent(type: string, data: any): Stripe.Event {
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2024-12-18.acacia',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: data,
      previous_attributes: {},
    },
    livemode: false,
    pending_webhooks: 0,
    request: {
      id: `req_test_${Date.now()}`,
      idempotency_key: null,
    },
    type: type as Stripe.Event.Type,
  } as Stripe.Event;
}

/**
 * Cria mock de checkout session do Stripe
 */
export function createMockCheckoutSession(
  customerId: string,
  subscriptionId: string,
  status: 'complete' | 'open' = 'complete',
): Stripe.Checkout.Session {
  return {
    id: `cs_test_${Date.now()}`,
    object: 'checkout.session',
    customer: customerId,
    subscription: subscriptionId,
    mode: 'subscription',
    status,
    payment_status: 'paid',
    customer_details: {
      email: 'test@example.com',
    },
  } as Stripe.Checkout.Session;
}

/**
 * Cria mock de subscription do Stripe
 */
export function createMockStripeSubscription(
  customerId: string,
  status: Stripe.Subscription.Status = 'active',
  priceId: string = 'price_test',
): any {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: `sub_test_${Date.now()}`,
    object: 'subscription',
    customer: customerId,
    status,
    items: {
      object: 'list',
      data: [
        {
          id: `si_test_${Date.now()}`,
          object: 'subscription_item',
          price: {
            id: priceId,
            object: 'price',
            active: true,
            currency: 'brl',
            unit_amount: 2999,
            recurring: {
              interval: 'month',
              interval_count: 1,
            },
          } as Stripe.Price,
          subscription: `sub_test_${Date.now()}`,
          quantity: 1,
        } as Stripe.SubscriptionItem,
      ],
      has_more: false,
      url: '',
    },
    current_period_start: now,
    current_period_end: now + 30 * 24 * 60 * 60,
    trial_end: null,
    cancel_at_period_end: false,
  };
}

/**
 * Aguarda um tempo específico
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
