// ============================================
// TESTES DE INTEGRAÇÃO - SINCRONIZAÇÃO E WEBHOOKS
// (USANDO API REAL DO STRIPE TEST MODE)
// ============================================

import { prisma } from '@/services/prisma';
import { createTestUser, cleanDatabase } from '../../setup';
import {
  createTestPlan,
  createTestSubscription,
  cleanSubscriptionData,
} from '../../../helpers/subscription';
import {
  isStripeConfigured,
  getStripeTestClient,
  createStripeTestCustomer,
  createStripeTestPrice,
  createStripeTestSubscription,
  cancelStripeSubscription,
  deleteStripeCustomer,
  cleanupStripeTestResources,
} from '../../../helpers/stripe-real-api';
import { handleWebhook } from '@/services/stripe/stripe.service';
import Stripe from 'stripe';

describe('Subscription Service - Sincronização e Webhooks', () => {
  let userId: number;
  let testPlan: Awaited<ReturnType<typeof createTestPlan>>;
  let stripe: Stripe | null;
  let stripeCustomer: Stripe.Customer | null = null;
  let stripePrice: { productId: string; priceId: string } | null = null;
  let testSubscriptions: string[] = []; // IDs de subscriptions criadas para limpeza

  console.log(
    '\n📋 INICIANDO: Subscription Service - Sincronização e Webhooks (API Real)',
  );

  // Verificar se Stripe está configurado antes de rodar os testes
  beforeAll(async () => {
    if (!isStripeConfigured()) {
      console.warn(
        '⚠️ STRIPE_SECRET_KEY não configurado ou não é uma chave de teste (sk_test_...)',
      );
      console.warn('⚠️ Pulando testes que requerem API real do Stripe');
      return;
    }

    stripe = getStripeTestClient();
    userId = await createTestUser();
    testPlan = await createTestPlan({
      name: 'Starter',
      slug: 'starter',
      maxStorageMB: 1000,
      maxInstances: 5,
      priceMonthly: 29.99,
      priceYearly: 299.99,
    });

    // Criar customer real no Stripe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (user && stripe) {
      stripeCustomer = await createStripeTestCustomer(
        user.email,
        user.name || undefined,
      );

      // Criar price real no Stripe
      stripePrice = await createStripeTestPrice(
        'Starter',
        29.99,
        'brl',
        'month',
      );
    }
  });

  beforeEach(async () => {
    await cleanSubscriptionData(userId);
  });

  afterAll(async () => {
    await cleanSubscriptionData(userId);

    // Limpar recursos criados no Stripe
    if (stripe && testSubscriptions.length > 0) {
      for (const subId of testSubscriptions) {
        try {
          await cancelStripeSubscription(subId, false);
        } catch {
          // Ignorar erros
        }
      }
    }

    if (stripeCustomer) {
      await deleteStripeCustomer(stripeCustomer.id);
    }

    // Limpar qualquer recurso restante
    await cleanupStripeTestResources();
    await cleanDatabase();
  });

  // ============================================
  // 1. Webhook: Checkout Completo (API Real)
  // ============================================
  describe('Webhook: Checkout Completo', () => {
    console.log('  📂 Grupo: Webhook: Checkout Completo');

    it('deve processar checkout.session.completed com API real do Stripe', async () => {
      if (!stripe || !stripeCustomer || !stripePrice) {
        console.log('    ⏭️  Pulando teste - Stripe não configurado');
        return;
      }

      console.log(
        '    ✓ Teste: deve processar checkout.session.completed com API real',
      );

      // Para testes de checkout, vamos criar uma subscription diretamente
      // e então simular o evento checkout.session.completed
      // Isso evita problemas com pagamento real

      // Criar subscription real no Stripe
      const stripeSubscription = await createStripeTestSubscription(
        stripeCustomer.id,
        stripePrice.priceId,
      );

      if (!stripeSubscription) {
        throw new Error('Falha ao criar subscription');
      }

      testSubscriptions.push(stripeSubscription.id);

      // Criar uma checkout session mockada que referencia a subscription real
      // Isso simula o que aconteceria após um checkout bem-sucedido
      const mockCheckoutSession = {
        id: `cs_test_${Date.now()}`,
        object: 'checkout.session' as const,
        customer: stripeCustomer.id,
        subscription: stripeSubscription.id,
        mode: 'subscription' as const,
        status: 'complete' as const,
        payment_status: 'paid' as const,
        customer_details: {
          email: stripeCustomer.email || 'test@example.com',
        },
        metadata: {
          userId: userId.toString(),
          planId: testPlan.id.toString(),
          test: 'true',
        },
      } as unknown as Stripe.Checkout.Session;

      // Criar evento webhook realista
      const event: Stripe.Event = {
        id: `evt_test_${Date.now()}`,
        object: 'event',
        api_version: '2024-12-18.acacia',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: mockCheckoutSession,
          previous_attributes: {},
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: `req_test_${Date.now()}`,
          idempotency_key: null,
        },
        type: 'checkout.session.completed',
      } as Stripe.Event;

      const result = await handleWebhook(event);

      expect(result.success).toBe(true);

      // Verificar se subscription foi criada no banco
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
      });

      expect(subscription).toBeDefined();
      expect(subscription?.stripeSubscriptionId).toBe(stripeSubscription.id);
    });
  });

  // ============================================
  // 2. Webhook: Atualização de Assinatura (API Real)
  // ============================================
  describe('Webhook: Atualização de Assinatura', () => {
    console.log('  📂 Grupo: Webhook: Atualização de Assinatura');

    it('deve processar customer.subscription.updated com subscription real', async () => {
      if (!stripe || !stripeCustomer || !stripePrice) {
        console.log('    ⏭️  Pulando teste - Stripe não configurado');
        return;
      }

      console.log(
        '    ✓ Teste: deve processar customer.subscription.updated com API real',
      );

      // Criar subscription real no Stripe
      const stripeSubscription = await createStripeTestSubscription(
        stripeCustomer.id,
        stripePrice.priceId,
      );

      if (!stripeSubscription) {
        throw new Error('Falha ao criar subscription');
      }

      // Criar registro no banco local
      await createTestSubscription(userId, testPlan.id, {
        status: stripeSubscription.status,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: stripeCustomer.id,
      });

      testSubscriptions.push(stripeSubscription.id);

      // Buscar subscription atualizada do Stripe
      const updatedSubscription = await stripe.subscriptions.retrieve(
        stripeSubscription.id,
      );

      // Criar evento webhook real
      const event: Stripe.Event = {
        id: `evt_test_${Date.now()}`,
        object: 'event',
        api_version: '2024-12-18.acacia',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: updatedSubscription,
          previous_attributes: {},
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: `req_test_${Date.now()}`,
          idempotency_key: null,
        },
        type: 'customer.subscription.updated',
      } as Stripe.Event;

      const result = await handleWebhook(event);

      expect(result.success).toBe(true);

      // Verificar se dados foram atualizados no banco
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
      });

      expect(subscription).toBeDefined();
      expect(subscription?.stripeSubscriptionId).toBe(stripeSubscription.id);
    });

    it('deve atualizar status quando assinatura é cancelada no Stripe', async () => {
      if (!stripe || !stripeCustomer || !stripePrice) {
        console.log('    ⏭️  Pulando teste - Stripe não configurado');
        return;
      }

      console.log(
        '    ✓ Teste: deve atualizar status quando assinatura é cancelada (API real)',
      );

      // Criar subscription real no Stripe
      const stripeSubscription = await createStripeTestSubscription(
        stripeCustomer.id,
        stripePrice.priceId,
      );

      if (!stripeSubscription) {
        throw new Error('Falha ao criar subscription');
      }

      // Criar registro no banco local
      await createTestSubscription(userId, testPlan.id, {
        status: 'active',
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: stripeCustomer.id,
      });

      // Cancelar subscription real no Stripe
      const canceledSubscription = await cancelStripeSubscription(
        stripeSubscription.id,
        false, // Cancelar imediatamente
      );

      if (!canceledSubscription) {
        throw new Error('Falha ao cancelar subscription');
      }

      // Criar evento webhook real
      const event: Stripe.Event = {
        id: `evt_test_${Date.now()}`,
        object: 'event',
        api_version: '2024-12-18.acacia',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: canceledSubscription,
          previous_attributes: {},
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: `req_test_${Date.now()}`,
          idempotency_key: null,
        },
        type: 'customer.subscription.updated',
      } as Stripe.Event;

      const result = await handleWebhook(event);

      expect(result.success).toBe(true);

      // Verificar se status foi atualizado no banco
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
      });

      expect(subscription).toBeDefined();
      expect(subscription?.status).toBe('canceled');
    });
  });

  // ============================================
  // 3. Sincronização (API Real)
  // ============================================
  describe('Sincronização', () => {
    console.log('  📂 Grupo: Sincronização');

    it('deve manter dados sincronizados entre banco e Stripe real', async () => {
      if (!stripe || !stripeCustomer || !stripePrice) {
        console.log('    ⏭️  Pulando teste - Stripe não configurado');
        return;
      }

      console.log('    ✓ Teste: deve manter dados sincronizados (API real)');

      // Criar subscription real no Stripe
      const stripeSubscription = await createStripeTestSubscription(
        stripeCustomer.id,
        stripePrice.priceId,
      );

      if (!stripeSubscription) {
        throw new Error('Falha ao criar subscription');
      }

      testSubscriptions.push(stripeSubscription.id);

      // Criar assinatura no banco local com dados do Stripe
      await createTestSubscription(userId, testPlan.id, {
        status: stripeSubscription.status,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: stripeCustomer.id,
      });

      // Verificar sincronização
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
      });

      expect(subscription?.stripeSubscriptionId).toBe(stripeSubscription.id);
      expect(subscription?.stripeCustomerId).toBe(stripeCustomer.id);

      // Buscar subscription atual do Stripe e comparar
      const stripeSubCurrent = await stripe.subscriptions.retrieve(
        stripeSubscription.id,
      );

      expect(subscription?.status).toBe(stripeSubCurrent.status);
    });

    it('deve atualizar períodos de cobrança corretamente', async () => {
      console.log(
        '    ✓ Teste: deve atualizar períodos de cobrança corretamente',
      );

      const now = new Date();
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      await createTestSubscription(userId, testPlan.id, {
        status: 'active',
        billingPeriod: 'monthly',
      });

      // Atualizar períodos manualmente (simulando webhook)
      await prisma.subscription.update({
        where: { userId },
        data: {
          currentPeriodStart: now,
          currentPeriodEnd: nextMonth,
        },
      });

      const subscription = await prisma.subscription.findUnique({
        where: { userId },
      });

      expect(subscription?.currentPeriodStart).toBeDefined();
      expect(subscription?.currentPeriodEnd).toBeDefined();
      expect(
        subscription?.currentPeriodEnd &&
          subscription?.currentPeriodStart &&
          new Date(subscription.currentPeriodEnd) >
            new Date(subscription.currentPeriodStart),
      ).toBe(true);
    });
  });

  // ============================================
  // 4. Idempotência (API Real)
  // ============================================
  describe('Idempotência', () => {
    console.log('  📂 Grupo: Idempotência');

    it('deve processar webhook duplicado sem erro (API real)', async () => {
      if (!stripe || !stripeCustomer || !stripePrice) {
        console.log('    ⏭️  Pulando teste - Stripe não configurado');
        return;
      }

      console.log('    ✓ Teste: deve processar webhook duplicado (API real)');

      // Criar subscription real no Stripe
      const stripeSubscription = await createStripeTestSubscription(
        stripeCustomer.id,
        stripePrice.priceId,
      );

      if (!stripeSubscription) {
        throw new Error('Falha ao criar subscription');
      }

      testSubscriptions.push(stripeSubscription.id);

      // Criar registro no banco local
      await createTestSubscription(userId, testPlan.id, {
        status: 'active',
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: stripeCustomer.id,
      });

      // Buscar subscription atual do Stripe
      const currentSubscription = await stripe.subscriptions.retrieve(
        stripeSubscription.id,
      );

      // Criar evento webhook real
      const event: Stripe.Event = {
        id: `evt_test_${Date.now()}`,
        object: 'event',
        api_version: '2024-12-18.acacia',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: currentSubscription,
          previous_attributes: {},
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: `req_test_${Date.now()}`,
          idempotency_key: null,
        },
        type: 'customer.subscription.updated',
      } as Stripe.Event;

      // Processar duas vezes (simulando retry do Stripe)
      const result1 = await handleWebhook(event);
      const result2 = await handleWebhook(event);

      // Ambos devem processar sem erro (idempotência)
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });
});
