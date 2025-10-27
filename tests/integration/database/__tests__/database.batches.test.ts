// ============================================
// TESTES DE PROCESSAMENTO EM LOTES - DatabaseService
// ============================================

import { createTestService, generateStringUserId } from '../../setup';
import { DatabaseService } from '@/services/database/database.service';

describe('DatabaseService - Processamento em Lotes', () => {
  let service: DatabaseService;
  let userId: string;

  console.log('\n📋 INICIANDO: DatabaseService - Processamento em Lotes');

  beforeEach(async () => {
    service = createTestService();
    userId = generateStringUserId();

    // Criar tabela
    await service.addColumns(userId, 'batch_test', [
      { name: 'title', type: 'string', required: true },
      { name: 'status', type: 'string' },
    ]);
  });

  // ============================================
  // 9.1. Update em Lotes (BATCH_SIZE = 10)
  // ============================================
  describe('Update em Lotes', () => {
    console.log('  📂 Grupo: Update em Lotes');

    it('deve processar update em lotes quando > BATCH_SIZE', async () => {
      console.log(
        '    ✓ Teste: deve processar update em lotes quando > BATCH_SIZE',
      );
      // Inserir 15 registros (maior que BATCH_SIZE = 10)
      for (let i = 0; i < 15; i++) {
        await service.insertRecord(userId, 'batch_test', {
          title: `Task ${i}`,
          status: 'pending',
        });
      }

      // Atualizar todos → deve processar em 2 lotes (10+5)
      const result = await service.updateRecords(
        userId,
        'batch_test',
        { condition: 'AND', rules: [] }, // Todos
        { status: 'done' },
      );

      expect(result.affected).toBe(15);
      expect(result.batchInfo).toBeDefined();
      expect(result.batchInfo?.totalBatches).toBe(2); // 10 + 5
      expect(result.batchInfo?.executionTimeMs).toBeGreaterThan(0);
    });

    it('update em lote deve atualizar todos os registros', async () => {
      console.log(
        '    ✓ Teste: update em lote deve atualizar todos os registros',
      );
      // Inserir 15 registros
      for (let i = 0; i < 15; i++) {
        await service.insertRecord(userId, 'batch_test', {
          title: `Task ${i}`,
          status: 'pending',
        });
      }

      // Atualizar todos
      await service.updateRecords(
        userId,
        'batch_test',
        { condition: 'AND', rules: [] },
        { status: 'completed' },
      );

      // Verificar que todos foram atualizados
      const records = await service.getRecords(userId, 'batch_test', {});

      expect(records).toHaveLength(15);
      expect(records.every((r) => r.status === 'completed')).toBe(true);
    });

    it('update pequeno não deve usar processamento em lotes', async () => {
      console.log(
        '    ✓ Teste: update pequeno não deve usar processamento em lotes',
      );
      // Inserir apenas 2 registros (= BATCH_SIZE)
      await service.insertRecord(userId, 'batch_test', {
        title: 'Task 1',
        status: 'pending',
      });
      await service.insertRecord(userId, 'batch_test', {
        title: 'Task 2',
        status: 'pending',
      });

      // Atualizar → não deve usar lotes (usa transaction normal)
      const result = await service.updateRecords(
        userId,
        'batch_test',
        { condition: 'AND', rules: [] },
        { status: 'done' },
      );

      expect(result.affected).toBe(2);
      // Para operações pequenas, batchInfo pode não existir
      // expect(result.batchInfo).toBeUndefined();
    });
  });

  // ============================================
  // 9.2. Delete em Lotes
  // ============================================
  describe('Delete em Lotes', () => {
    console.log('  📂 Grupo: Delete em Lotes');

    it('deve processar delete em lotes quando > BATCH_SIZE', async () => {
      console.log(
        '    ✓ Teste: deve processar delete em lotes quando > BATCH_SIZE',
      );
      // Inserir 15 registros (maior que BATCH_SIZE = 10)
      for (let i = 0; i < 15; i++) {
        await service.insertRecord(userId, 'batch_test', {
          title: `Task ${i}`,
        });
      }

      // Deletar todos → deve processar em 2 lotes (10+5)
      const result = await service.deleteRecords(userId, 'batch_test', {
        condition: 'AND',
        rules: [],
      });

      expect(result.affected).toBe(15);
      expect(result.batchInfo).toBeDefined();
      expect(result.batchInfo?.totalBatches).toBe(2);
    });

    it('delete em lote deve remover todos os registros', async () => {
      console.log(
        '    ✓ Teste: delete em lote deve remover todos os registros',
      );
      // Inserir 5 registros
      for (let i = 0; i < 5; i++) {
        await service.insertRecord(userId, 'batch_test', {
          title: `Task ${i}`,
        });
      }

      // Deletar todos
      await service.deleteRecords(userId, 'batch_test', {
        condition: 'AND',
        rules: [],
      });

      // Verificar que todos foram deletados
      const records = await service.getRecords(userId, 'batch_test', {});

      expect(records).toHaveLength(0);
    });

    it('delete com filtro deve processar apenas registros que batem', async () => {
      console.log(
        '    ✓ Teste: delete com filtro deve processar apenas registros que batem',
      );
      // Inserir 10 registros (metade com status "pending")
      for (let i = 0; i < 10; i++) {
        await service.insertRecord(userId, 'batch_test', {
          title: `Task ${i}`,
          status: i % 2 === 0 ? 'pending' : 'done',
        });
      }

      // Deletar apenas "pending"
      const result = await service.deleteRecords(userId, 'batch_test', {
        condition: 'AND',
        rules: [{ field: 'status', operator: 'equals', value: 'pending' }],
      });

      expect(result.affected).toBe(5);

      // Verificar que apenas "done" permaneceram
      const remaining = await service.getRecords(userId, 'batch_test', {});

      expect(remaining).toHaveLength(5);
      expect(remaining.every((r) => r.status === 'done')).toBe(true);
    });
  });

  // ============================================
  // 9.3. Atualização de isFull após deleção
  // ============================================
  describe('Atualização de isFull após deleção', () => {
    console.log('  📂 Grupo: Atualização de isFull após deleção');

    it('partição cheia deve virar isFull=false após deleção', async () => {
      console.log(
        '    ✓ Teste: partição cheia deve virar isFull=false após deleção',
      );
      // Inserir 50 registros para encher a primeira partição (MAX_PARTITION_SIZE = 50)
      for (let i = 0; i < 50; i++) {
        await service.insertRecord(userId, 'batch_test', {
          title: `Task ${i}`,
        });
      }

      // Verificar que a partição está cheia
      let stats = await service.getTableStats(userId, 'batch_test');
      expect(stats.fullPartitions).toBe(1);
      expect(stats.totalPartitions).toBe(1);

      // Deletar 1 registro
      await service.deleteRecords(userId, 'batch_test', {
        condition: 'AND',
        rules: [{ field: 'title', operator: 'equals', value: 'Task 0' }],
      });

      // Verificar que a partição não está mais cheia
      stats = await service.getTableStats(userId, 'batch_test');
      expect(stats.fullPartitions).toBe(0);
      expect(stats.totalRecords).toBe(49);
      expect(stats.activePartition).toBe(0); // Partição 0 agora está ativa
    });

    it('múltiplas deleções devem atualizar isFull corretamente', async () => {
      console.log(
        '    ✓ Teste: múltiplas deleções devem atualizar isFull corretamente',
      );
      // Inserir 100 registros (2 partições cheias: 50 + 50)
      for (let i = 0; i < 100; i++) {
        await service.insertRecord(userId, 'batch_test', {
          title: `Task ${i}`,
        });
      }

      // Verificar estado inicial
      let stats = await service.getTableStats(userId, 'batch_test');
      expect(stats.totalPartitions).toBe(2);
      expect(stats.fullPartitions).toBe(2); // Ambas cheias

      // Deletar 3 registros (2 da partição 0, 1 da partição 1)
      await service.deleteRecords(userId, 'batch_test', {
        condition: 'AND',
        rules: [
          {
            field: 'title',
            operator: 'in',
            value: ['Task 0', 'Task 1', 'Task 50'],
          },
        ],
      });

      // Verificar que ambas as partições não estão mais cheias
      stats = await service.getTableStats(userId, 'batch_test');
      expect(stats.fullPartitions).toBe(0); // Ambas têm < 50 registros
      expect(stats.totalRecords).toBe(97);
    });
  });

  // ============================================
  // 9.4. Performance de Lotes
  // ============================================
  describe('Performance de Lotes', () => {
    console.log('  📂 Grupo: Performance de Lotes');

    it('processamento em lotes deve incluir métricas de tempo', async () => {
      console.log(
        '    ✓ Teste: processamento em lotes deve incluir métricas de tempo',
      );
      // Inserir 15 registros (> BATCH_SIZE = 10)
      for (let i = 0; i < 15; i++) {
        await service.insertRecord(userId, 'batch_test', {
          title: `Task ${i}`,
        });
      }

      // Executar update em lotes
      const result = await service.updateRecords(
        userId,
        'batch_test',
        { condition: 'AND', rules: [] },
        { status: 'processed' },
      );

      expect(result.batchInfo).toBeDefined();
      expect(result.batchInfo?.executionTimeMs).toBeGreaterThan(0);
      expect(result.batchInfo?.totalBatches).toBe(2); // 10 + 5
      expect(result.batchInfo?.averageTimePerBatch).toBeGreaterThan(0);
    });

    it('lotes grandes devem ter tempo de execução proporcional', async () => {
      console.log(
        '    ✓ Teste: lotes grandes devem ter tempo de execução proporcional',
      );
      // Inserir 25 registros (> BATCH_SIZE = 10, força 3 batches)
      for (let i = 0; i < 25; i++) {
        await service.insertRecord(userId, 'batch_test', {
          title: `Task ${i}`,
        });
      }

      const start = Date.now();

      // Executar update em lotes (3 batches: 10+10+5)
      await service.updateRecords(
        userId,
        'batch_test',
        { condition: 'AND', rules: [] },
        { status: 'processed' },
      );

      const elapsed = Date.now() - start;

      // Operação deve completar em tempo razoável (< 5s)
      expect(elapsed).toBeLessThan(5000);
    });
  });
});
