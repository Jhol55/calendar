// ============================================
// TESTES DE SEGURANÇA - DatabaseNodeService
// ============================================

import {
  createTestService,
  createTestServiceWithConfig,
  generateTestUserId,
  expectErrorCode,
} from '../setup';
import { DatabaseNodeService } from '@/services/database/database.service';

describe('DatabaseNodeService - Segurança e Limites', () => {
  let service: DatabaseNodeService;
  let userId1: string;
  let userId2: string;

  beforeEach(() => {
    service = createTestService();
    userId1 = generateTestUserId();
    userId2 = generateTestUserId();
  });

  // ============================================
  // 10.1. checkTableLimit (MAX_TABLES = 2)
  // ============================================
  describe('Limite de Tabelas', () => {
    it('deve permitir criar até MAX_TABLES tabelas', async () => {
      // Criar 2 tabelas (MAX_TABLES = 2)
      await service.addColumns(userId1, 'table1', [
        { name: 'field', type: 'string' },
      ]);

      await service.addColumns(userId1, 'table2', [
        { name: 'field', type: 'string' },
      ]);

      // Verificar que ambas foram criadas
      const stats1 = await service.getTableStats(userId1, 'table1');
      const stats2 = await service.getTableStats(userId1, 'table2');

      expect(stats1).toBeDefined();
      expect(stats2).toBeDefined();
    });

    it('deve lançar erro TABLE_LIMIT ao tentar criar 3ª tabela', async () => {
      // Criar 2 tabelas
      await service.addColumns(userId1, 'table1', [
        { name: 'field', type: 'string' },
      ]);

      await service.addColumns(userId1, 'table2', [
        { name: 'field', type: 'string' },
      ]);

      // Tentar criar 3ª tabela → deve falhar
      await expectErrorCode(
        service.addColumns(userId1, 'table3', [
          { name: 'field', type: 'string' },
        ]),
        'TABLE_LIMIT',
      );
    });

    it('limite de tabelas deve ser por usuário', async () => {
      // User 1 cria 2 tabelas
      await service.addColumns(userId1, 'table1', [
        { name: 'field', type: 'string' },
      ]);

      await service.addColumns(userId1, 'table2', [
        { name: 'field', type: 'string' },
      ]);

      // User 2 deve conseguir criar suas próprias tabelas
      await expect(
        service.addColumns(userId2, 'table1', [
          { name: 'field', type: 'string' },
        ]),
      ).resolves.toBeDefined();

      await expect(
        service.addColumns(userId2, 'table2', [
          { name: 'field', type: 'string' },
        ]),
      ).resolves.toBeDefined();
    });
  });

  // ============================================
  // 10.2. verifyTableOwnership
  // ============================================
  describe('Verificação de Propriedade', () => {
    beforeEach(async () => {
      // User 1 cria uma tabela
      await service.addColumns(userId1, 'user1_table', [
        { name: 'data', type: 'string', required: true },
      ]);

      await service.insertRecord(userId1, 'user1_table', {
        data: 'User 1 data',
      });
    });

    it('dono da tabela deve ter acesso completo', async () => {
      // User 1 deve conseguir ler
      const records = await service.getRecords(userId1, 'user1_table', {});
      expect(records).toHaveLength(1);

      // User 1 deve conseguir inserir
      await expect(
        service.insertRecord(userId1, 'user1_table', { data: 'More data' }),
      ).resolves.toBeDefined();

      // User 1 deve conseguir atualizar
      await expect(
        service.updateRecords(
          userId1,
          'user1_table',
          { condition: 'AND', rules: [] },
          { data: 'Updated' },
        ),
      ).resolves.toBeDefined();

      // User 1 deve conseguir deletar
      await expect(
        service.deleteRecords(userId1, 'user1_table', {
          condition: 'AND',
          rules: [],
        }),
      ).resolves.toBeDefined();
    });

    it('outro usuário NÃO deve conseguir ler tabela alheia', async () => {
      // User2 tenta ler "user1_table" → TABLE_NOT_FOUND (não existe no namespace dele)
      await expectErrorCode(
        service.getRecords(userId2, 'user1_table', {}),
        'TABLE_NOT_FOUND',
      );
    });

    it('outro usuário NÃO deve conseguir inserir em tabela alheia', async () => {
      // User2 tenta inserir em "user1_table" → TABLE_NOT_FOUND
      await expectErrorCode(
        service.insertRecord(userId2, 'user1_table', { data: 'Hacked data' }),
        'TABLE_NOT_FOUND',
      );
    });

    it('outro usuário NÃO deve conseguir atualizar tabela alheia', async () => {
      // User2 tenta atualizar "user1_table" → TABLE_NOT_FOUND
      await expectErrorCode(
        service.updateRecords(
          userId2,
          'user1_table',
          { condition: 'AND', rules: [] },
          { data: 'Hacked' },
        ),
        'TABLE_NOT_FOUND',
      );
    });

    it('outro usuário NÃO deve conseguir deletar da tabela alheia', async () => {
      // User2 tenta deletar de "user1_table" → TABLE_NOT_FOUND
      await expectErrorCode(
        service.deleteRecords(userId2, 'user1_table', {
          condition: 'AND',
          rules: [],
        }),
        'TABLE_NOT_FOUND',
      );
    });

    it('outro usuário NÃO deve conseguir ver stats da tabela alheia', async () => {
      // User2 tenta ver stats de "user1_table" → TABLE_NOT_FOUND
      await expectErrorCode(
        service.getTableStats(userId2, 'user1_table'),
        'TABLE_NOT_FOUND',
      );
    });

    it('outro usuário NÃO deve conseguir modificar schema da tabela alheia', async () => {
      // User2 tenta modificar schema de "user1_table"
      // Como a tabela não existe no namespace dele, deveria criar uma NOVA tabela
      // Este teste está INCORRETO - deveria passar!
      const schema = await service.addColumns(userId2, 'user1_table', [
        { name: 'hacked_field', type: 'string' },
      ]);
      expect(schema).toBeDefined();
      expect(schema.columns[0].name).toBe('hacked_field');

      // Verificar que são tabelas DIFERENTES
      const user1Stats = await service.getTableStats(userId1, 'user1_table');
      const user2Stats = await service.getTableStats(userId2, 'user1_table');

      expect(user1Stats.totalRecords).toBe(1); // User1 tem 1 registro
      expect(user2Stats.totalRecords).toBe(0); // User2 tem tabela vazia
    });
  });

  // ============================================
  // 10.3. checkRateLimit
  // ============================================
  describe('Rate Limiting', () => {
    it('deve permitir operações dentro do limite', async () => {
      // Criar tabela
      await service.addColumns(userId1, 'rate_test', [
        { name: 'data', type: 'string' },
      ]);

      // Fazer múltiplas operações (todas devem passar)
      for (let i = 0; i < 10; i++) {
        await expect(
          service.insertRecord(userId1, 'rate_test', { data: `Record ${i}` }),
        ).resolves.toBeDefined();
      }
    });

    it('deve bloquear operações após exceder rate limit', async () => {
      // Criar serviço com limite de rate muito baixo para teste
      const serviceWithLowLimit = createTestServiceWithConfig({
        RATE_LIMIT_MAX_OPS: 5, // Apenas 5 operações permitidas
        RATE_LIMIT_WINDOW_MS: 60 * 1000, // 1 minuto
      });

      // Criar tabela
      await serviceWithLowLimit.addColumns(userId1, 'rate_test_low', [
        { name: 'data', type: 'string' },
      ]);

      // Fazer 4 inserções (deve passar - estamos em 5 ops total com o addColumns)
      for (let i = 0; i < 4; i++) {
        await expect(
          serviceWithLowLimit.insertRecord(userId1, 'rate_test_low', {
            data: `Record ${i}`,
          }),
        ).resolves.toBeDefined();
      }

      // 6ª operação deve falhar (excede limite de 5)
      await expectErrorCode(
        serviceWithLowLimit.insertRecord(userId1, 'rate_test_low', {
          data: 'Should fail',
        }),
        'RATE_LIMIT_EXCEEDED',
      );
    });

    it('rate limit deve ser independente por usuário', async () => {
      // Criar tabelas para ambos os usuários
      await service.addColumns(userId1, 'user1_rate', [
        { name: 'data', type: 'string' },
      ]);

      await service.addColumns(userId2, 'user2_rate', [
        { name: 'data', type: 'string' },
      ]);

      // User 1 faz operações
      for (let i = 0; i < 5; i++) {
        await service.insertRecord(userId1, 'user1_rate', {
          data: `User1 Record ${i}`,
        });
      }

      // User 2 deve conseguir fazer suas operações independentemente
      for (let i = 0; i < 5; i++) {
        await expect(
          service.insertRecord(userId2, 'user2_rate', {
            data: `User2 Record ${i}`,
          }),
        ).resolves.toBeDefined();
      }
    });
  });

  // ============================================
  // 10.4. Validação de Entrada (Segurança)
  // ============================================
  describe('Validação de Entrada', () => {
    it('deve rejeitar nome de tabela com SQL injection', async () => {
      await expectErrorCode(
        service.addColumns(userId1, "table'; DROP TABLE users; --", [
          { name: 'field', type: 'string' },
        ]),
        'INVALID_TABLE_NAME',
      );
    });

    it('deve rejeitar nome de tabela com path traversal', async () => {
      await expectErrorCode(
        service.addColumns(userId1, '../../../etc/passwd', [
          { name: 'field', type: 'string' },
        ]),
        'INVALID_TABLE_NAME',
      );
    });

    it('deve rejeitar nome de coluna vazio ou inválido', async () => {
      await expectErrorCode(
        service.addColumns(userId1, 'test_table', [
          { name: '', type: 'string' } as any,
        ]),
        'INVALID_COLUMN',
      );
    });

    it('deve validar tipos de dados corretamente', async () => {
      await service.addColumns(userId1, 'validation_test', [
        { name: 'email', type: 'string' },
      ]);

      // Tentar inserir tipo incorreto
      await expectErrorCode(
        service.insertRecord(userId1, 'validation_test', {
          email: { invalid: 'object' },
        }),
        'INVALID_FIELD_TYPE',
      );
    });
  });

  // ============================================
  // 10.5. Isolamento de Dados
  // ============================================
  describe('Isolamento de Dados', () => {
    it('dados de diferentes usuários devem ser completamente isolados', async () => {
      // User 1 e User 2 criam tabelas com mesmo nome
      await service.addColumns(userId1, 'shared_name', [
        { name: 'owner', type: 'string' },
      ]);

      await service.addColumns(userId2, 'shared_name', [
        { name: 'owner', type: 'string' },
      ]);

      // Inserir dados
      await service.insertRecord(userId1, 'shared_name', { owner: 'User1' });
      await service.insertRecord(userId2, 'shared_name', { owner: 'User2' });

      // Verificar isolamento
      const user1Records = await service.getRecords(userId1, 'shared_name', {});
      const user2Records = await service.getRecords(userId2, 'shared_name', {});

      expect(user1Records).toHaveLength(1);
      expect(user1Records[0].owner).toBe('User1');

      expect(user2Records).toHaveLength(1);
      expect(user2Records[0].owner).toBe('User2');
    });

    it('operações de um usuário não devem afetar dados de outro', async () => {
      // Criar tabelas
      await service.addColumns(userId1, 'isolation_test', [
        { name: 'data', type: 'string' },
      ]);

      await service.addColumns(userId2, 'isolation_test', [
        { name: 'data', type: 'string' },
      ]);

      // Inserir dados
      await service.insertRecord(userId1, 'isolation_test', { data: 'User1' });
      await service.insertRecord(userId2, 'isolation_test', { data: 'User2' });

      // User 1 deleta seus dados
      await service.deleteRecords(userId1, 'isolation_test', {
        condition: 'AND',
        rules: [],
      });

      // User 2 ainda deve ter seus dados
      const user2Records = await service.getRecords(
        userId2,
        'isolation_test',
        {},
      );
      expect(user2Records).toHaveLength(1);
      expect(user2Records[0].data).toBe('User2');
    });
  });
});
