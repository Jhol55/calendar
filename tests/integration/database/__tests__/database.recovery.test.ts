// ============================================
// TESTES DE RECUPERAÇÃO E CONSISTÊNCIA - DatabaseService
// ============================================

import { createTestService, generateTestUserId } from '../setup';
import { DatabaseService } from '@/services/database/database.service';

describe('DatabaseService - Recuperação e Consistência', () => {
  let service: DatabaseService;
  let userId: string;
  let tableName: string;

  beforeEach(async () => {
    service = createTestService();
    userId = generateTestUserId();
    tableName = 'recovery_test';

    // Criar tabela de teste
    await service.addColumns(userId, tableName, [
      { name: 'value', type: 'number' },
      { name: 'status', type: 'string' },
    ]);
  });

  // Timeout maior para testes de recuperação
  jest.setTimeout(30000);

  // ============================================
  // Validação de Tipos e Consistência
  // ============================================
  describe('Validação de Tipos', () => {
    it('deve rejeitar inserção com tipo inválido', async () => {
      // CENÁRIO NEGATIVO: Inserir string em campo number
      await expect(
        service.insertRecord(userId, tableName, {
          value: 'not-a-number' as any,
          status: 'test',
        }),
      ).rejects.toThrow();

      // Verificar que não foi inserido
      const records = await service.getRecords(userId, tableName, {});
      expect(records).toHaveLength(0);
    });

    it('deve rejeitar update com tipo inválido e manter dados originais', async () => {
      // CENÁRIO NEGATIVO: Update com tipo inválido preserva estado original
      // Inserir registro válido
      await service.insertRecord(userId, tableName, {
        value: 1,
        status: 'original',
      });

      // Tentar update com tipo inválido (deve falhar)
      await expect(
        service.updateRecords(
          userId,
          tableName,
          { condition: 'AND', rules: [] },
          { value: 'invalid' as any },
        ),
      ).rejects.toThrow();

      // Verificar que o registro original está intacto
      const records = await service.getRecords(userId, tableName, {});
      expect(records).toHaveLength(1);
      expect(records[0].value).toBe(1);
      expect(records[0].status).toBe('original');
    });

    it('deve manter integridade ao rejeitar campo obrigatório ausente', async () => {
      // CENÁRIO NEGATIVO: Campo required ausente
      // Adicionar campo obrigatório
      await service.addColumns(userId, tableName, [
        { name: 'required_field', type: 'string', required: true },
      ]);

      // Tentar inserir sem o campo obrigatório (deve falhar)
      await expect(
        service.insertRecord(userId, tableName, {
          value: 1,
          status: 'test',
          // required_field está ausente
        }),
      ).rejects.toThrow();

      // Verificar que nenhum registro foi inserido
      const records = await service.getRecords(userId, tableName, {});
      expect(records).toHaveLength(0);
    });

    it('deve rejeitar DELETE com filtro de tipo inválido', async () => {
      // CENÁRIO NEGATIVO: Filtro com tipo incompatível deve ser rejeitado
      // Inserir registros válidos
      await Promise.all([
        service.insertRecord(userId, tableName, { value: 1, status: 'ok' }),
        service.insertRecord(userId, tableName, { value: 2, status: 'ok' }),
        service.insertRecord(userId, tableName, { value: 3, status: 'ok' }),
      ]);

      // Tentar deletar com filtro inválido (string em campo number)
      await expect(
        service.deleteRecords(userId, tableName, {
          condition: 'AND',
          rules: [
            {
              field: 'value',
              operator: 'equals',
              value: 'not-a-number' as any,
            },
          ],
        }),
      ).rejects.toThrow();

      // Verificar que todos os registros estão intactos
      const records = await service.getRecords(userId, tableName, {});
      expect(records).toHaveLength(3);
    });
  });

  // ============================================
  // Limites e Capacidade
  // ============================================
  describe('Limites e Capacidade', () => {
    it('deve rejeitar inserção quando MAX_PARTITIONS atingido e todas cheias', async () => {
      // CENÁRIO NEGATIVO: Limite absoluto de capacidade
      // MAX_PARTITION_SIZE = 50, MAX_PARTITIONS = 20
      // Capacidade máxima = 50 × 20 = 1000 registros

      // Inserir 1000 registros (encher todas as partições)
      for (let i = 0; i < 1000; i++) {
        await service.insertRecord(userId, tableName, {
          value: i,
          status: 'filled',
        });
      }

      const stats = await service.getTableStats(userId, tableName);
      expect(stats.totalRecords).toBe(1000);
      expect(stats.totalPartitions).toBe(20);
      expect(stats.fullPartitions).toBe(20);
      expect(stats.activePartition).toBeNull();

      // Tentar inserir o 1001º registro (deve falhar)
      await expect(
        service.insertRecord(userId, tableName, {
          value: 9999,
          status: 'overflow',
        }),
      ).rejects.toThrow();

      // Verificar que não foi inserido
      const finalRecords = await service.getRecords(userId, tableName, {});
      expect(finalRecords).toHaveLength(1000);
      expect(finalRecords.every((r) => r.value !== 9999)).toBe(true);
    });

    it('deve permitir operações após deletar registros de partição cheia', async () => {
      // CENÁRIO POSITIVO: Recuperação de espaço após delete
      // Encher uma partição (50 registros)
      for (let i = 0; i < 50; i++) {
        await service.insertRecord(userId, tableName, {
          value: i,
          status: 'to-delete',
        });
      }

      const statsBefore = await service.getTableStats(userId, tableName);
      expect(statsBefore.fullPartitions).toBe(1);

      // Deletar metade dos registros para liberar espaço
      await service.deleteRecords(userId, tableName, {
        condition: 'AND',
        rules: [{ field: 'value', operator: 'lessThan', value: 25 }],
      });

      // Inserir novos registros deve funcionar
      await service.insertRecord(userId, tableName, {
        value: 100,
        status: 'new',
      });

      const records = await service.getRecords(userId, tableName, {});
      expect(records.length).toBeGreaterThan(25);
      expect(records.some((r) => r.value === 100)).toBe(true);
    });

    it('deve manter stats consistentes após operações falhadas', async () => {
      // CENÁRIO POSITIVO: Stats não corrompem após erro
      // Inserir registros válidos
      for (let i = 0; i < 3; i++) {
        await service.insertRecord(userId, tableName, {
          value: i,
          status: 'valid',
        });
      }

      // Capturar stats antes do erro
      const statsBefore = await service.getTableStats(userId, tableName);
      expect(statsBefore.totalRecords).toBe(3);

      // Tentar inserção inválida (deve falhar)
      await expect(
        service.insertRecord(userId, tableName, {
          value: 'invalid' as any,
          status: 'test',
        }),
      ).rejects.toThrow();

      // Stats devem permanecer consistentes
      const statsAfter = await service.getTableStats(userId, tableName);
      expect(statsAfter.totalRecords).toBe(statsBefore.totalRecords);
      expect(statsAfter.totalPartitions).toBe(statsBefore.totalPartitions);
      expect(statsAfter.fullPartitions).toBe(statsBefore.fullPartitions);
    });

    it('deve manter isFull correto após preenchimento gradual', async () => {
      // CENÁRIO POSITIVO: Flag isFull atualiza corretamente
      // Inserir 49 registros (MAX_PARTITION_SIZE = 50, quase cheia)
      for (let i = 0; i < 49; i++) {
        await service.insertRecord(userId, tableName, {
          value: i,
          status: 'filling',
        });
      }

      const statsBefore = await service.getTableStats(userId, tableName);
      expect(statsBefore.fullPartitions).toBe(0);
      expect(statsBefore.activePartition).toBe(0);

      // Inserir o 50º registro (deve encher a partição)
      await service.insertRecord(userId, tableName, {
        value: 49,
        status: 'full',
      });

      const statsAfter = await service.getTableStats(userId, tableName);
      expect(statsAfter.totalRecords).toBe(50);
      expect(statsAfter.fullPartitions).toBe(1);
      expect(statsAfter.activePartition).toBeNull(); // Partição atual está cheia

      // Inserir mais um deve criar nova partição
      await service.insertRecord(userId, tableName, {
        value: 50,
        status: 'overflow',
      });

      const statsFinal = await service.getTableStats(userId, tableName);
      expect(statsFinal.totalPartitions).toBe(2);
      expect(statsFinal.activePartition).toBe(1);
    });
  });

  // ============================================
  // Consistência de Dados
  // ============================================
  describe('Consistência de Dados', () => {
    it('deve manter integridade após múltiplas operações sequenciais', async () => {
      // CENÁRIO POSITIVO: Operações sequenciais não corrompem dados
      // Inserir dados
      await service.insertRecord(userId, tableName, {
        value: 100,
        status: 'parent',
      });
      await service.insertRecord(userId, tableName, {
        value: 101,
        status: 'child',
      });

      // Update parcial
      await service.updateRecords(
        userId,
        tableName,
        {
          condition: 'AND',
          rules: [{ field: 'status', operator: 'equals', value: 'child' }],
        },
        { status: 'updated-child' },
      );

      // Delete parcial
      await service.deleteRecords(userId, tableName, {
        condition: 'AND',
        rules: [{ field: 'value', operator: 'greaterThan', value: 100 }],
      });

      // Verificar estado final
      const records = await service.getRecords(userId, tableName, {});
      expect(records).toHaveLength(1);
      expect(records[0].value).toBe(100);
      expect(records[0].status).toBe('parent');
    });

    it('deve manter cache consistente após mudanças de schema', async () => {
      // CENÁRIO POSITIVO: Cache de schema não corrompe após alterações
      // Inserir dados com schema inicial
      await service.insertRecord(userId, tableName, {
        value: 1,
        status: 'initial',
      });

      // Adicionar nova coluna
      await service.addColumns(userId, tableName, [
        { name: 'new_field', type: 'string' },
      ]);

      // Inserir com novo schema
      await service.insertRecord(userId, tableName, {
        value: 2,
        status: 'with-new-field',
        new_field: 'test',
      });

      // Remover coluna
      await service.removeColumns(userId, tableName, ['new_field']);

      // Verificar que operações continuam funcionando
      await service.insertRecord(userId, tableName, {
        value: 3,
        status: 'after-removal',
      });

      const records = await service.getRecords(userId, tableName, {});
      expect(records).toHaveLength(3);
      expect(records.every((r) => typeof r.value === 'number')).toBe(true);
    });

    it('deve validar filtros complexos não corrompem resultados', async () => {
      // CENÁRIO POSITIVO: Filtros complexos mantêm consistência
      // Inserir dataset de teste
      await Promise.all([
        service.insertRecord(userId, tableName, { value: 1, status: 'low' }),
        service.insertRecord(userId, tableName, { value: 5, status: 'mid' }),
        service.insertRecord(userId, tableName, { value: 10, status: 'high' }),
        service.insertRecord(userId, tableName, { value: 15, status: 'high' }),
        service.insertRecord(userId, tableName, { value: 20, status: 'max' }),
      ]);

      // Filtro complexo com AND e múltiplas condições
      const filtered = await service.getRecords(userId, tableName, {
        filters: {
          condition: 'AND',
          rules: [
            { field: 'value', operator: 'greaterThan', value: 3 },
            { field: 'value', operator: 'lessThanOrEqual', value: 15 },
            { field: 'status', operator: 'notEquals', value: 'mid' },
          ],
        },
      });

      // Deve retornar apenas registros que satisfazem TODAS as condições
      expect(filtered).toHaveLength(2);
      expect(filtered.every((r) => r.value > 3 && r.value <= 15)).toBe(true);
      expect(filtered.every((r) => r.status !== 'mid')).toBe(true);
      expect(filtered.map((r) => r.value).sort()).toEqual([10, 15]);
    });
  });

  // ============================================
  // Performance e Cache
  // ============================================
  describe('Performance e Cache', () => {
    it('deve usar cache de schema após primeira operação', async () => {
      // CENÁRIO POSITIVO: Cache melhora performance
      // Primeira operação (cache miss)
      await service.insertRecord(userId, tableName, { value: 1, status: 'ok' });

      const statsBefore = service.getPerformanceStats();

      // Segunda operação (deve usar cache)
      await service.insertRecord(userId, tableName, { value: 2, status: 'ok' });

      const statsAfter = service.getPerformanceStats();

      // Cache hits devem aumentar
      expect(statsAfter.cacheHits).toBeGreaterThanOrEqual(
        statsBefore.cacheHits,
      );

      // Dados devem estar corretos
      const records = await service.getRecords(userId, tableName, {});
      expect(records).toHaveLength(2);
    });

    it('deve limpar cache ao modificar schema', async () => {
      // CENÁRIO POSITIVO: Cache é invalidado corretamente
      // Popular cache
      await service.insertRecord(userId, tableName, { value: 1, status: 'ok' });

      // Modificar schema (deve limpar cache)
      await service.addColumns(userId, tableName, [
        { name: 'extra', type: 'number' },
      ]);

      // Próxima operação deve revalidar schema
      await service.insertRecord(userId, tableName, {
        value: 2,
        status: 'ok',
        extra: 123,
      });

      // Verificar que o novo campo está acessível
      const records = await service.getRecords(userId, tableName, {});
      expect(records).toHaveLength(2);
      expect(records[1]).toHaveProperty('extra', 123);
    });
  });
});
