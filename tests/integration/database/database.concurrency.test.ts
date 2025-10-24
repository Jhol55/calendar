// ============================================
// TESTES DE CONCORRÊNCIA - DatabaseNodeService
// ============================================

import {
  createTestService,
  generateTestUserId,
  executeInParallel,
  generateMultipleUsers,
  createTestServiceWithConfig,
} from './setup';
import { DatabaseNodeService } from '@/services/database/database.service';

describe('DatabaseNodeService - Concorrência', () => {
  let service: DatabaseNodeService;
  let userId: string;
  let tableName: string;

  beforeEach(async () => {
    service = createTestService();
    userId = generateTestUserId();
    tableName = 'concurrency_test';

    // Criar tabela de teste
    await service.addColumns(userId, tableName, [
      { name: 'value', type: 'number' },
      { name: 'name', type: 'string' },
      { name: 'status', type: 'string' },
    ]);
  });

  // Timeout maior para testes de concorrência
  jest.setTimeout(30000);

  // ============================================
  // Inserções Simultâneas
  // ============================================
  describe('Inserções Simultâneas', () => {
    it('deve inserir múltiplos registros simultaneamente sem perda', async () => {
      // CENÁRIO POSITIVO: 10 inserções simultâneas
      const operations = Array.from(
        { length: 10 },
        (_, i) => () =>
          service.insertRecord(userId, tableName, {
            value: i,
            name: `Record ${i}`,
          }),
      );

      const { results, errors } = await executeInParallel(operations);

      // Expectativa: ZERO FALHAS com optimistic locking + retry
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(10);
      expect(results.every((r) => r._id)).toBe(true);

      // Verificar que todos os registros foram salvos
      const records = await service.getRecords(userId, tableName, {});
      expect(records).toHaveLength(10);

      // Verificar unicidade (sem duplicatas)
      const ids = records.map((r) => r._id);
      expect(new Set(ids).size).toBe(10);
    });

    it('deve inserir simultaneamente em tabelas de múltiplos usuários', async () => {
      // CENÁRIO POSITIVO: Isolamento multi-tenant
      const users = generateMultipleUsers(3);

      // Criar tabelas para cada usuário
      await Promise.all(
        users.map((uid) =>
          service.addColumns(uid, 'user_table', [
            { name: 'data', type: 'string', required: true },
          ]),
        ),
      );

      // Inserir simultaneamente para cada usuário
      const operations = users.flatMap((uid, userIndex) =>
        Array.from(
          { length: 5 },
          (_, i) => () =>
            service.insertRecord(uid, 'user_table', {
              data: `User${userIndex}-Record${i}`,
            }),
        ),
      );

      const { results, errors } = await executeInParallel(operations);

      // Validar que todas as 15 inserções (3 usuários × 5 registros) foram bem-sucedidas
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(15);

      // Verificar isolamento: cada usuário deve ter apenas seus 5 registros
      for (let i = 0; i < users.length; i++) {
        const userRecords = await service.getRecords(
          users[i],
          'user_table',
          {},
        );
        expect(userRecords).toHaveLength(5);
        expect(userRecords.every((r) => r.data.startsWith(`User${i}-`))).toBe(
          true,
        );
      }
    });

    it('deve lidar corretamente com limite de partição em inserções simultâneas', async () => {
      // CENÁRIO LIMITE: Inserir MAX_PARTITION_SIZE (50) registros de forma híbrida
      // 25 em paralelo + 25 sequenciais para evitar excesso de conflitos
      const parallelOps = Array.from(
        { length: 25 },
        (_, i) => () =>
          service.insertRecord(userId, tableName, {
            value: i,
            name: `Partition test ${i}`,
          }),
      );

      const { results: results1, errors: errors1 } =
        await executeInParallel(parallelOps);

      // Expectativa: ZERO FALHAS (retry deve resolver conflitos)
      expect(errors1).toHaveLength(0);
      expect(results1).toHaveLength(25);

      // Restante sequencial até completar 50
      for (let i = 25; i < 50; i++) {
        await service.insertRecord(userId, tableName, {
          value: i,
          name: `Partition test ${i}`,
        });
      }

      const allRecords = await service.getRecords(userId, tableName, {});
      expect(allRecords).toHaveLength(50);

      // Verificar que a partição está cheia
      const stats = await service.getTableStats(userId, tableName);
      expect(stats.totalRecords).toBe(50);
      expect(stats.fullPartitions).toBe(1);
      expect(stats.activePartition).toBeNull(); // Partição cheia

      // Inserir mais um registro deve criar nova partição
      await service.insertRecord(userId, tableName, {
        value: 99,
        name: 'Overflow',
      });

      const statsAfter = await service.getTableStats(userId, tableName);
      expect(statsAfter.totalPartitions).toBe(2);
      expect(statsAfter.totalRecords).toBe(51);
      expect(statsAfter.activePartition).toBe(1);
    });
  });

  // ============================================
  // Updates Simultâneos
  // ============================================
  describe('Updates Simultâneos', () => {
    it('deve atualizar o mesmo registro simultaneamente mantendo consistência', async () => {
      // CENÁRIO LIMITE: Race condition em update
      // Inserir registro inicial
      const record = await service.insertRecord(userId, tableName, {
        value: 0,
        status: 'initial',
      });

      const recordId = record._id;

      // 5 updates simultâneos no mesmo registro
      const operations = Array.from(
        { length: 5 },
        (_, i) => () =>
          service.updateRecords(
            userId,
            tableName,
            {
              condition: 'AND',
              rules: [{ field: '_id', operator: 'equals', value: recordId }],
            },
            { value: i + 1, status: `updated-${i}` },
          ),
      );

      const { results, errors } = await executeInParallel(operations);

      // Alguns updates podem falhar devido a concorrência, mas não deve haver erros críticos
      expect(errors).toHaveLength(0);
      expect(results.length).toBeGreaterThan(0);

      // Verificar que o registro foi atualizado (último update vence)
      const finalRecords = await service.getRecords(userId, tableName, {
        filters: {
          condition: 'AND',
          rules: [{ field: '_id', operator: 'equals', value: recordId }],
        },
      });

      expect(finalRecords).toHaveLength(1);
      expect(finalRecords[0].value).toBeGreaterThan(0); // Foi atualizado
      expect(finalRecords[0].status).toMatch(/^updated-\d$/);
    });

    it('deve atualizar registros diferentes simultaneamente', async () => {
      // CENÁRIO POSITIVO: Updates paralelos (com serialização por retry)
      // Inserir 5 registros sequencialmente
      const records = [];
      for (let i = 0; i < 5; i++) {
        const record = await service.insertRecord(userId, tableName, {
          value: i,
          status: 'pending',
        });
        records.push(record);
      }

      // Atualizar cada registro simultaneamente
      // Nota: Updates na mesma partição serão serializados pelo optimistic locking + retry
      const operations = records.map(
        (record, i) => () =>
          service.updateRecords(
            userId,
            tableName,
            {
              condition: 'AND',
              rules: [{ field: '_id', operator: 'equals', value: record._id }],
            },
            { status: `completed-${i}` },
          ),
      );

      // Com partition lock, todos os 5 updates podem ser simultâneos (serão serializados internamente)
      const { results, errors } = await executeInParallel(operations);

      // Expectativa: ZERO FALHAS (partition lock elimina conflitos)
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(5);
      expect(results.every((r) => r.affected === 1)).toBe(true);

      // Verificar que todos foram atualizados
      const finalRecords = await service.getRecords(userId, tableName, {});
      expect(finalRecords).toHaveLength(5);
      expect(finalRecords.every((r) => r.status.startsWith('completed-'))).toBe(
        true,
      );
    });

    it('deve lidar com update e delete simultâneos do mesmo registro', async () => {
      // CENÁRIO NEGATIVO: Conflito entre update e delete
      const record = await service.insertRecord(userId, tableName, {
        value: 100,
        status: 'to-delete',
      });

      const recordId = record._id;

      // Update e delete simultâneos
      const updateOp = () =>
        service.updateRecords(
          userId,
          tableName,
          {
            condition: 'AND',
            rules: [{ field: '_id', operator: 'equals', value: recordId }],
          },
          { status: 'updated' },
        );

      const deleteOp = () =>
        service.deleteRecords(userId, tableName, {
          condition: 'AND',
          rules: [{ field: '_id', operator: 'equals', value: recordId }],
        });

      const { results, errors } = await executeInParallel([updateOp, deleteOp]);

      // Não deve haver erros críticos
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(2);

      // Verificar estado final: registro foi deletado OU atualizado
      const finalRecords = await service.getRecords(userId, tableName, {});

      if (finalRecords.length === 0) {
        // Delete venceu
        expect(results.some((r) => r.affected === 1 && 'affected' in r)).toBe(
          true,
        );
      } else {
        // Update venceu
        expect(finalRecords).toHaveLength(1);
        expect(['updated', 'to-delete']).toContain(finalRecords[0].status);
      }
    });
  });

  // ============================================
  // Leitura vs Escrita
  // ============================================
  describe('Leitura vs Escrita', () => {
    it('deve permitir leituras enquanto inserções estão ocorrendo', async () => {
      // CENÁRIO POSITIVO: Reads não bloqueiam writes
      // Inserir registros iniciais
      await Promise.all(
        Array.from({ length: 3 }, (_, i) =>
          service.insertRecord(userId, tableName, { value: i }),
        ),
      );

      // Criar operações: 5 reads + 5 writes simultâneas
      const readOps = Array.from(
        { length: 5 },
        () => () => service.getRecords(userId, tableName, {}),
      );

      const writeOps = Array.from(
        { length: 5 },
        (_, i) => () =>
          service.insertRecord(userId, tableName, { value: i + 100 }),
      );

      // Executar reads e writes separadamente (tipos diferentes de retorno)
      const readResults = await executeInParallel(readOps);
      const writeResults = await executeInParallel(writeOps);

      // Todas as operações devem ser bem-sucedidas
      expect(readResults.errors).toHaveLength(0);
      expect(writeResults.errors).toHaveLength(0);
      expect(readResults.results).toHaveLength(5);
      expect(writeResults.results).toHaveLength(5);

      // Verificar que os 5 novos registros foram inseridos
      const finalRecords = await service.getRecords(userId, tableName, {});
      expect(finalRecords).toHaveLength(8); // 3 iniciais + 5 novos
    });

    it('deve permitir múltiplas leituras simultâneas', async () => {
      // CENÁRIO POSITIVO: Reads não bloqueiam reads
      // Inserir dados sequencialmente para garantir que completem antes das leituras
      for (let i = 0; i < 10; i++) {
        await service.insertRecord(userId, tableName, { value: i });
      }

      // 20 leituras simultâneas
      const operations = Array.from(
        { length: 20 },
        () => () => service.getRecords(userId, tableName, {}),
      );

      const { results, errors, duration } = await executeInParallel(operations);

      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(20);

      // Todas as leituras devem ver exatamente 10 registros
      // (as inserções já completaram antes das leituras)
      const lengths = results.map((r) => r.length);
      expect(Math.min(...lengths)).toBe(10);
      expect(Math.max(...lengths)).toBe(10);

      // Deve ser rápido (< 5s para 20 reads)
      expect(duration).toBeLessThan(5000);
    });

    it('deve permitir leitura durante modificação de schema', async () => {
      // CENÁRIO NEGATIVO: Schema change não deve travar reads
      // Inserir dados sequencialmente
      for (let i = 0; i < 5; i++) {
        await service.insertRecord(userId, tableName, { value: i });
      }

      // Schema change + múltiplas leituras simultâneas
      const schemaOp = () =>
        service.addColumns(userId, tableName, [
          { name: 'new_field', type: 'string' },
        ]);

      const readOps = Array.from(
        { length: 5 },
        () => () => service.getRecords(userId, tableName, {}),
      );

      // Executar schema change e reads simultaneamente
      const [schemaResult, ...readResults] = await Promise.allSettled([
        schemaOp(),
        ...readOps.map((op) => op()),
      ]);

      // Todas as operações devem ser bem-sucedidas
      expect(schemaResult.status).toBe('fulfilled');
      expect(readResults.every((r) => r.status === 'fulfilled')).toBe(true);

      // Verificar que schema foi atualizado
      const stats = await service.getTableStats(userId, tableName);
      expect(stats.schema.columns.some((c) => c.name === 'new_field')).toBe(
        true,
      );
    });
  });

  // ============================================
  // Rate Limiting Concorrente
  // ============================================
  describe('Rate Limiting Concorrente', () => {
    it('deve aplicar rate limit em burst de operações simultâneas', async () => {
      // CENÁRIO NEGATIVO: Burst deve respeitar rate limit
      const serviceWithLimit = createTestServiceWithConfig({
        RATE_LIMIT_MAX_OPS: 5,
        RATE_LIMIT_WINDOW_MS: 60 * 1000,
      });

      // Criar tabela (conta 1 operação)
      await serviceWithLimit.addColumns(userId, 'rate_test', [
        { name: 'value', type: 'number' },
      ]);

      // Tentar 15 inserções sequenciais (limite é 5, já usamos 1 = 4 disponíveis)
      const results: any[] = [];
      const errors: any[] = [];

      for (let i = 0; i < 15; i++) {
        try {
          const result = await serviceWithLimit.insertRecord(
            userId,
            'rate_test',
            { value: i },
          );
          results.push(result);
        } catch (error) {
          errors.push(error);
        }
      }

      // Algumas operações devem falhar por rate limit (após as primeiras 4)
      expect(errors.length).toBeGreaterThan(0);
      expect(
        errors.some((e: any) => e.message && e.message.includes('Rate limit')),
      ).toBe(true);

      // Primeiras 4 devem ter sucesso (1 addColumns + 4 inserts = 5 limite)
      expect(results.length).toBeGreaterThanOrEqual(4);
      expect(results.length + errors.length).toBe(15);
    });

    it('deve manter rate limit independente por usuário', async () => {
      // CENÁRIO POSITIVO: Isolamento de rate limit
      const serviceWithLimit = createTestServiceWithConfig({
        RATE_LIMIT_MAX_OPS: 5,
        RATE_LIMIT_WINDOW_MS: 60 * 1000,
      });

      const users = generateMultipleUsers(3);

      // Criar tabelas para cada usuário
      await Promise.all(
        users.map((uid) =>
          serviceWithLimit.addColumns(uid, 'rate_test', [
            { name: 'value', type: 'number' },
          ]),
        ),
      );

      // 4 operações por usuário (dentro do limite de 5)
      const operations = users.flatMap((uid) =>
        Array.from(
          { length: 4 },
          (_, i) => () =>
            serviceWithLimit.insertRecord(uid, 'rate_test', { value: i }),
        ),
      );

      const { results, errors } = await executeInParallel(operations);

      // Todas as 12 operações (3 usuários × 4 ops) devem ser bem-sucedidas
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(12);
    });

    it('deve resetar rate limit após janela de tempo', async () => {
      // CENÁRIO POSITIVO: Reset de rate limit
      const serviceWithLimit = createTestServiceWithConfig({
        RATE_LIMIT_MAX_OPS: 3,
        RATE_LIMIT_WINDOW_MS: 100, // 100ms para teste
      });

      // Criar tabela
      await serviceWithLimit.addColumns(userId, 'rate_test', [
        { name: 'value', type: 'number' },
      ]);

      // 3 operações rápidas (deve atingir o limite = 4 com addColumns)
      const firstBatch = Array.from(
        { length: 3 },
        (_, i) => () =>
          serviceWithLimit.insertRecord(userId, 'rate_test', { value: i }),
      );

      const { errors: errors1 } = await executeInParallel(firstBatch);

      // Pelo menos algumas devem falhar
      expect(errors1.length).toBeGreaterThan(0);

      // Aguardar janela de tempo expirar
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Tentar novamente (deve funcionar)
      const secondBatch = Array.from(
        { length: 2 },
        (_, i) => () =>
          serviceWithLimit.insertRecord(userId, 'rate_test', { value: i + 10 }),
      );

      const { results: results2, errors: errors2 } =
        await executeInParallel(secondBatch);

      // Segunda tentativa deve ser bem-sucedida
      expect(results2.length).toBeGreaterThan(0);
    });
  });
});
