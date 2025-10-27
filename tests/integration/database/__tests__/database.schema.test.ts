// ============================================
// TESTES DE SCHEMA - DatabaseService
// ============================================

import { createTestService, generateStringUserId } from '../../setup';
import { DatabaseService } from '@/services/database/database.service';

describe('DatabaseService - Schema', () => {
  console.log('\n📋 INICIANDO: DatabaseService - Schema');

  let service: DatabaseService;
  let userId: string;

  beforeEach(() => {
    service = createTestService();
    userId = generateStringUserId();
  });

  // ============================================
  // 7.1. Fluxo de Criação/Modificação
  // ============================================
  describe('Fluxo de Criação/Modificação', () => {
    console.log('  📂 Grupo: Fluxo de Criação/Modificação');

    it('deve criar tabela com addColumns', async () => {
      console.log('    ✓ Teste: deve criar tabela com addColumns');
      const schema = await service.addColumns(userId, 'tasks', [
        { name: 'title', type: 'string', required: true },
      ]);

      expect(schema.columns).toHaveLength(1);
      expect(schema.columns[0]).toMatchObject({
        name: 'title',
        type: 'string',
        required: true,
      });
    });

    it('deve adicionar colunas a tabela existente', async () => {
      console.log('    ✓ Teste: deve adicionar colunas a tabela existente');
      // 1. Criar tabela
      await service.addColumns(userId, 'tasks', [
        { name: 'title', type: 'string', required: true },
      ]);

      // 2. Adicionar mais colunas
      const schema = await service.addColumns(userId, 'tasks', [
        { name: 'priority', type: 'number', default: 1 },
      ]);

      // 3. Verificar schema atualizado
      expect(schema.columns).toHaveLength(2);
      expect(schema.columns[1]).toMatchObject({
        name: 'priority',
        type: 'number',
        default: 1,
      });
    });

    it('deve manter dados ao adicionar colunas', async () => {
      console.log('    ✓ Teste: deve manter dados ao adicionar colunas');
      // 1. Criar tabela e inserir dados
      await service.addColumns(userId, 'tasks', [
        { name: 'title', type: 'string', required: true },
      ]);

      await service.insertRecord(userId, 'tasks', { title: 'Task 1' });
      await service.insertRecord(userId, 'tasks', { title: 'Task 2' });

      // 2. Adicionar nova coluna
      await service.addColumns(userId, 'tasks', [
        { name: 'status', type: 'string', default: 'pending' },
      ]);

      // 3. Verificar que dados antigos ainda existem
      const records = await service.getRecords(userId, 'tasks', {});

      expect(records).toHaveLength(2);
      expect(records[0].title).toBeDefined();
      expect(records[1].title).toBeDefined();
    });

    it('não deve duplicar colunas existentes', async () => {
      console.log('    ✓ Teste: não deve duplicar colunas existentes');
      // 1. Criar tabela
      await service.addColumns(userId, 'tasks', [
        { name: 'title', type: 'string' },
      ]);

      // 2. Tentar adicionar a mesma coluna novamente
      const schema = await service.addColumns(userId, 'tasks', [
        { name: 'title', type: 'string' }, // Mesma coluna
      ]);

      // 3. Deve manter apenas uma coluna
      expect(schema.columns).toHaveLength(1);
    });
  });

  // ============================================
  // 7.2. Remoção de Colunas
  // ============================================
  describe('Remoção de Colunas', () => {
    console.log('  📂 Grupo: Remoção de Colunas');
    beforeEach(async () => {
      // Criar tabela com múltiplas colunas
      await service.addColumns(userId, 'tasks', [
        { name: 'title', type: 'string', required: true },
        { name: 'priority', type: 'number', default: 1 },
        { name: 'status', type: 'string' },
      ]);

      // Inserir alguns registros
      await service.insertRecord(userId, 'tasks', {
        title: 'Task 1',
        priority: 1,
        status: 'pending',
      });

      await service.insertRecord(userId, 'tasks', {
        title: 'Task 2',
        priority: 2,
        status: 'done',
      });
    });

    it('deve remover coluna do schema', async () => {
      console.log('    ✓ Teste: deve remover coluna do schema');
      const schema = await service.removeColumns(userId, 'tasks', ['priority']);

      expect(schema.columns).toHaveLength(2);
      expect(schema.columns.find((c) => c.name === 'priority')).toBeUndefined();
      expect(schema.columns.find((c) => c.name === 'title')).toBeDefined();
      expect(schema.columns.find((c) => c.name === 'status')).toBeDefined();
    });

    it('deve remover coluna dos dados existentes', async () => {
      console.log('    ✓ Teste: deve remover coluna dos dados existentes');
      await service.removeColumns(userId, 'tasks', ['priority']);

      const records = await service.getRecords(userId, 'tasks', {});

      expect(records).toHaveLength(2);

      // Verificar que priority foi removida dos dados
      records.forEach((r) => {
        expect(r.priority).toBeUndefined();
        expect(r.title).toBeDefined(); // Outras colunas devem permanecer
        expect(r.status).toBeDefined();
      });
    });

    it('deve remover múltiplas colunas de uma vez', async () => {
      console.log('    ✓ Teste: deve remover múltiplas colunas de uma vez');
      const schema = await service.removeColumns(userId, 'tasks', [
        'priority',
        'status',
      ]);

      expect(schema.columns).toHaveLength(1);
      expect(schema.columns[0].name).toBe('title');

      const records = await service.getRecords(userId, 'tasks', {});

      records.forEach((r) => {
        expect(r.priority).toBeUndefined();
        expect(r.status).toBeUndefined();
        expect(r.title).toBeDefined();
      });
    });

    it('deve manter dados se remover coluna inexistente', async () => {
      console.log(
        '    ✓ Teste: deve manter dados se remover coluna inexistente',
      );
      await service.removeColumns(userId, 'tasks', ['nonexistent_column']);

      const records = await service.getRecords(userId, 'tasks', {});

      expect(records).toHaveLength(2);
      expect(records[0].title).toBeDefined();
      expect(records[0].priority).toBeDefined();
      expect(records[0].status).toBeDefined();
    });
  });

  // ============================================
  // 7.3. Verificar stats após modificação de schema
  // ============================================
  describe('Stats após modificação de schema', () => {
    console.log('  📂 Grupo: Stats após modificação de schema');

    it('stats devem refletir schema atualizado', async () => {
      console.log('    ✓ Teste: stats devem refletir schema atualizado');
      // Criar tabela
      await service.addColumns(userId, 'test_stats', [
        { name: 'field1', type: 'string' },
      ]);

      // Verificar stats
      let stats = await service.getTableStats(userId, 'test_stats');
      expect(stats.schema.columns).toHaveLength(1);

      // Adicionar coluna
      await service.addColumns(userId, 'test_stats', [
        { name: 'field2', type: 'number' },
      ]);

      // Verificar stats atualizadas
      stats = await service.getTableStats(userId, 'test_stats');
      expect(stats.schema.columns).toHaveLength(2);

      // Remover coluna
      await service.removeColumns(userId, 'test_stats', ['field1']);

      // Verificar stats atualizadas
      stats = await service.getTableStats(userId, 'test_stats');
      expect(stats.schema.columns).toHaveLength(1);
      expect(stats.schema.columns[0].name).toBe('field2');
    });
  });
});
