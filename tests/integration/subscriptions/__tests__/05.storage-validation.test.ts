// ============================================
// TESTES DE INTEGRAÇÃO - VALIDAÇÃO DE ARMAZENAMENTO
// ============================================
// Testa validação de limites de armazenamento em todos os pontos de inserção

import { prisma } from '@/services/prisma';
import { createTestUser, cleanDatabase, createTestService } from '../../setup';
import {
  createTestPlan,
  createTestSubscription,
  cleanSubscriptionData,
  createTestLimits,
} from '../../../helpers/subscription';
import {
  canUseStorage,
  validatePlanDowngrade,
  getStorageUsage,
} from '@/services/subscription/subscription.service';
import { salvarMemoria } from '@/workers/helpers/node-processors/memory-helper';

// Helper para gerar dados NÃO-compressíveis (aleatórios)
function generateRandomData(sizeKB: number): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-={}[]|:;<>?,./';
  let result = '';
  const targetSize = sizeKB * 1024;

  for (let i = 0; i < targetSize; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}

describe('Subscription Service - Validação de Armazenamento', () => {
  let userId: number;
  let userEmail: string;
  let testPlan: Awaited<ReturnType<typeof createTestPlan>>;

  console.log(
    '\n📋 INICIANDO: Subscription Service - Validação de Armazenamento',
  );

  beforeAll(async () => {
    userId = await createTestUser();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    userEmail = user?.email || `test-${userId}@example.com`;

    testPlan = await createTestPlan({
      name: 'Starter',
      slug: 'starter',
      maxStorageMB: 1, // Limite pequeno para testes rápidos
      maxInstances: 5,
      priceMonthly: 29.99,
      priceYearly: 299.99,
    });

    await createTestSubscription(userId, testPlan.id, {
      status: 'active',
      billingPeriod: 'monthly',
    });
  });

  beforeEach(async () => {
    await cleanSubscriptionData(userId);

    // Limpar dados de teste
    await prisma.dataTable.deleteMany({
      where: { userId: userId.toString() },
    });
    await prisma.chatbot_memories.deleteMany({
      where: { userId: userEmail },
    });

    // Recriar subscription e limites
    await createTestSubscription(userId, testPlan.id, {
      status: 'active',
    });
    await createTestLimits(userId, 0, 0); // Começar sem uso
  });

  afterAll(async () => {
    await cleanSubscriptionData(userId);
    await cleanDatabase();
  });

  // ============================================
  // 1. Validação de Downgrade de Plano
  // ============================================
  describe('Validação de Downgrade de Plano', () => {
    console.log('  📂 Grupo: Validação de Downgrade de Plano');

    it('deve bloquear downgrade quando armazenamento excede limite', async () => {
      console.log(
        '    ✓ Teste: deve bloquear downgrade quando armazenamento excede limite',
      );

      // Criar plano maior e usar muito armazenamento
      const largePlan = await createTestPlan({
        name: 'Business',
        slug: 'business',
        maxStorageMB: 100,
        maxInstances: 20,
        priceMonthly: 99.99,
        priceYearly: 999.99,
      });

      await createTestSubscription(userId, largePlan.id, {
        status: 'active',
      });

      // INSERIR DADOS REAIS para ocupar ~2MB (acima do limite de 1MB do Starter)
      const targetMB = 2.0;
      let currentMB = 0;
      let batchNumber = 0;

      while (currentMB < targetMB) {
        await prisma.dataTable.create({
          data: {
            userId: userId.toString(),
            tableName: `downgrade_large_${batchNumber}`,
            partition: 0,
            schema: { columns: [] },
            data: Array(50)
              .fill(null)
              .map((_, i) => ({
                // Lotes de 50 registros
                id: i,
                data: generateRandomData(10), // 10KB por registro (dados menos compressíveis)
              })),
          },
        });

        batchNumber++;
        currentMB = await getStorageUsage(userId);
        if (batchNumber > 100) break; // Aumentar limite
      }

      // Criar uso de 2 instâncias
      await createTestLimits(userId, 0, 2);

      // Tentar fazer downgrade para Starter (limite 1MB)
      const validation = await validatePlanDowngrade(userId, {
        maxStorageMB: testPlan.maxStorageMB,
        maxInstances: testPlan.maxInstances,
        name: testPlan.name,
      });

      expect(validation.allowed).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('armazenamento');
      expect(validation.errors[0]).toContain('liberar espaço');
    });

    it('deve bloquear downgrade quando instâncias excedem limite', async () => {
      console.log(
        '    ✓ Teste: deve bloquear downgrade quando instâncias excedem limite',
      );

      // Criar plano maior com muitas instâncias
      const largePlan = await createTestPlan({
        name: 'Business',
        slug: 'business',
        maxStorageMB: 100,
        maxInstances: 20,
        priceMonthly: 99.99,
        priceYearly: 999.99,
      });

      await createTestSubscription(userId, largePlan.id, {
        status: 'active',
      });

      // Não inserir dados de armazenamento (apenas testar instâncias)
      // Criar 10 instâncias (acima do limite do Starter que é 5)
      await createTestLimits(userId, 0, 10);

      // Tentar fazer downgrade para Starter (limite 5 instâncias)
      const validation = await validatePlanDowngrade(userId, {
        maxStorageMB: testPlan.maxStorageMB,
        maxInstances: testPlan.maxInstances,
        name: testPlan.name,
      });

      expect(validation.allowed).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('instância');
      expect(validation.errors[0]).toContain('excluir');
    });

    it('deve permitir downgrade quando uso está dentro dos limites', async () => {
      console.log(
        '    ✓ Teste: deve permitir downgrade quando uso está dentro dos limites',
      );

      // Criar plano maior mas usar pouco
      const largePlan = await createTestPlan({
        name: 'Business',
        slug: 'business',
        maxStorageMB: 100,
        maxInstances: 20,
        priceMonthly: 99.99,
        priceYearly: 999.99,
      });

      await createTestSubscription(userId, largePlan.id, {
        status: 'active',
      });

      // Inserir dados para ocupar ~0.5MB (dentro do limite de 1MB do Starter)
      const targetMB = 0.5;
      let currentMB = 0;
      let batchNumber = 0;

      while (currentMB < targetMB) {
        await prisma.dataTable.create({
          data: {
            userId: userId.toString(),
            tableName: `downgrade_within_${batchNumber}`,
            partition: 0,
            schema: { columns: [] },
            data: Array(50)
              .fill(null)
              .map((_, i) => ({
                id: i,
                data: generateRandomData(2),
              })),
          },
        });

        batchNumber++;
        currentMB = await getStorageUsage(userId);
        if (batchNumber > 15) break;
      }

      // Criar 3 instâncias (dentro do limite de 5)
      await createTestLimits(userId, 0, 3);

      // Garantir que cache foi atualizado recentemente
      await prisma.user_plan_limits.update({
        where: { userId },
        data: { updatedAt: new Date() },
      });

      // Tentar fazer downgrade para Starter
      const validation = await validatePlanDowngrade(userId, {
        maxStorageMB: testPlan.maxStorageMB,
        maxInstances: testPlan.maxInstances,
        name: testPlan.name,
      });

      expect(validation.allowed).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('deve bloquear downgrade quando ambos os limites são excedidos', async () => {
      console.log(
        '    ✓ Teste: deve bloquear downgrade quando ambos os limites são excedidos',
      );

      const largePlan = await createTestPlan({
        name: 'Business',
        slug: 'business',
        maxStorageMB: 100,
        maxInstances: 20,
        priceMonthly: 99.99,
        priceYearly: 999.99,
      });

      await createTestSubscription(userId, largePlan.id, {
        status: 'active',
      });

      // INSERIR DADOS REAIS para ocupar ~2MB (acima do limite de 1MB)
      const targetMB = 2.0;
      let currentMB = 0;
      let batchNumber = 0;

      while (currentMB < targetMB) {
        await prisma.dataTable.create({
          data: {
            userId: userId.toString(),
            tableName: `downgrade_both_${batchNumber}`,
            partition: 0,
            schema: { columns: [] },
            data: Array(50)
              .fill(null)
              .map((_, i) => ({
                // Lotes de 50 registros
                id: i,
                data: generateRandomData(10), // 10KB por registro
              })),
          },
        });

        batchNumber++;
        currentMB = await getStorageUsage(userId);
        if (batchNumber > 100) break; // Aumentar limite
      }

      // Exceder limite de instâncias: 10 instâncias (acima de 5)
      await createTestLimits(userId, 0, 10);

      await prisma.user_plan_limits.update({
        where: { userId },
        data: { updatedAt: new Date() },
      });

      const validation = await validatePlanDowngrade(userId, {
        maxStorageMB: testPlan.maxStorageMB,
        maxInstances: testPlan.maxInstances,
        name: testPlan.name,
      });

      expect(validation.allowed).toBe(false);
      expect(validation.errors.length).toBe(2); // Deve ter 2 erros (armazenamento + instâncias)
      expect(validation.errors.some((e) => e.includes('armazenamento'))).toBe(
        true,
      );
      expect(validation.errors.some((e) => e.includes('instância'))).toBe(true);
    });

    it('deve permitir downgrade para plano ilimitado', async () => {
      console.log('    ✓ Teste: deve permitir downgrade para plano ilimitado');

      // Começar com plano limitado
      await createTestLimits(userId, 50, 10);

      // Tentar "downgrade" para plano ilimitado (deve sempre permitir)
      const unlimitedPlan = await createTestPlan({
        name: 'Enterprise',
        slug: 'enterprise',
        maxStorageMB: -1,
        maxInstances: -1,
        priceMonthly: 299.99,
        priceYearly: 2999.99,
      });

      const validation = await validatePlanDowngrade(userId, {
        maxStorageMB: unlimitedPlan.maxStorageMB,
        maxInstances: unlimitedPlan.maxInstances,
        name: unlimitedPlan.name,
      });

      expect(validation.allowed).toBe(true);
      expect(validation.errors.length).toBe(0);
    });
  });

  // ============================================
  // 2. Validação no Database Node
  // ============================================
  describe('Validação no Database Node', () => {
    console.log('  📂 Grupo: Validação no Database Node');

    it('deve bloquear inserção quando armazenamento está cheio', async () => {
      console.log(
        '    ✓ Teste: deve bloquear inserção quando armazenamento está cheio',
      );

      // ESTRATÉGIA: Inserir dados até que o armazenamento real atinja ~0.9MB
      const targetMB = 0.9;
      let currentMB = 0;
      let batchNumber = 0;

      // Inserir em lotes PEQUENOS até atingir o objetivo
      while (currentMB < targetMB) {
        await prisma.dataTable.create({
          data: {
            userId: userId.toString(),
            tableName: `existing_data_${batchNumber}`,
            partition: 0,
            schema: { columns: [] },
            data: Array(50)
              .fill(null)
              .map((_, i) => ({
                // LOTES MENORES: 50 registros
                id: i,
                data: generateRandomData(2), // 2KB
              })),
          },
        });

        batchNumber++;
        currentMB = await getStorageUsage(userId);

        // Segurança: não inserir mais de 20 lotes
        if (batchNumber > 20) break;
      }

      const service = createTestService();
      await service.addColumns(userEmail, 'test_table', [
        { name: 'data', type: 'string' },
      ]);

      // Criar um registro grande (200KB - excede o limite de 1MB)
      const largeRecord = {
        data: generateRandomData(200), // 200KB
      };

      await expect(
        service.insertRecord(userEmail, 'test_table', largeRecord),
      ).rejects.toThrow(); // Aceita qualquer erro de armazenamento
    });

    it('deve permitir inserção quando há espaço disponível', async () => {
      console.log(
        '    ✓ Teste: deve permitir inserção quando há espaço disponível',
      );

      // INSERIR DADOS REAIS para ocupar ~0.1MB (10 registros * ~10KB = ~0.1MB)
      await prisma.dataTable.create({
        data: {
          userId: userId.toString(),
          tableName: 'small_existing_data',
          partition: 0,
          schema: { columns: [] },
          data: Array(10)
            .fill(null)
            .map((_, i) => ({
              id: i,
              data: generateRandomData(10), // 10KB de dados aleatórios
            })),
        },
      });

      const service = createTestService();
      await service.addColumns(userEmail, 'test_table', [
        { name: 'data', type: 'string' },
      ]);

      // Criar um registro pequeno (50KB - cabe no limite de 1MB)
      const smallRecord = {
        data: generateRandomData(50), // 50KB
      };

      const result = await service.insertRecord(
        userEmail,
        'test_table',
        smallRecord,
      );

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    });

    it('deve bloquear inserção exatamente no limite', async () => {
      console.log('    ✓ Teste: deve bloquear inserção exatamente no limite');

      // ESTRATÉGIA: Inserir dados até que o armazenamento real atinja >= 1MB
      const targetMB = 1.0;
      let currentMB = 0;
      let batchNumber = 0;

      while (currentMB < targetMB) {
        await prisma.dataTable.create({
          data: {
            userId: userId.toString(),
            tableName: `limit_data_${batchNumber}`,
            partition: 0,
            schema: { columns: [] },
            data: Array(50)
              .fill(null)
              .map((_, i) => ({
                // LOTES MENORES: 50 registros
                id: i,
                data: generateRandomData(2), // 2KB
              })),
          },
        });

        batchNumber++;
        currentMB = await getStorageUsage(userId);
        if (batchNumber > 25) break;
      }

      const service = createTestService();
      await service.addColumns(userEmail, 'test_table', [
        { name: 'data', type: 'string' },
      ]);

      // Tentar inserir qualquer coisa (deve bloquear)
      const record = {
        data: 'x',
      };

      await expect(
        service.insertRecord(userEmail, 'test_table', record),
      ).rejects.toThrow();
    });
  });

  // ============================================
  // 3. Validação no Memory Node
  // ============================================
  describe('Validação no Memory Node', () => {
    console.log('  📂 Grupo: Validação no Memory Node');

    it('deve bloquear salvamento quando armazenamento está cheio', async () => {
      console.log(
        '    ✓ Teste: deve bloquear salvamento quando armazenamento está cheio',
      );

      // ESTRATÉGIA: Inserir dados até que o armazenamento real atinja ~0.9MB
      const targetMB = 0.9;
      let currentMB = 0;
      let batchNumber = 0;

      while (currentMB < targetMB) {
        await prisma.dataTable.create({
          data: {
            userId: userId.toString(),
            tableName: `memory_existing_${batchNumber}`,
            partition: 0,
            schema: { columns: [] },
            data: Array(50)
              .fill(null)
              .map((_, i) => ({
                // LOTES MENORES: 50 registros
                id: i,
                data: generateRandomData(2),
              })),
          },
        });

        batchNumber++;
        currentMB = await getStorageUsage(userId);
        if (batchNumber > 20) break;
      }

      // Tentar salvar uma memória grande (200KB - excede o limite de 1MB)
      const largeMemoryValue = {
        data: generateRandomData(200), // 200KB
      };

      await expect(
        salvarMemoria(userEmail, 'large_memory', largeMemoryValue),
      ).rejects.toThrow();
    });

    it('deve permitir salvamento quando há espaço disponível', async () => {
      console.log(
        '    ✓ Teste: deve permitir salvamento quando há espaço disponível',
      );

      // INSERIR DADOS REAIS para ocupar ~0.1MB
      await prisma.dataTable.create({
        data: {
          userId: userId.toString(),
          tableName: 'memory_small_data',
          partition: 0,
          schema: { columns: [] },
          data: Array(10)
            .fill(null)
            .map((_, i) => ({
              id: i,
              data: generateRandomData(10), // 10KB de dados aleatórios
            })),
        },
      });

      // Salvar uma memória pequena (50KB - cabe no limite de 1MB)
      const smallMemoryValue = {
        data: generateRandomData(50), // 50KB
      };

      const result = await salvarMemoria(
        userEmail,
        'small_memory',
        smallMemoryValue,
      );

      expect(result.success).toBe(true);

      // Verificar que memória foi salva
      const saved = await prisma.chatbot_memories.findUnique({
        where: {
          userId_chave: {
            userId: userEmail,
            chave: 'small_memory',
          },
        },
      });

      expect(saved).toBeDefined();
    });

    it('deve bloquear salvamento exatamente no limite', async () => {
      console.log('    ✓ Teste: deve bloquear salvamento exatamente no limite');

      // ESTRATÉGIA: Inserir dados até que o armazenamento real atinja >= 1MB
      const targetMB = 1.0;
      let currentMB = 0;
      let batchNumber = 0;

      while (currentMB < targetMB) {
        await prisma.dataTable.create({
          data: {
            userId: userId.toString(),
            tableName: `memory_limit_${batchNumber}`,
            partition: 0,
            schema: { columns: [] },
            data: Array(50)
              .fill(null)
              .map((_, i) => ({
                // LOTES MENORES: 50 registros
                id: i,
                data: generateRandomData(2),
              })),
          },
        });

        batchNumber++;
        currentMB = await getStorageUsage(userId);
        if (batchNumber > 25) break;
      }

      // Tentar salvar qualquer coisa (deve bloquear)
      const memoryValue = {
        data: 'x',
      };

      await expect(
        salvarMemoria(userEmail, 'limit_memory', memoryValue),
      ).rejects.toThrow();
    });
  });

  // ============================================
  // 4. Função canUseStorage
  // ============================================
  describe('Função canUseStorage', () => {
    console.log('  📂 Grupo: Função canUseStorage');

    it('deve retornar false quando não há espaço suficiente', async () => {
      console.log(
        '    ✓ Teste: deve retornar false quando não há espaço suficiente',
      );

      // ESTRATÉGIA: Inserir dados até que o armazenamento real atinja ~0.9MB
      const targetMB = 0.9;
      let currentMB = 0;
      let batchNumber = 0;

      while (currentMB < targetMB) {
        await prisma.dataTable.create({
          data: {
            userId: userId.toString(),
            tableName: `canuse_data_${batchNumber}`,
            partition: 0,
            schema: { columns: [] },
            data: Array(50)
              .fill(null)
              .map((_, i) => ({
                // LOTES MENORES: 50 registros
                id: i,
                data: generateRandomData(2),
              })),
          },
        });

        batchNumber++;
        currentMB = await getStorageUsage(userId);
        if (batchNumber > 20) break;
      }

      // Tentar usar 0.2MB (não cabe no limite de 1MB)
      const check = await canUseStorage(userId, 0.2);

      expect(check.allowed).toBe(false);
      expect(check.message).toContain('Armazenamento insuficiente');
      expect(check.message).toContain('Disponível');
    });

    it('deve retornar true quando há espaço suficiente', async () => {
      console.log(
        '    ✓ Teste: deve retornar true quando há espaço suficiente',
      );

      // Usar 0.5MB de 1MB disponíveis
      await createTestLimits(userId, 0, 0);

      // Tentar usar 0.4MB (cabe no limite de 1MB)
      const check = await canUseStorage(userId, 0.4);

      expect(check.allowed).toBe(true);
      expect(check.message).toBeUndefined();
    });

    it('deve considerar armazenamento ilimitado', async () => {
      console.log('    ✓ Teste: deve considerar armazenamento ilimitado');

      // Criar plano ilimitado
      const unlimitedPlan = await createTestPlan({
        name: 'Enterprise',
        slug: 'enterprise',
        maxStorageMB: -1, // Ilimitado
        maxInstances: -1,
        priceMonthly: 299.99,
        priceYearly: 2999.99,
      });

      await createTestSubscription(userId, unlimitedPlan.id, {
        status: 'active',
      });

      // Atualizar limites para garantir que está usando o novo plano
      await createTestLimits(userId, 0, 0);

      // Tentar usar qualquer quantidade (deve permitir)
      const check = await canUseStorage(userId, 1000);

      expect(check.allowed).toBe(true);
    });

    it('deve retornar erro quando usuário não tem plano', async () => {
      console.log(
        '    ✓ Teste: deve retornar erro quando usuário não tem plano',
      );

      // Criar novo usuário sem plano
      const newUserId = await createTestUser();

      // Tentar usar armazenamento sem plano (deve falhar)
      const check = await canUseStorage(newUserId, 1);

      expect(check.allowed).toBe(false);
      // Pode retornar erro de plano ou armazenamento insuficiente
      expect(
        check.message?.includes('plano') ||
          check.message?.includes('Armazenamento insuficiente'),
      ).toBe(true);
    });

    it('deve bloquear quando já está no limite ou acima', async () => {
      console.log(
        '    ✓ Teste: deve bloquear quando já está no limite ou acima',
      );

      // ESTRATÉGIA: Inserir dados até que o armazenamento real atinja >= 1MB
      const targetMB = 1.0;
      let currentMB = 0;
      let batchNumber = 0;

      while (currentMB < targetMB) {
        await prisma.dataTable.create({
          data: {
            userId: userId.toString(),
            tableName: `exact_limit_${batchNumber}`,
            partition: 0,
            schema: { columns: [] },
            data: Array(50)
              .fill(null)
              .map((_, i) => ({
                // LOTES MENORES: 50 registros
                id: i,
                data: generateRandomData(2),
              })),
          },
        });

        batchNumber++;
        currentMB = await getStorageUsage(userId);
        if (batchNumber > 25) break;
      }

      // Se o storage está >= limite, até 0MB adicional deve ser bloqueado
      const check = await canUseStorage(userId, 0);

      // Se ultrapassou o limite, deve bloquear
      if (currentMB >= 1.0) {
        expect(check.allowed).toBe(false);
      } else {
        // Se está abaixo, deve permitir
        expect(check.allowed).toBe(true);
      }
    });
  });
});
