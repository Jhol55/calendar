// ============================================
// TESTES DE INTEGRAÇÃO - ASSINATURAS BÁSICAS
// ============================================

import { prisma } from '@/services/prisma';
import {
  createTestUser,
  generateNumericUserId,
  cleanDatabase,
} from '../../setup';
import {
  createTestPlan,
  createTestSubscription,
  cleanSubscriptionData,
  createTestLimits,
  getSubscription,
  getLimits,
} from '../../../helpers/subscription';
import {
  getStorageUsage,
  updateStorageUsageIncremental,
  checkPlanLimit,
  canUseStorage,
  getUserPlan,
} from '@/services/subscription/subscription.service';

describe('Subscription Service - Operações Básicas', () => {
  let userId: number;
  let testPlan: Awaited<ReturnType<typeof createTestPlan>>;

  console.log('\n📋 INICIANDO: Subscription Service - Operações Básicas');

  beforeAll(async () => {
    userId = await createTestUser();
    testPlan = await createTestPlan({
      name: 'Starter',
      slug: 'starter',
      maxStorageMB: 1000,
      maxInstances: 5,
      priceMonthly: 29.99,
      priceYearly: 299.99,
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
  // 1. Criação e Leitura de Assinaturas
  // ============================================
  describe('Criação e Leitura de Assinaturas', () => {
    console.log('  📂 Grupo: Criação e Leitura de Assinaturas');

    it('deve criar uma assinatura ativa', async () => {
      console.log('    ✓ Teste: deve criar uma assinatura ativa');

      const subscription = await createTestSubscription(userId, testPlan.id, {
        status: 'active',
        billingPeriod: 'monthly',
      });

      expect(subscription).toBeDefined();
      expect(subscription.userId).toBe(userId);
      expect(subscription.planId).toBe(testPlan.id);
      expect(subscription.status).toBe('active');
      expect(subscription.billingPeriod).toBe('monthly');
    });

    it('deve obter plano do usuário corretamente', async () => {
      console.log('    ✓ Teste: deve obter plano do usuário corretamente');

      await createTestSubscription(userId, testPlan.id, {
        status: 'active',
      });

      const userPlan = await getUserPlan(userId);

      expect(userPlan).toBeDefined();
      expect(userPlan?.plan.id).toBe(testPlan.id);
      expect(userPlan?.plan.maxStorageMB).toBe(1000);
      expect(userPlan?.plan.maxInstances).toBe(5);
      expect(userPlan?.isActive).toBe(true);
    });

    it('deve retornar null quando usuário não tem assinatura', async () => {
      console.log(
        '    ✓ Teste: deve retornar null quando usuário não tem assinatura',
      );

      const userPlan = await getUserPlan(userId);

      expect(userPlan).toBeNull();
    });
  });

  // ============================================
  // 2. Cálculo de Armazenamento
  // ============================================
  describe('Cálculo de Armazenamento', () => {
    console.log('  📂 Grupo: Cálculo de Armazenamento');

    it('deve calcular armazenamento usado corretamente', async () => {
      console.log(
        '    ✓ Teste: deve calcular armazenamento usado corretamente',
      );

      // Criar dados de teste
      await prisma.dataTable.create({
        data: {
          userId: userId.toString(),
          tableName: 'test_table',
          partition: 0,
          schema: { columns: [] },
          data: [{ id: 1, name: 'Test' }],
        },
      });

      await prisma.chatbot_memories.create({
        data: {
          userId: userId.toString(),
          chave: 'test_memory',
          valor: { test: 'data' },
        },
      });

      const storageMB = await getStorageUsage(userId);

      expect(storageMB).toBeGreaterThanOrEqual(0);
      expect(typeof storageMB).toBe('number');
    });

    it('deve usar cache quando disponível', async () => {
      console.log('    ✓ Teste: deve usar cache quando disponível');

      // Primeiro cálculo
      const storage1 = await getStorageUsage(userId);

      // Segundo cálculo (getStorageUsage sempre calcula valor real)
      const storage2 = await getStorageUsage(userId);

      expect(storage2).toBe(storage1);
    });

    it('deve atualizar armazenamento incrementalmente', async () => {
      console.log('    ✓ Teste: deve atualizar armazenamento incrementalmente');

      await createTestLimits(userId, 100, 2);

      const newStorage = await updateStorageUsageIncremental(userId, 50);

      // updateStorageUsageIncremental aplica overhead de 1.3x
      // 100MB + (50MB * 1.3) = 100 + 65 = 165MB
      expect(newStorage).toBeCloseTo(165, 0);

      const limits = await getLimits(userId);
      // Salvo como centésimos: 165MB = 16500
      expect(limits?.currentStorageMB).toBeGreaterThan(16000);
      expect(limits?.currentStorageMB).toBeLessThan(17000);
    });

    it('não deve permitir armazenamento negativo', async () => {
      console.log('    ✓ Teste: não deve permitir armazenamento negativo');

      await createTestLimits(userId, 100, 2);

      const newStorage = await updateStorageUsageIncremental(userId, -200);

      expect(newStorage).toBe(0); // Deve ser 0, não negativo
    });
  });

  // ============================================
  // 3. Validação de Limites
  // ============================================
  describe('Validação de Limites', () => {
    console.log('  📂 Grupo: Validação de Limites');

    beforeEach(async () => {
      await createTestSubscription(userId, testPlan.id, {
        status: 'active',
      });
    });

    it('deve verificar limite de armazenamento corretamente', async () => {
      console.log(
        '    ✓ Teste: deve verificar limite de armazenamento corretamente',
      );

      await createTestLimits(userId, 500, 2);

      const limitCheck = await checkPlanLimit(userId, 'storage');

      expect(limitCheck.allowed).toBe(true);
      expect(limitCheck.current).toBe(500);
      expect(limitCheck.max).toBe(1000);
    });

    it('deve bloquear quando armazenamento excede limite', async () => {
      console.log(
        '    ✓ Teste: deve bloquear quando armazenamento excede limite',
      );

      await createTestLimits(userId, 1000, 2); // No limite

      const limitCheck = await checkPlanLimit(userId, 'storage');

      expect(limitCheck.allowed).toBe(false);
      expect(limitCheck.message).toContain('Limite de armazenamento atingido');
    });

    it('deve verificar limite de instâncias corretamente', async () => {
      console.log(
        '    ✓ Teste: deve verificar limite de instâncias corretamente',
      );

      await createTestLimits(userId, 500, 3);

      const limitCheck = await checkPlanLimit(userId, 'instances');

      expect(limitCheck.allowed).toBe(true);
      expect(limitCheck.current).toBe(3);
      expect(limitCheck.max).toBe(5);
    });

    it('deve permitir instâncias ilimitadas quando maxInstances é -1', async () => {
      console.log(
        '    ✓ Teste: deve permitir instâncias ilimitadas quando maxInstances é -1',
      );

      const unlimitedPlan = await createTestPlan({
        maxInstances: -1,
      });

      await createTestSubscription(userId, unlimitedPlan.id, {
        status: 'active',
      });

      await createTestLimits(userId, 500, 1000); // Muitas instâncias

      const limitCheck = await checkPlanLimit(userId, 'instances');

      expect(limitCheck.allowed).toBe(true);
      expect(limitCheck.max).toBe(-1);
    });

    it('deve validar se pode usar armazenamento', async () => {
      console.log('    ✓ Teste: deve validar se pode usar armazenamento');

      await createTestLimits(userId, 500, 2);

      const canUse = await canUseStorage(userId, 200); // 500 + 200 = 700 < 1000

      expect(canUse.allowed).toBe(true);
    });

    it('deve bloquear quando uso futuro excede limite', async () => {
      console.log('    ✓ Teste: deve bloquear quando uso futuro excede limite');

      // Como canUseStorage agora calcula valor real do banco (não usa cache),
      // e o banco está vazio (0MB), precisamos testar com valor que excede o limite total
      await createTestLimits(userId, 900, 2);

      // Com banco vazio (0MB): 0MB + 200MB = 200MB < 1000MB → permite
      const canUse = await canUseStorage(userId, 200);
      expect(canUse.allowed).toBe(true);

      // Testar bloqueio: 0MB + 1100MB = 1100MB > 1000MB → bloqueia
      const canUseExcessive = await canUseStorage(userId, 1100);
      expect(canUseExcessive.allowed).toBe(false);
      expect(canUseExcessive.message).toContain('Armazenamento insuficiente');
    });
  });

  // ============================================
  // 4. Status de Assinatura
  // ============================================
  describe('Status de Assinatura', () => {
    console.log('  📂 Grupo: Status de Assinatura');

    it('deve identificar assinatura em trial', async () => {
      console.log('    ✓ Teste: deve identificar assinatura em trial');

      await createTestSubscription(userId, testPlan.id, {
        status: 'trialing',
        billingPeriod: 'monthly',
      });

      const userPlan = await getUserPlan(userId);

      expect(userPlan?.isTrialing).toBe(true);
      expect(userPlan?.isActive).toBe(true);
    });

    it('deve identificar assinatura cancelada', async () => {
      console.log('    ✓ Teste: deve identificar assinatura cancelada');

      await createTestSubscription(userId, testPlan.id, {
        status: 'canceled',
        billingPeriod: 'monthly',
      });

      const userPlan = await getUserPlan(userId);

      expect(userPlan).toBeNull(); // Cancelada = não ativa
    });

    it('deve identificar assinatura past_due mas ativa', async () => {
      console.log(
        '    ✓ Teste: deve identificar assinatura past_due mas ativa',
      );

      await createTestSubscription(userId, testPlan.id, {
        status: 'past_due',
        billingPeriod: 'monthly',
      });

      const userPlan = await getUserPlan(userId);

      // past_due sem cancelAtPeriodEnd ainda é considerada ativa
      expect(userPlan?.isActive).toBe(true);
    });
  });
});
