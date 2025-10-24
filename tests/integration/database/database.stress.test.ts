// ============================================
// TESTES DE STRESS - DatabaseNodeService
// ============================================

import { createTestService, generateTestUserId } from './setup';
import { DatabaseNodeService } from '@/services/database/database.service';

describe('DatabaseNodeService - Stress Testing', () => {
  let service: DatabaseNodeService;
  let userId: string;

  beforeEach(async () => {
    service = createTestService();
    userId = generateTestUserId();
  });

  // Timeout maior para testes de stress (2 minutos)
  jest.setTimeout(120000);

  // ============================================
  // Volume de Inserção
  // ============================================
  describe('Volume de Inserção', () => {
    it('deve inserir 200 registros em tempo aceitável', async () => {
      // CENÁRIO POSITIVO: Teste de volume realista
      const tableName = 'stress_200';

      await service.addColumns(userId, tableName, [
        { name: 'title', type: 'string', required: true },
        { name: 'value', type: 'number' },
        { name: 'metadata', type: 'object' },
      ]);

      const start = Date.now();

      // Inserir 200 registros sequencialmente
      for (let i = 0; i < 200; i++) {
        await service.insertRecord(userId, tableName, {
          title: `Record ${i}`,
          value: i,
          metadata: { index: i, batch: Math.floor(i / 20) },
        });

        if ((i + 1) % 50 === 0) {
          console.log(`   Inseridos ${i + 1}/200 registros...`);
        }
      }

      const elapsed = Date.now() - start;
      console.log(`   ✅ 200 registros inseridos em ${elapsed}ms`);

      // Deve completar em tempo razoável (< 60s)
      expect(elapsed).toBeLessThan(60000);

      // Verificar stats
      const stats = await service.getTableStats(userId, tableName);
      expect(stats.totalRecords).toBe(200);
      expect(stats.totalPartitions).toBeGreaterThan(0);

      console.log(
        `   📊 Stats: ${stats.totalPartitions} partições, ${stats.fullPartitions} cheias`,
      );
    });

    it('deve processar 100 registros com processamento em lotes eficiente', async () => {
      // CENÁRIO POSITIVO: Validar batch processing em volume médio
      const tableName = 'stress_batch';

      await service.addColumns(userId, tableName, [
        { name: 'value', type: 'number' },
        { name: 'category', type: 'string' },
      ]);

      // Inserir 100 registros
      const insertStart = Date.now();
      for (let i = 0; i < 100; i++) {
        await service.insertRecord(userId, tableName, {
          value: i,
          category: `cat-${i % 10}`,
        });

        if ((i + 1) % 25 === 0) {
          console.log(`   Inseridos ${i + 1}/100 registros...`);
        }
      }
      const insertTime = Date.now() - insertStart;

      console.log(`   ✅ 100 registros inseridos em ${insertTime}ms`);

      // Update em massa (deve usar batch processing)
      const updateStart = Date.now();
      const updateResult = await service.updateRecords(
        userId,
        tableName,
        { condition: 'AND', rules: [] },
        { category: 'updated' },
      );
      const updateTime = Date.now() - updateStart;

      console.log(
        `   ✅ 100 registros atualizados em ${updateTime}ms (${updateResult.batchInfo?.totalBatches} lotes)`,
      );

      expect(updateResult.affected).toBe(100);
      expect(updateResult.batchInfo).toBeDefined();
      expect(updateResult.batchInfo?.totalBatches).toBeGreaterThan(0);

      // Delete em massa (deve usar batch processing)
      const deleteStart = Date.now();
      const deleteResult = await service.deleteRecords(userId, tableName, {
        condition: 'AND',
        rules: [],
      });
      const deleteTime = Date.now() - deleteStart;

      console.log(
        `   ✅ 100 registros deletados em ${deleteTime}ms (${deleteResult.batchInfo?.totalBatches} lotes)`,
      );

      expect(deleteResult.affected).toBe(100);
      expect(deleteResult.batchInfo).toBeDefined();

      // Verificar que todos foram deletados
      const remaining = await service.getRecords(userId, tableName, {});
      expect(remaining).toHaveLength(0);
    });

    it('deve manter stats consistentes com 500 registros', async () => {
      // CENÁRIO POSITIVO: Validar consistência de stats com alto volume
      const tableName = 'stress_stats';

      await service.addColumns(userId, tableName, [
        { name: 'index', type: 'number' },
      ]);

      console.log('   Inserindo 500 registros...');

      // Inserir 500 registros
      for (let i = 0; i < 500; i++) {
        await service.insertRecord(userId, tableName, { index: i });

        if ((i + 1) % 100 === 0) {
          console.log(`   Progresso: ${i + 1}/500`);
        }
      }

      // Verificar stats
      const stats = await service.getTableStats(userId, tableName);
      expect(stats.totalRecords).toBe(500);

      // Buscar todos os registros para validar consistência
      const allRecords = await service.getRecords(userId, tableName, {});
      expect(allRecords).toHaveLength(500);

      // Somar registros de todas as partições deve igualar totalRecords
      console.log(
        `   ✅ Consistência validada: ${stats.totalPartitions} partições, ${stats.totalRecords} registros`,
      );

      // Verificar que não há duplicatas
      const uniqueIndexes = new Set(allRecords.map((r) => r.index));
      expect(uniqueIndexes.size).toBe(500);
    });
  });

  // ============================================
  // Performance de Busca
  // ============================================
  describe('Performance de Busca', () => {
    it('deve buscar 300 registros rapidamente', async () => {
      // CENÁRIO POSITIVO: Busca sem filtros deve ser rápida mesmo com volume
      const tableName = 'search_perf';

      await service.addColumns(userId, tableName, [
        { name: 'title', type: 'string' },
        { name: 'value', type: 'number' },
        { name: 'category', type: 'string' },
        { name: 'active', type: 'boolean' },
      ]);

      // Inserir 300 registros para busca
      console.log('   Preparando 300 registros...');
      for (let i = 0; i < 300; i++) {
        await service.insertRecord(userId, tableName, {
          title: `Item ${i}`,
          value: i,
          category: `cat-${i % 5}`,
          active: i % 2 === 0,
        });

        if ((i + 1) % 100 === 0) {
          console.log(`   Setup: ${i + 1}/300`);
        }
      }

      const start = Date.now();
      const records = await service.getRecords(userId, tableName, {});
      const elapsed = Date.now() - start;

      console.log(`   ✅ Busca de 300 registros em ${elapsed}ms`);

      expect(records).toHaveLength(300);
      expect(elapsed).toBeLessThan(5000); // < 5s
    });

    it('deve buscar com filtros complexos em 300 registros', async () => {
      // CENÁRIO POSITIVO: Filtros não devem degradar muito a performance
      const tableName = 'search_filters';

      await service.addColumns(userId, tableName, [
        { name: 'value', type: 'number' },
        { name: 'category', type: 'string' },
        { name: 'active', type: 'boolean' },
      ]);

      // Inserir 300 registros
      console.log('   Preparando 300 registros...');
      for (let i = 0; i < 300; i++) {
        await service.insertRecord(userId, tableName, {
          value: i,
          category: `cat-${i % 5}`,
          active: i % 2 === 0,
        });

        if ((i + 1) % 100 === 0) {
          console.log(`   Setup: ${i + 1}/300`);
        }
      }

      const start = Date.now();

      const records = await service.getRecords(userId, tableName, {
        filters: {
          condition: 'AND',
          rules: [
            { field: 'value', operator: 'greaterThan', value: 150 },
            { field: 'category', operator: 'equals', value: 'cat-1' },
            { field: 'active', operator: 'isTrue', value: null },
          ],
        },
      });

      const elapsed = Date.now() - start;
      console.log(
        `   ✅ Busca com filtros complexos em ${elapsed}ms (${records.length} resultados)`,
      );

      // Deve retornar registros que satisfazem todos os filtros
      expect(records.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(5000); // < 5s
    });

    it('deve ordenar 300 registros eficientemente', async () => {
      // CENÁRIO POSITIVO: Ordenação deve ser rápida mesmo com volume
      const tableName = 'search_sort';

      await service.addColumns(userId, tableName, [
        { name: 'value', type: 'number' },
      ]);

      // Inserir 300 registros
      console.log('   Preparando 300 registros...');
      for (let i = 0; i < 300; i++) {
        await service.insertRecord(userId, tableName, { value: i });

        if ((i + 1) % 100 === 0) {
          console.log(`   Setup: ${i + 1}/300`);
        }
      }

      const start = Date.now();

      const records = await service.getRecords(userId, tableName, {
        sort: { field: 'value', order: 'desc' },
      });

      const elapsed = Date.now() - start;
      console.log(`   ✅ Ordenação de 300 registros em ${elapsed}ms`);

      expect(records).toHaveLength(300);
      expect(records[0].value).toBe(299); // Maior valor primeiro (desc)
      expect(records[299].value).toBe(0); // Menor valor por último
      expect(elapsed).toBeLessThan(5000); // < 5s
    });
  });

  // ============================================
  // Updates em Massa
  // ============================================
  describe('Updates em Massa', () => {
    it('deve atualizar 250 registros com métricas de batch', async () => {
      // CENÁRIO POSITIVO: Update em massa com alto volume
      const tableName = 'mass_update';

      await service.addColumns(userId, tableName, [
        { name: 'status', type: 'string' },
        { name: 'counter', type: 'number' },
      ]);

      // Inserir 250 registros
      console.log('   Preparando 250 registros...');
      for (let i = 0; i < 250; i++) {
        await service.insertRecord(userId, tableName, {
          status: 'pending',
          counter: i,
        });

        if ((i + 1) % 50 === 0) {
          console.log(`   Setup: ${i + 1}/250`);
        }
      }

      // Update em massa
      const start = Date.now();
      const result = await service.updateRecords(
        userId,
        tableName,
        { condition: 'AND', rules: [] },
        { status: 'processed' },
      );
      const elapsed = Date.now() - start;

      console.log(
        `   ✅ 250 registros atualizados em ${elapsed}ms (${result.batchInfo?.totalBatches} lotes)`,
      );

      expect(result.affected).toBe(250);
      expect(result.batchInfo).toBeDefined();
      expect(elapsed).toBeLessThan(30000); // < 30s

      // Verificar consistência
      const verification = await service.getRecords(userId, tableName, {});
      expect(verification.every((r) => r.status === 'processed')).toBe(true);
    });

    it('deve deletar 250 registros eficientemente', async () => {
      // CENÁRIO POSITIVO: Delete em massa com alto volume
      const tableName = 'mass_delete';

      await service.addColumns(userId, tableName, [
        { name: 'value', type: 'number' },
      ]);

      // Inserir 250 registros
      console.log('   Preparando 250 registros...');
      for (let i = 0; i < 250; i++) {
        await service.insertRecord(userId, tableName, { value: i });

        if ((i + 1) % 50 === 0) {
          console.log(`   Setup: ${i + 1}/250`);
        }
      }

      // Delete em massa
      const start = Date.now();
      const result = await service.deleteRecords(userId, tableName, {
        condition: 'AND',
        rules: [],
      });
      const elapsed = Date.now() - start;

      console.log(
        `   ✅ 250 registros deletados em ${elapsed}ms (${result.batchInfo?.totalBatches} lotes)`,
      );

      expect(result.affected).toBe(250);
      expect(result.batchInfo).toBeDefined();
      expect(elapsed).toBeLessThan(30000); // < 30s

      // Verificar que todos foram deletados
      const remaining = await service.getRecords(userId, tableName, {});
      expect(remaining).toHaveLength(0);
    });
  });

  // ============================================
  // Múltiplas Partições
  // ============================================
  describe('Múltiplas Partições', () => {
    it('deve criar e gerenciar 10 partições corretamente', async () => {
      // CENÁRIO POSITIVO: Teste com múltiplas partições
      // MAX_PARTITIONS = 20, MAX_PARTITION_SIZE = 50 → até 1000 registros
      const tableName = 'multi_partition';

      await service.addColumns(userId, tableName, [
        { name: 'partition_test', type: 'number' },
      ]);

      console.log('   Criando 10 partições (500 registros)...');

      // Inserir 500 registros (10 partições × 50 registros)
      for (let i = 0; i < 500; i++) {
        await service.insertRecord(userId, tableName, { partition_test: i });

        if ((i + 1) % 100 === 0) {
          console.log(`   Progresso: ${i + 1}/500`);
        }
      }

      // Verificar partições
      const stats = await service.getTableStats(userId, tableName);
      expect(stats.totalRecords).toBe(500);
      expect(stats.totalPartitions).toBe(10);
      expect(stats.fullPartitions).toBe(10); // Todas cheias

      console.log(`   ✅ 10 partições criadas e gerenciadas corretamente`);

      // Buscar todos os registros (deve agregar de todas as partições)
      const allRecords = await service.getRecords(userId, tableName, {});
      expect(allRecords).toHaveLength(500);

      // Verificar que todos os valores estão presentes
      const values = allRecords
        .map((r) => r.partition_test)
        .sort((a, b) => a - b);
      expect(values.length).toBe(500);
      expect(values[0]).toBe(0);
      expect(values[499]).toBe(499);
    });

    it('deve manter performance de stats com múltiplas partições', async () => {
      // CENÁRIO POSITIVO: Stats não devem degradar com múltiplas partições
      const tableName = 'stats_performance';

      await service.addColumns(userId, tableName, [
        { name: 'data', type: 'string' },
      ]);

      // Criar 8 partições completas (400 registros)
      console.log('   Criando 8 partições (400 registros)...');
      for (let i = 0; i < 400; i++) {
        await service.insertRecord(userId, tableName, { data: `R${i}` });

        if ((i + 1) % 100 === 0) {
          console.log(`   Progresso: ${i + 1}/400`);
        }
      }

      // Medir performance de getTableStats
      const start = Date.now();
      const stats = await service.getTableStats(userId, tableName);
      const elapsed = Date.now() - start;

      console.log(`   ✅ Stats calculadas em ${elapsed}ms`);

      expect(stats.totalRecords).toBe(400);
      expect(stats.totalPartitions).toBe(8);
      expect(stats.fullPartitions).toBe(8);
      expect(elapsed).toBeLessThan(3000); // < 3s
    });
  });

  // ============================================
  // Teste de Limite
  // ============================================
  describe('Teste de Limite', () => {
    it('deve rejeitar inserção além do limite de partições', async () => {
      // CENÁRIO NEGATIVO: Validar que o limite é respeitado
      const tableName = 'limit_test';

      await service.addColumns(userId, tableName, [
        { name: 'value', type: 'number' },
      ]);

      // Inserir 1000 registros (máximo permitido: 20 partições × 50 registros)
      console.log('   Inserindo 1000 registros (limite máximo)...');
      for (let i = 0; i < 1000; i++) {
        await service.insertRecord(userId, tableName, { value: i });

        if ((i + 1) % 200 === 0) {
          console.log(`   Progresso: ${i + 1}/1000`);
        }
      }

      const statsBefore = await service.getTableStats(userId, tableName);
      expect(statsBefore.totalRecords).toBe(1000);
      expect(statsBefore.totalPartitions).toBe(20);
      expect(statsBefore.fullPartitions).toBe(20);

      // Tentar inserir o 1001º registro (deve falhar)
      await expect(
        service.insertRecord(userId, tableName, { value: 1000 }),
      ).rejects.toThrow('Limite de partições atingido');

      // Verificar que não foi inserido
      const statsAfter = await service.getTableStats(userId, tableName);
      expect(statsAfter.totalRecords).toBe(1000);

      console.log('   ✅ Limite de partições (20) validado corretamente');
    });
  });
});
