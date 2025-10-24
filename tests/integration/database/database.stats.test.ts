// ============================================
// TESTES DE ESTATÍSTICAS - DatabaseNodeService
// ============================================

import {
  createTestService,
  generateTestUserId,
  expectErrorCode,
} from '../setup';
import { DatabaseNodeService } from '@/services/database/database.service';

describe('DatabaseNodeService - Estatísticas', () => {
  let service: DatabaseNodeService;
  let userId: string;

  beforeEach(async () => {
    service = createTestService();
    userId = generateTestUserId();

    // Criar tabela de teste
    await service.addColumns(userId, 'stats_test', [
      { name: 'title', type: 'string', required: true },
      { name: 'priority', type: 'number' },
    ]);
  });

  // ============================================
  // 12.1. getTableStats
  // ============================================
  describe('getTableStats', () => {
    it('deve retornar estrutura correta de stats', async () => {
      const stats = await service.getTableStats(userId, 'stats_test');

      expect(stats).toMatchObject({
        tableName: expect.any(String),
        totalPartitions: expect.any(Number),
        totalRecords: expect.any(Number),
        fullPartitions: expect.any(Number),
        activePartition: expect.any(Number),
        schema: expect.any(Object),
      });

      expect(stats.schema.columns).toBeDefined();
      expect(Array.isArray(stats.schema.columns)).toBe(true);
    });

    it('stats iniciais devem refletir tabela vazia', async () => {
      const stats = await service.getTableStats(userId, 'stats_test');

      expect(stats.tableName).toBe('stats_test');
      expect(stats.totalPartitions).toBe(1); // Partição 0 sempre existe
      expect(stats.totalRecords).toBe(0);
      expect(stats.fullPartitions).toBe(0);
      expect(stats.activePartition).toBe(0);
      expect(stats.schema.columns).toHaveLength(2); // title e priority
    });

    it('stats devem atualizar após inserções', async () => {
      // Inserir 3 registros
      for (let i = 0; i < 3; i++) {
        await service.insertRecord(userId, 'stats_test', {
          title: `Task ${i}`,
          priority: i,
        });
      }

      const stats = await service.getTableStats(userId, 'stats_test');

      expect(stats.totalRecords).toBe(3);
      expect(stats.totalPartitions).toBe(1);
      expect(stats.fullPartitions).toBe(0); // Ainda não está cheia (MAX = 5)
      expect(stats.activePartition).toBe(0);
    });

    it('stats devem mostrar partição cheia corretamente', async () => {
      // Inserir 5 registros (encher primeira partição)
      for (let i = 0; i < 5; i++) {
        await service.insertRecord(userId, 'stats_test', {
          title: `Task ${i}`,
          priority: i,
        });
      }

      const stats = await service.getTableStats(userId, 'stats_test');

      expect(stats.totalRecords).toBe(5);
      expect(stats.totalPartitions).toBe(1);
      expect(stats.fullPartitions).toBe(1); // Primeira partição cheia
      expect(stats.activePartition).toBeNull(); // Nenhuma partição ativa (todas cheias)
    });

    it('stats devem refletir múltiplas partições', async () => {
      // Inserir 8 registros (2 partições: 5 + 3)
      for (let i = 0; i < 8; i++) {
        await service.insertRecord(userId, 'stats_test', {
          title: `Task ${i}`,
          priority: i,
        });
      }

      const stats = await service.getTableStats(userId, 'stats_test');

      expect(stats.totalRecords).toBe(8);
      expect(stats.totalPartitions).toBe(2);
      expect(stats.fullPartitions).toBe(1); // Primeira partição cheia
      expect(stats.activePartition).toBe(1); // Segunda partição ativa
    });

    it('stats devem atualizar após deleções', async () => {
      // Inserir 5 registros
      for (let i = 0; i < 5; i++) {
        await service.insertRecord(userId, 'stats_test', {
          title: `Task ${i}`,
          priority: i,
        });
      }

      // Verificar estado inicial
      let stats = await service.getTableStats(userId, 'stats_test');
      expect(stats.totalRecords).toBe(5);
      expect(stats.fullPartitions).toBe(1);

      // Deletar 2 registros
      await service.deleteRecords(userId, 'stats_test', {
        condition: 'AND',
        rules: [{ field: 'priority', operator: 'lessThan', value: 2 }],
      });

      // Verificar estado atualizado
      stats = await service.getTableStats(userId, 'stats_test');
      expect(stats.totalRecords).toBe(3);
      expect(stats.fullPartitions).toBe(0); // Partição não está mais cheia
      expect(stats.activePartition).toBe(0); // Partição 0 está ativa novamente
    });

    it('stats devem refletir schema atualizado', async () => {
      // Stats iniciais
      let stats = await service.getTableStats(userId, 'stats_test');
      expect(stats.schema.columns).toHaveLength(2);

      // Adicionar coluna
      await service.addColumns(userId, 'stats_test', [
        { name: 'status', type: 'string' },
      ]);

      // Stats atualizadas
      stats = await service.getTableStats(userId, 'stats_test');
      expect(stats.schema.columns).toHaveLength(3);
      expect(stats.schema.columns[2].name).toBe('status');

      // Remover coluna
      await service.removeColumns(userId, 'stats_test', ['priority']);

      // Stats atualizadas novamente
      stats = await service.getTableStats(userId, 'stats_test');
      expect(stats.schema.columns).toHaveLength(2);
      expect(
        stats.schema.columns.find((c) => c.name === 'priority'),
      ).toBeUndefined();
    });

    it('deve lançar erro para tabela inexistente', async () => {
      await expectErrorCode(
        service.getTableStats(userId, 'nonexistent_table'),
        'TABLE_NOT_FOUND',
      );
    });
  });

  // ============================================
  // 12.2. Stats com Diferentes Cenários
  // ============================================
  describe('Stats em Cenários Diversos', () => {
    it('stats com 3 partições (todas cheias)', async () => {
      // Inserir 15 registros (3 partições cheias)
      for (let i = 0; i < 15; i++) {
        await service.insertRecord(userId, 'stats_test', {
          title: `Task ${i}`,
          priority: i,
        });
      }

      const stats = await service.getTableStats(userId, 'stats_test');

      expect(stats.totalRecords).toBe(15);
      expect(stats.totalPartitions).toBe(3);
      expect(stats.fullPartitions).toBe(3); // Todas cheias
      expect(stats.activePartition).toBeNull(); // Nenhuma ativa
    });

    it('stats após updates não devem mudar contagens', async () => {
      // Inserir registros
      for (let i = 0; i < 5; i++) {
        await service.insertRecord(userId, 'stats_test', {
          title: `Task ${i}`,
          priority: i,
        });
      }

      // Stats antes do update
      let statsBefore = await service.getTableStats(userId, 'stats_test');

      // Atualizar todos
      await service.updateRecords(
        userId,
        'stats_test',
        { condition: 'AND', rules: [] },
        { priority: 999 },
      );

      // Stats depois do update
      let statsAfter = await service.getTableStats(userId, 'stats_test');

      // Contagens devem permanecer iguais
      expect(statsAfter.totalRecords).toBe(statsBefore.totalRecords);
      expect(statsAfter.totalPartitions).toBe(statsBefore.totalPartitions);
      expect(statsAfter.fullPartitions).toBe(statsBefore.fullPartitions);
    });

    it('stats de múltiplas tabelas devem ser independentes', async () => {
      // Criar segunda tabela
      await service.addColumns(userId, 'stats_test_2', [
        { name: 'data', type: 'string' },
      ]);

      // Inserir registros em ambas
      await service.insertRecord(userId, 'stats_test', {
        title: 'Task 1',
      });

      await service.insertRecord(userId, 'stats_test_2', {
        data: 'Data 1',
      });
      await service.insertRecord(userId, 'stats_test_2', {
        data: 'Data 2',
      });

      // Verificar stats independentes
      const stats1 = await service.getTableStats(userId, 'stats_test');
      const stats2 = await service.getTableStats(userId, 'stats_test_2');

      expect(stats1.totalRecords).toBe(1);
      expect(stats2.totalRecords).toBe(2);
      expect(stats1.schema.columns).toHaveLength(2);
      expect(stats2.schema.columns).toHaveLength(1);
    });

    it('stats devem mostrar activePartition corretamente após atingir limite', async () => {
      // Inserir até encher a primeira partição
      for (let i = 0; i < 5; i++) {
        await service.insertRecord(userId, 'stats_test', {
          title: `Task ${i}`,
        });
      }

      // Partição 0 cheia, nenhuma ativa
      let stats = await service.getTableStats(userId, 'stats_test');
      expect(stats.activePartition).toBeNull();

      // Inserir mais um (criar partição 1)
      await service.insertRecord(userId, 'stats_test', {
        title: 'Task 5',
      });

      // Partição 1 está ativa
      stats = await service.getTableStats(userId, 'stats_test');
      expect(stats.activePartition).toBe(1);
    });
  });

  // ============================================
  // 12.3. Consistência de Stats
  // ============================================
  describe('Consistência de Stats', () => {
    it('soma de registros em todas as partições deve igualar totalRecords', async () => {
      // Inserir 12 registros (3 partições: 5 + 5 + 2)
      for (let i = 0; i < 12; i++) {
        await service.insertRecord(userId, 'stats_test', {
          title: `Task ${i}`,
        });
      }

      const stats = await service.getTableStats(userId, 'stats_test');

      // Buscar todos os registros reais
      const allRecords = await service.getRecords(userId, 'stats_test', {});

      // Total em stats deve bater com registros reais
      expect(stats.totalRecords).toBe(allRecords.length);
      expect(stats.totalRecords).toBe(12);
    });

    it('fullPartitions deve ser consistente com tamanho das partições', async () => {
      // Inserir 10 registros (2 partições: 5 + 5)
      for (let i = 0; i < 10; i++) {
        await service.insertRecord(userId, 'stats_test', {
          title: `Task ${i}`,
        });
      }

      const stats = await service.getTableStats(userId, 'stats_test');

      expect(stats.totalPartitions).toBe(2);
      expect(stats.fullPartitions).toBe(2); // Ambas cheias
      expect(stats.totalRecords).toBe(10); // 5 + 5
    });
  });
});
