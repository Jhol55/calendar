// ============================================
// TESTES DE CONCORRÊNCIA ESTENDIDOS - DatabaseService
// Cobertura completa de deleteRecords, batch ops, schema, cache, etc.
// ============================================

import {
  createTestService,
  generateStringUserId,
  executeInParallel,
  generateMultipleUsers,
} from '../../setup';
import { DatabaseService } from '@/services/database/database.service';

describe('DatabaseService - Concorrência Estendida', () => {
  console.log('\n📋 INICIANDO: DatabaseService - Concorrência Estendida');

  let service: DatabaseService;
  let userId: string;
  let tableName: string;

  beforeEach(async () => {
    service = createTestService();
    userId = generateStringUserId();
    tableName = 'concurrency_extended_test';

    // Criar tabela de teste
    await service.addColumns(userId, tableName, [
      { name: 'value', type: 'number' },
      { name: 'name', type: 'string' },
      { name: 'status', type: 'string' },
    ]);
  });

  jest.setTimeout(120000); // Timeout maior para testes complexos

  // ============================================
  // FASE 2: DeleteRecords Concorrente
  // ============================================
  describe('DeleteRecords Simultâneos', () => {
    console.log('  📂 Grupo: DeleteRecords Simultâneos');

    it('deve deletar múltiplos registros diferentes simultaneamente', async () => {
      console.log(
        '    ✓ Teste: deve deletar múltiplos registros diferentes simultaneamente',
      );
      // CENÁRIO POSITIVO: 10 deletes paralelos em registros distintos
      // Inserir 10 registros sequencialmente
      for (let i = 0; i < 10; i++) {
        await service.insertRecord(userId, tableName, {
          value: i,
          name: `Record ${i}`,
        });
      }

      // Deletar cada um simultaneamente por filtro
      const operations = Array.from(
        { length: 10 },
        (_, i) => () =>
          service.deleteRecords(userId, tableName, {
            condition: 'AND',
            rules: [{ field: 'value', operator: 'equals', value: i }],
          }),
      );

      const { results, errors } = await executeInParallel(operations);

      // Expectativa: 100% sucesso, 0 erros (com partition lock)
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(10);
      expect(results.every((r) => r.affected === 1)).toBe(true);

      // Validação: Nenhum registro restante
      const remaining = await service.getRecords(userId, tableName, {});
      expect(remaining).toHaveLength(0);
    });

    it('deve lidar com delete do mesmo registro simultaneamente', async () => {
      console.log(
        '    ✓ Teste: deve lidar com delete do mesmo registro simultaneamente',
      );
      // CENÁRIO LIMITE: 5 deletes paralelos do mesmo registro
      const record = await service.insertRecord(userId, tableName, {
        value: 100,
        name: 'To be deleted',
      });

      const recordId = record._id;

      // 5 deletes simultâneos do mesmo ID (partition lock serializa)
      const operations = Array.from(
        { length: 5 },
        () => () =>
          service.deleteRecords(userId, tableName, {
            condition: 'AND',
            rules: [{ field: '_id', operator: 'equals', value: recordId }],
          }),
      );

      const { results, errors } = await executeInParallel(operations);

      // Expectativa: 100% sucesso, mas apenas 1 realmente deleta
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(5);
      const successfulDeletes = results.filter((r) => r.affected === 1);
      expect(successfulDeletes.length).toBe(1); // Apenas 1 deve realmente deletar

      // Validação: Registro não existe
      const remaining = await service.getRecords(userId, tableName, {
        filters: {
          condition: 'AND',
          rules: [{ field: '_id', operator: 'equals', value: recordId }],
        },
      });
      expect(remaining).toHaveLength(0);
    });

    it('deve deletar com filtros complexos simultaneamente', async () => {
      console.log(
        '    ✓ Teste: deve deletar com filtros complexos simultaneamente',
      );
      // CENÁRIO POSITIVO: Múltiplos deletes com filtros diferentes
      // Inserir 20 registros
      for (let i = 0; i < 20; i++) {
        await service.insertRecord(userId, tableName, {
          value: i,
          status: i % 2 === 0 ? 'even' : 'odd',
        });
      }

      // Delete simultâneo: pares e ímpares (partition lock serializa)
      const deleteEven = () =>
        service.deleteRecords(userId, tableName, {
          condition: 'AND',
          rules: [{ field: 'status', operator: 'equals', value: 'even' }],
        });

      const deleteOdd = () =>
        service.deleteRecords(userId, tableName, {
          condition: 'AND',
          rules: [{ field: 'status', operator: 'equals', value: 'odd' }],
        });

      const { results, errors } = await executeInParallel([
        deleteEven,
        deleteOdd,
      ]);

      // Expectativa: 100% sucesso
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(2);
      const totalDeleted = results.reduce((sum, r) => sum + r.affected, 0);
      expect(totalDeleted).toBe(20);

      // Validação: Tabela vazia
      const remaining = await service.getRecords(userId, tableName, {});
      expect(remaining).toHaveLength(0);
    });

    it('deve permitir delete durante inserts intensivos', async () => {
      console.log(
        '    ✓ Teste: deve permitir delete durante inserts intensivos',
      );
      // CENÁRIO LIMITE: Delete + inserts simultâneos
      // Inserir 10 registros iniciais
      for (let i = 0; i < 10; i++) {
        await service.insertRecord(userId, tableName, {
          value: i,
          status: 'initial',
        });
      }

      // Operações mistas (partition lock serializa tudo)
      const insertOps = Array.from(
        { length: 10 },
        (_, i) => () =>
          service.insertRecord(userId, tableName, {
            value: i + 100,
            status: 'new',
          }),
      );

      const deleteOps = Array.from(
        { length: 5 },
        (_, i) => () =>
          service.deleteRecords(userId, tableName, {
            condition: 'AND',
            rules: [{ field: 'value', operator: 'equals', value: i }],
          }),
      );

      const { results, errors } = await executeInParallel([
        ...insertOps,
        ...deleteOps,
      ] as (() => Promise<unknown>)[]);

      // Expectativa: 100% sucesso
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(15);

      // Validação: 10 novos + (10 iniciais - 5 deletados) = 15
      const remaining = await service.getRecords(userId, tableName, {});
      expect(remaining).toHaveLength(15);
    });
  });

  // ============================================
  // FASE 3: Batch Operations Concorrentes
  // ============================================
  describe('Batch Operations Simultâneas', () => {
    console.log('  📂 Grupo: Batch Operations Simultâneas');

    it('deve executar batch update + insert simultâneo', async () => {
      console.log(
        '    ✓ Teste: deve executar batch update + insert simultâneo',
      );
      // CENÁRIO POSITIVO: Batch update grande + inserts
      // Inserir 100 registros
      for (let i = 0; i < 100; i++) {
        await service.insertRecord(userId, tableName, {
          value: i,
          status: 'old',
        });
      }

      // Batch update + 10 inserts (partition lock serializa)
      const batchUpdate = () =>
        service.updateRecords(
          userId,
          tableName,
          {
            condition: 'AND',
            rules: [{ field: 'status', operator: 'equals', value: 'old' }],
          },
          { status: 'updated' },
        );

      const insertOps = Array.from(
        { length: 10 },
        (_, i) => () =>
          service.insertRecord(userId, tableName, {
            value: i + 1000,
            status: 'new',
          }),
      );

      const { results, errors } = await executeInParallel([
        batchUpdate,
        ...insertOps,
      ] as (() => Promise<unknown>)[]);

      // Expectativa: 100% sucesso
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(11);

      // Validação: 100 updated + 10 new
      const records = await service.getRecords(userId, tableName, {});
      expect(records).toHaveLength(110);
      expect(records.filter((r) => r.status === 'updated')).toHaveLength(100);
      expect(records.filter((r) => r.status === 'new')).toHaveLength(10);
    });
  });

  // ============================================
  // FASE 4: Schema Operations Concorrentes
  // ============================================
  describe('Schema Operations Simultâneas', () => {
    console.log('  📂 Grupo: Schema Operations Simultâneas');

    it('deve permitir addColumns durante inserts', async () => {
      console.log('    ✓ Teste: deve permitir addColumns durante inserts');
      // CENÁRIO POSITIVO: Add columns + inserts simultâneos
      const insertOps = Array.from(
        { length: 5 },
        (_, i) => () =>
          service.insertRecord(userId, tableName, {
            value: i,
            name: `Record ${i}`,
          }),
      );

      const addColumnsOp = () =>
        service.addColumns(userId, tableName, [
          { name: 'newField', type: 'string' },
        ]);

      const { results, errors } = await executeInParallel([
        addColumnsOp,
        ...insertOps,
      ] as (() => Promise<unknown>)[]);

      // Expectativa: 100% sucesso
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(6);

      // Validação: Schema atualizado (verificar buscando stats)
      const stats = await service.getTableStats(userId, tableName);
      expect(stats).toBeDefined();

      // Validação: Registros inseridos
      const records = await service.getRecords(userId, tableName, {});
      expect(records).toHaveLength(5);
    });
  });

  // ============================================
  // FASE 5: Multi-User Isolation
  // ============================================
  describe('Isolamento Multi-Usuário', () => {
    console.log('  📂 Grupo: Isolamento Multi-Usuário');

    it('deve manter isolamento perfeito entre usuários', async () => {
      console.log(
        '    ✓ Teste: deve manter isolamento perfeito entre usuários',
      );
      // CENÁRIO POSITIVO: 3 usuários operando simultaneamente
      const users = generateMultipleUsers(3);
      const tableName = 'isolation_test';

      // FASE 1: Criar schemas ANTES (em paralelo entre usuários)
      await Promise.all(
        users.map((uid) =>
          service.addColumns(uid, tableName, [
            { name: 'value', type: 'number' },
            { name: 'userId', type: 'string' },
          ]),
        ),
      );

      // FASE 2: Inserir registros (em paralelo)
      const insertOperations = users.flatMap((uid) =>
        Array.from(
          { length: 10 },
          (_, i) => () =>
            service.insertRecord(uid, tableName, {
              value: i,
              userId: uid,
            }),
        ),
      );

      const { results, errors } = await executeInParallel(
        insertOperations as (() => Promise<unknown>)[],
      );

      // Expectativa: 100% sucesso
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(30); // 30 inserts (3 users × 10 records)

      // Validação: Cada usuário tem exatamente 10 registros
      for (const uid of users) {
        const records = await service.getRecords(uid, tableName, {});
        expect(records).toHaveLength(10);
        expect(records.every((r) => r.userId === uid)).toBe(true);
      }
    });
  });

  // ============================================
  // FASE 6: Partition Boundary Tests
  // ============================================
  describe('Testes de Limite de Partição', () => {
    console.log('  📂 Grupo: Testes de Limite de Partição');

    it('deve criar nova partição automaticamente ao atingir limite', async () => {
      console.log(
        '    ✓ Teste: deve criar nova partição automaticamente ao atingir limite',
      );
      // CENÁRIO POSITIVO: Inserir exatamente MAX_PARTITION_SIZE + 1
      // MAX_PARTITION_SIZE = 50 no setup
      for (let i = 0; i < 51; i++) {
        await service.insertRecord(userId, tableName, {
          value: i,
          name: `Record ${i}`,
        });
      }

      // Validação: 2 partições criadas
      const stats = await service.getTableStats(userId, tableName);
      expect(stats.totalPartitions).toBe(2);
      expect(stats.fullPartitions).toBe(1);
      expect(stats.totalRecords).toBe(51);
    });

    it('deve distribuir inserts concorrentes entre partições', async () => {
      console.log(
        '    ✓ Teste: deve distribuir inserts concorrentes entre partições',
      );
      // CENÁRIO POSITIVO: Preencher primeira partição
      for (let i = 0; i < 50; i++) {
        await service.insertRecord(userId, tableName, { value: i });
      }

      // Inserir 20 simultâneos (alguns vão para nova partição)
      const operations = Array.from(
        { length: 20 },
        (_, i) => () =>
          service.insertRecord(userId, tableName, { value: i + 50 }),
      );

      const { results, errors } = await executeInParallel(operations);

      // Expectativa: 100% sucesso
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(20);

      // Validação: 70 registros em 2 partições
      const stats = await service.getTableStats(userId, tableName);
      expect(stats.totalRecords).toBe(70);
      expect(stats.totalPartitions).toBeGreaterThanOrEqual(2);
    });
  });
});
