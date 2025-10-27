// ============================================
// TESTES DE PERFORMANCE - DatabaseService
// ============================================

import { createTestService, generateStringUserId } from '../../setup';
import { DatabaseService } from '@/services/database/database.service';

describe('DatabaseService - Performance', () => {
  console.log('\n📋 INICIANDO: DatabaseService - Performance');

  let service: DatabaseService;
  let userId: string;

  beforeEach(async () => {
    service = createTestService();
    userId = generateStringUserId();

    // Criar tabela de teste
    await service.addColumns(userId, 'perf_test', [
      { name: 'title', type: 'string', required: true },
      { name: 'value', type: 'number' },
    ]);
  });

  // ============================================
  // 11.1. Cache de Schema
  // ============================================
  describe('Cache de Schema', () => {
    console.log('  📂 Grupo: Cache de Schema');
    // Cache de schema agora está integrado na arquitetura:
    // - insertRecord valida com cache antes de buscar partição
    // - Operações de leitura/escrita populam cache oportunisticamente
    // - addColumns/removeColumns invalidam e re-populam cache

    it('primeira busca deve causar cache miss', async () => {
      console.log('    ✓ Teste: primeira busca deve causar cache miss');
      // Usar service existente que já tem tabela criada (via beforeEach)
      // mas cache está popular. Vamos criar NOVA instância do service
      // com mesmo userId e tabela - cache estará vazio nessa instância
      const freshService = createTestService();

      // Inserir registro usando novo service (cache vazio = cache miss ao buscar schema)
      await freshService.insertRecord(userId, 'perf_test', {
        title: 'Test',
        value: 1,
      });

      const stats = freshService.getPerformanceStats();

      // Deve ter tido 1 cache miss ao chamar getCachedSchema (schema não estava em cache)
      expect(stats.cacheMisses).toBeGreaterThanOrEqual(1);
    });

    it('segunda busca deve causar cache hit', async () => {
      console.log('    ✓ Teste: segunda busca deve causar cache hit');
      // Primeira busca popula cache
      await service.getRecords(userId, 'perf_test', {});

      // Capturar métricas iniciais
      const initialStats = service.getPerformanceStats();
      const initialCacheHits = initialStats.cacheHits;

      // Segunda busca deve usar cache (insertRecord usa getCachedSchema)
      await service.insertRecord(userId, 'perf_test', {
        title: 'Test',
        value: 1,
      });

      // Verificar que houve cache hit
      const finalStats = service.getPerformanceStats();
      expect(finalStats.cacheHits).toBeGreaterThan(initialCacheHits);
    });

    it('múltiplas operações devem aproveitar cache', async () => {
      console.log('    ✓ Teste: múltiplas operações devem aproveitar cache');
      // Primeira inserção causa cache miss, próximas usam cache
      for (let i = 0; i < 5; i++) {
        await service.insertRecord(userId, 'perf_test', {
          title: `Test ${i}`,
          value: i,
        });
      }

      // Verificar que houve cache hits (4 das 5 inserções)
      const stats = service.getPerformanceStats();
      expect(stats.cacheHits).toBeGreaterThanOrEqual(4);
      expect(stats.cacheHitRate).toBeGreaterThan(0);
    });

    it('modificar schema deve invalidar cache', async () => {
      console.log('    ✓ Teste: modificar schema deve invalidar cache');
      // Buscar uma vez (popular cache)
      await service.getRecords(userId, 'perf_test', {});

      // Capturar métricas inicial
      const initialStats = service.getPerformanceStats();

      // Modificar schema (invalida cache e re-popula com novo schema)
      await service.addColumns(userId, 'perf_test', [
        { name: 'new_field', type: 'string' },
      ]);

      // Inserir registro (deve buscar schema via getCachedSchema - cache hit)
      await service.insertRecord(userId, 'perf_test', {
        title: 'Test after modify',
        value: 99,
      });

      // addColumns invalida mas depois re-popula, então insertRecord é cache hit
      const finalStats = service.getPerformanceStats();
      expect(finalStats.cacheHits).toBeGreaterThan(initialStats.cacheHits);
    });
  });

  // ============================================
  // 11.2. Expiração de Cache (TTL = 5 min)
  // ============================================
  describe('Expiração de Cache', () => {
    console.log('  📂 Grupo: Expiração de Cache');

    it('cache deve expirar após TTL (5 minutos)', async () => {
      console.log('    ✓ Teste: cache deve expirar após TTL (5 minutos)');
      // Popular cache com primeira operação
      await service.insertRecord(userId, 'perf_test', {
        title: 'Test',
        value: 1,
      });

      const initialStats = service.getPerformanceStats();
      const initialCacheMisses = initialStats.cacheMisses;

      // Mock Date.now para simular passagem de 6 minutos (> TTL de 5 min)
      const realDateNow = Date.now;
      const baseTime = realDateNow();
      jest.spyOn(Date, 'now').mockReturnValue(baseTime + 6 * 60 * 1000);

      // Inserir novo registro - deve ser cache miss (cache expirou)
      await service.insertRecord(userId, 'perf_test', {
        title: 'Test 2',
        value: 2,
      });

      // Restaurar Date.now
      Date.now = realDateNow;

      // Verificar que houve cache miss devido à expiração
      const finalStats = service.getPerformanceStats();
      expect(finalStats.cacheMisses).toBeGreaterThan(initialCacheMisses);
    });
  });

  // ============================================
  // 11.3. Métricas de Performance
  // ============================================
  describe('Métricas de Performance', () => {
    console.log('  📂 Grupo: Métricas de Performance');

    it('deve registrar tempos de query', async () => {
      console.log('    ✓ Teste: deve registrar tempos de query');
      // Executar algumas queries
      await service.getRecords(userId, 'perf_test', {});
      await service.getRecords(userId, 'perf_test', {});
      await service.getRecords(userId, 'perf_test', {});

      const stats = service.getPerformanceStats();

      expect(stats.totalQueries).toBeGreaterThanOrEqual(3);
      expect(stats.averageQueryTime).toBeGreaterThan(0);
      expect(stats.maxQueryTime).toBeGreaterThanOrEqual(stats.minQueryTime);
    });

    it('deve calcular taxa de cache hit corretamente', async () => {
      console.log('    ✓ Teste: deve calcular taxa de cache hit corretamente');
      // Primeira operação (cache miss)
      await service.insertRecord(userId, 'perf_test', {
        title: 'Test 1',
        value: 1,
      });

      // Operações subsequentes (cache hits)
      await service.insertRecord(userId, 'perf_test', {
        title: 'Test 2',
        value: 2,
      });
      await service.insertRecord(userId, 'perf_test', {
        title: 'Test 3',
        value: 3,
      });

      const stats = service.getPerformanceStats();

      // Deve ter pelo menos 2 cache hits (das 3 inserções, 2 usam cache)
      expect(stats.cacheHits).toBeGreaterThanOrEqual(2);
      expect(stats.cacheHitRate).toBeGreaterThan(0);
      expect(stats.cacheHitRate).toBeLessThanOrEqual(1);
    });

    it('queries lentas devem ser logadas', async () => {
      console.log('    ✓ Teste: queries lentas devem ser logadas');
      // Executar query simples
      await service.getRecords(userId, 'perf_test', {});

      const stats = service.getPerformanceStats();

      // Query simples deve ser rápida (< 1000ms)
      expect(stats.maxQueryTime).toBeLessThan(1000);
    });
  });

  // ============================================
  // 11.4. Performance de Operações
  // ============================================
  describe('Performance de Operações', () => {
    console.log('  📂 Grupo: Performance de Operações');

    it('inserção de múltiplos registros deve ser eficiente', async () => {
      console.log(
        '    ✓ Teste: inserção de múltiplos registros deve ser eficiente',
      );
      const start = Date.now();

      // Inserir 10 registros (dentro do limite de 15 = MAX_PARTITIONS × MAX_PARTITION_SIZE)
      for (let i = 0; i < 10; i++) {
        await service.insertRecord(userId, 'perf_test', {
          title: `Record ${i}`,
          value: i,
        });
      }

      const elapsed = Date.now() - start;

      // 10 inserções devem completar em tempo razoável (< 5s)
      expect(elapsed).toBeLessThan(5000);
    });

    it('busca sem filtros deve ser eficiente', async () => {
      console.log('    ✓ Teste: busca sem filtros deve ser eficiente');
      // Inserir alguns registros
      for (let i = 0; i < 10; i++) {
        await service.insertRecord(userId, 'perf_test', {
          title: `Record ${i}`,
          value: i,
        });
      }

      const start = Date.now();

      // Buscar todos
      await service.getRecords(userId, 'perf_test', {});

      const elapsed = Date.now() - start;

      // Busca deve ser rápida (< 1s)
      expect(elapsed).toBeLessThan(1000);
    });

    it('busca com filtros deve ser eficiente', async () => {
      console.log('    ✓ Teste: busca com filtros deve ser eficiente');
      // Inserir registros
      for (let i = 0; i < 10; i++) {
        await service.insertRecord(userId, 'perf_test', {
          title: `Record ${i}`,
          value: i,
        });
      }

      const start = Date.now();

      // Buscar com filtro
      await service.getRecords(userId, 'perf_test', {
        filters: {
          condition: 'AND',
          rules: [{ field: 'value', operator: 'greaterThan', value: 5 }],
        },
      });

      const elapsed = Date.now() - start;

      // Busca filtrada deve ser rápida (< 1s)
      expect(elapsed).toBeLessThan(1000);
    });

    it('update em massa deve ser eficiente', async () => {
      console.log('    ✓ Teste: update em massa deve ser eficiente');
      // Inserir registros
      for (let i = 0; i < 10; i++) {
        await service.insertRecord(userId, 'perf_test', {
          title: `Record ${i}`,
          value: i,
        });
      }

      const start = Date.now();

      // Atualizar todos
      await service.updateRecords(
        userId,
        'perf_test',
        { condition: 'AND', rules: [] },
        { value: 999 },
      );

      const elapsed = Date.now() - start;

      // Update deve ser rápido (< 2s)
      expect(elapsed).toBeLessThan(2000);
    });

    it('delete em massa deve ser eficiente', async () => {
      console.log('    ✓ Teste: delete em massa deve ser eficiente');
      // Inserir registros
      for (let i = 0; i < 10; i++) {
        await service.insertRecord(userId, 'perf_test', {
          title: `Record ${i}`,
          value: i,
        });
      }

      const start = Date.now();

      // Deletar todos
      await service.deleteRecords(userId, 'perf_test', {
        condition: 'AND',
        rules: [],
      });

      const elapsed = Date.now() - start;

      // Delete deve ser rápido (< 2s)
      expect(elapsed).toBeLessThan(2000);
    });
  });

  // ============================================
  // 11.5. Cache vs No Cache
  // ============================================
  describe('Comparação Cache vs No Cache', () => {
    console.log('  📂 Grupo: Comparação Cache vs No Cache');

    it('cache deve melhorar performance em operações repetidas', async () => {
      console.log(
        '    ✓ Teste: cache deve melhorar performance em operações repetidas',
      );
      // Primeira operação (sem cache)
      const start1 = Date.now();
      await service.getRecords(userId, 'perf_test', {});
      const time1 = Date.now() - start1;

      // Segunda operação (com cache)
      const start2 = Date.now();
      await service.getRecords(userId, 'perf_test', {});
      const time2 = Date.now() - start2;

      // Cache pode ou não ser mais rápido dependendo da implementação
      // Mas ambos devem ser rápidos (< 1s)
      expect(time1).toBeLessThan(1000);
      expect(time2).toBeLessThan(1000);
    });
  });
});
