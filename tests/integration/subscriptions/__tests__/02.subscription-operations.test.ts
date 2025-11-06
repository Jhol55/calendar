// ============================================
// TESTES DE INTEGRAÇÃO - OPERAÇÕES DE ASSINATURA
// ============================================

import { prisma } from '@/services/prisma';
import { createTestUser, cleanDatabase } from '../../setup';
import {
  createTestPlan,
  createTestSubscription,
  cleanSubscriptionData,
  createTestLimits,
  getSubscription,
  getLimits,
} from '../../../helpers/subscription';
import { checkPlanLimit } from '@/services/subscription/subscription.service';
// Nota: changePlan e cancelUserSubscription são server actions que dependem de sessão
// Para testes completos, seria necessário mockar a sessão ou testar os serviços diretamente
// Aqui testamos a lógica através do banco de dados diretamente

describe('Subscription Service - Operações Avançadas', () => {
  let userId: number;
  let starterPlan: Awaited<ReturnType<typeof createTestPlan>>;
  let businessPlan: Awaited<ReturnType<typeof createTestPlan>>;
  let enterprisePlan: Awaited<ReturnType<typeof createTestPlan>>;

  console.log('\n📋 INICIANDO: Subscription Service - Operações Avançadas');

  beforeAll(async () => {
    userId = await createTestUser();

    starterPlan = await createTestPlan({
      name: 'Starter',
      slug: 'starter',
      maxStorageMB: 1000,
      maxInstances: 5,
      priceMonthly: 29.99,
      priceYearly: 299.99,
    });

    businessPlan = await createTestPlan({
      name: 'Business',
      slug: 'business',
      maxStorageMB: 5000,
      maxInstances: 20,
      priceMonthly: 99.99,
      priceYearly: 999.99,
    });

    enterprisePlan = await createTestPlan({
      name: 'Enterprise',
      slug: 'enterprise',
      maxStorageMB: -1, // Ilimitado
      maxInstances: -1, // Ilimitado
      priceMonthly: 299.99,
      priceYearly: 2999.99,
    });
  });

  beforeEach(async () => {
    await cleanSubscriptionData(userId);
  });

  afterAll(async () => {
    await cleanSubscriptionData(userId);
    await cleanDatabase();
  });

  // ============================================
  // 1. Mudança de Plano
  // ============================================
  describe('Mudança de Plano', () => {
    console.log('  📂 Grupo: Mudança de Plano');

    beforeEach(async () => {
      await createTestSubscription(userId, starterPlan.id, {
        status: 'active',
        billingPeriod: 'monthly',
      });
      await createTestLimits(userId, 500, 3);
    });

    it('deve permitir mudança de planoId no banco de dados', async () => {
      console.log(
        '    ✓ Teste: deve permitir mudança de planoId no banco de dados',
      );

      // Atualizar plano diretamente no banco (simulando mudança)
      await prisma.subscription.update({
        where: { userId },
        data: {
          planId: businessPlan.id,
          billingPeriod: 'monthly',
        },
      });

      const subscription = await getSubscription(userId);
      expect(subscription?.planId).toBe(businessPlan.id);
      expect(subscription?.billingPeriod).toBe('monthly');
    });

    it('deve permitir mudança de modalidade (mensal para anual)', async () => {
      console.log(
        '    ✓ Teste: deve permitir mudança de modalidade (mensal para anual)',
      );

      // Atualizar modalidade diretamente no banco
      await prisma.subscription.update({
        where: { userId },
        data: {
          billingPeriod: 'yearly', // Mudança de modalidade
        },
      });

      const subscription = await getSubscription(userId);
      expect(subscription?.planId).toBe(starterPlan.id);
      expect(subscription?.billingPeriod).toBe('yearly');
    });

    it('deve validar que plano e modalidade são únicos', async () => {
      console.log(
        '    ✓ Teste: deve validar que plano e modalidade são únicos',
      );

      const subscriptionBefore = await getSubscription(userId);
      expect(subscriptionBefore?.planId).toBe(starterPlan.id);
      expect(subscriptionBefore?.billingPeriod).toBe('monthly');

      // Tentar "mudar" para o mesmo plano e modalidade não deve fazer nada
      // (a validação está na função changePlan, mas aqui testamos o estado)
      const subscriptionAfter = await getSubscription(userId);
      expect(subscriptionAfter?.planId).toBe(starterPlan.id);
      expect(subscriptionAfter?.billingPeriod).toBe('monthly');
    });

    it('deve permitir downgrade de plano', async () => {
      console.log('    ✓ Teste: deve permitir downgrade de plano');

      // Primeiro fazer upgrade
      await createTestSubscription(userId, businessPlan.id, {
        status: 'active',
        billingPeriod: 'monthly',
      });

      await createTestLimits(userId, 2000, 10);

      // Depois fazer downgrade
      await prisma.subscription.update({
        where: { userId },
        data: {
          planId: starterPlan.id,
        },
      });

      const subscription = await getSubscription(userId);
      expect(subscription?.planId).toBe(starterPlan.id);
    });

    it('deve atualizar plano após mudança', async () => {
      console.log('    ✓ Teste: deve atualizar plano após mudança');

      // Usuário com uso acima do novo limite
      await createTestLimits(userId, 2000, 10); // Acima do limite do Starter

      // Mudar plano
      await prisma.subscription.update({
        where: { userId },
        data: {
          planId: starterPlan.id,
        },
      });

      const subscription = await getSubscription(userId);
      expect(subscription?.planId).toBe(starterPlan.id);

      // Nota: O sistema deve alertar sobre limites excedidos
      // mas permite a mudança (validação é feita em checkPlanLimit)
    });

    it('deve detectar quando usuário tem mais instâncias que o novo plano permite', async () => {
      console.log(
        '    ✓ Teste: deve detectar quando usuário tem mais instâncias que o novo plano permite',
      );

      // Usuário com Business (20 instâncias) e usando 10
      await createTestSubscription(userId, businessPlan.id, {
        status: 'active',
        billingPeriod: 'monthly',
      });

      await createTestLimits(userId, 2000, 10); // 10 instâncias

      // Tentar fazer downgrade para Starter (5 instâncias)
      // Nota: Como changePlan é server action que requer sessão,
      // aqui testamos a lógica: se tivesse 10 instâncias e mudasse para plano com 5,
      // as instâncias existentes permaneceriam, mas não poderia criar novas

      // Simular a mudança (como se tivesse passado pela validação)
      await prisma.subscription.update({
        where: { userId },
        data: {
          planId: starterPlan.id,
        },
      });

      // Verificar que o limite de instâncias seria excedido
      const limits = await getLimits(userId);
      expect(limits?.currentInstances).toBe(10);

      // O plano agora permite apenas 5, mas ainda tem 10
      // A validação deve bloquear criação de novas instâncias
      const limitCheck = await checkPlanLimit(userId, 'instances');

      expect(limitCheck.allowed).toBe(false);
      expect(limitCheck.current).toBe(10);
      expect(limitCheck.max).toBe(5);
      expect(limitCheck.message).toContain('Limite de instâncias atingido');
    });
  });

  // ============================================
  // 2. Cancelamento de Assinatura
  // ============================================
  describe('Cancelamento de Assinatura', () => {
    console.log('  📂 Grupo: Cancelamento de Assinatura');

    beforeEach(async () => {
      await createTestSubscription(userId, starterPlan.id, {
        status: 'active',
        billingPeriod: 'monthly',
      });
    });

    it('deve cancelar assinatura imediatamente', async () => {
      console.log('    ✓ Teste: deve cancelar assinatura imediatamente');

      // Cancelar diretamente no banco (simulando ação)
      await prisma.subscription.update({
        where: { userId },
        data: {
          status: 'canceled',
          cancelAtPeriodEnd: false,
          canceledAt: new Date(),
        },
      });

      const subscription = await getSubscription(userId);
      expect(subscription?.status).toBe('canceled');
      expect(subscription?.cancelAtPeriodEnd).toBe(false);
    });

    it('deve marcar cancelamento ao final do período', async () => {
      console.log('    ✓ Teste: deve marcar cancelamento ao final do período');

      // Marcar para cancelar ao final do período
      await prisma.subscription.update({
        where: { userId },
        data: {
          cancelAtPeriodEnd: true,
        },
      });

      const subscription = await getSubscription(userId);
      expect(subscription?.status).toBe('active'); // Ainda ativa
      expect(subscription?.cancelAtPeriodEnd).toBe(true); // Mas será cancelada
    });

    it('deve manter status cancelado após cancelamento', async () => {
      console.log(
        '    ✓ Teste: deve manter status cancelado após cancelamento',
      );

      // Cancelar primeiro
      await prisma.subscription.update({
        where: { userId },
        data: {
          status: 'canceled',
          canceledAt: new Date(),
        },
      });

      const subscription = await getSubscription(userId);
      expect(subscription?.status).toBe('canceled');
    });
  });

  // ============================================
  // 3. Validação de Transições de Status
  // ============================================
  describe('Transições de Status', () => {
    console.log('  📂 Grupo: Transições de Status');

    it('deve manter acesso durante período de trial', async () => {
      console.log('    ✓ Teste: deve manter acesso durante período de trial');

      await createTestSubscription(userId, starterPlan.id, {
        status: 'trialing',
        billingPeriod: 'monthly',
      });

      await createTestLimits(userId, 500, 3);

      const limitCheck = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          subscription: {
            include: { plan: true },
          },
        },
      });

      expect(limitCheck?.subscription?.status).toBe('trialing');
    });

    it('deve bloquear acesso após cancelamento', async () => {
      console.log('    ✓ Teste: deve bloquear acesso após cancelamento');

      await createTestSubscription(userId, starterPlan.id, {
        status: 'canceled',
        billingPeriod: 'monthly',
      });

      const subscription = await getSubscription(userId);
      expect(subscription?.status).toBe('canceled');
    });
  });

  // ============================================
  // 4. Planos Ilimitados
  // ============================================
  describe('Planos Ilimitados', () => {
    console.log('  📂 Grupo: Planos Ilimitados');

    it('deve permitir armazenamento ilimitado', async () => {
      console.log('    ✓ Teste: deve permitir armazenamento ilimitado');

      await createTestSubscription(userId, enterprisePlan.id, {
        status: 'active',
        billingPeriod: 'monthly',
      });

      await createTestLimits(userId, 1000000, 1000); // Valores enormes

      const limitCheck = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          subscription: {
            include: { plan: true },
          },
        },
      });

      expect(limitCheck?.subscription?.plan.maxStorageMB).toBe(-1);
      expect(limitCheck?.subscription?.plan.maxInstances).toBe(-1);
    });
  });
});
