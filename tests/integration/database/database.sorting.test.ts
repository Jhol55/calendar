// ============================================
// TESTES DE ORDENAÇÃO - DatabaseNodeService
// ============================================

import { createTestService, generateTestUserId } from './setup';
import { DatabaseNodeService } from '@/services/database/database.service';

describe('DatabaseNodeService - Ordenação', () => {
  let service: DatabaseNodeService;
  let userId: string;

  beforeEach(async () => {
    service = createTestService();
    userId = generateTestUserId();

    // Criar tabela de teste
    await service.addColumns(userId, 'sort_test', [
      { name: 'value', type: 'number' },
      { name: 'text', type: 'string' },
      { name: 'date', type: 'date' },
      { name: 'nullable', type: 'number' },
    ]);
  });

  // ============================================
  // 6.1. sortRecords
  // ============================================
  describe('sortRecords', () => {
    it('asc: [1,3,5,2,4] → [1,2,3,4,5]', async () => {
      // Inserir números desordenados
      await service.insertRecord(userId, 'sort_test', { value: 1 });
      await service.insertRecord(userId, 'sort_test', { value: 3 });
      await service.insertRecord(userId, 'sort_test', { value: 5 });
      await service.insertRecord(userId, 'sort_test', { value: 2 });
      await service.insertRecord(userId, 'sort_test', { value: 4 });

      const results = await service.getRecords(userId, 'sort_test', {
        sort: { field: 'value', order: 'asc' },
      });

      expect(results.map((r) => r.value)).toEqual([1, 2, 3, 4, 5]);
    });

    it('desc: [1,3,5,2,4] → [5,4,3,2,1]', async () => {
      // Inserir números desordenados
      await service.insertRecord(userId, 'sort_test', { value: 1 });
      await service.insertRecord(userId, 'sort_test', { value: 3 });
      await service.insertRecord(userId, 'sort_test', { value: 5 });
      await service.insertRecord(userId, 'sort_test', { value: 2 });
      await service.insertRecord(userId, 'sort_test', { value: 4 });

      const results = await service.getRecords(userId, 'sort_test', {
        sort: { field: 'value', order: 'desc' },
      });

      expect(results.map((r) => r.value)).toEqual([5, 4, 3, 2, 1]);
    });

    it('null/undefined devem ir para o fim (asc)', async () => {
      await service.insertRecord(userId, 'sort_test', {
        value: 10,
        nullable: 5,
      });
      await service.insertRecord(userId, 'sort_test', {
        value: 20,
        nullable: null,
      });
      await service.insertRecord(userId, 'sort_test', {
        value: 30,
        nullable: 1,
      });
      await service.insertRecord(userId, 'sort_test', {
        value: 40,
        nullable: undefined,
      });
      await service.insertRecord(userId, 'sort_test', {
        value: 50,
        nullable: 3,
      });

      const results = await service.getRecords(userId, 'sort_test', {
        sort: { field: 'nullable', order: 'asc' },
      });

      const values = results.map((r) => r.nullable);

      // Os valores numéricos devem vir primeiro, ordenados
      expect(values[0]).toBe(1);
      expect(values[1]).toBe(3);
      expect(values[2]).toBe(5);

      // null/undefined devem estar no final
      expect([null, undefined]).toContain(values[3]);
      expect([null, undefined]).toContain(values[4]);
    });

    it('null/undefined devem ir para o fim (desc)', async () => {
      await service.insertRecord(userId, 'sort_test', {
        value: 10,
        nullable: 5,
      });
      await service.insertRecord(userId, 'sort_test', {
        value: 20,
        nullable: null,
      });
      await service.insertRecord(userId, 'sort_test', {
        value: 30,
        nullable: 1,
      });
      await service.insertRecord(userId, 'sort_test', {
        value: 40,
        nullable: undefined,
      });
      await service.insertRecord(userId, 'sort_test', {
        value: 50,
        nullable: 3,
      });

      const results = await service.getRecords(userId, 'sort_test', {
        sort: { field: 'nullable', order: 'desc' },
      });

      const values = results.map((r) => r.nullable);

      // Os valores numéricos devem vir primeiro, ordenados decrescente
      expect(values[0]).toBe(5);
      expect(values[1]).toBe(3);
      expect(values[2]).toBe(1);

      // null/undefined devem estar no final
      expect([null, undefined]).toContain(values[3]);
      expect([null, undefined]).toContain(values[4]);
    });

    it('ordenação alfabética de strings (asc)', async () => {
      await service.insertRecord(userId, 'sort_test', { text: 'Zebra' });
      await service.insertRecord(userId, 'sort_test', { text: 'Apple' });
      await service.insertRecord(userId, 'sort_test', { text: 'Mango' });
      await service.insertRecord(userId, 'sort_test', { text: 'Banana' });

      const results = await service.getRecords(userId, 'sort_test', {
        sort: { field: 'text', order: 'asc' },
      });

      expect(results.map((r) => r.text)).toEqual([
        'Apple',
        'Banana',
        'Mango',
        'Zebra',
      ]);
    });

    it('ordenação alfabética de strings (desc)', async () => {
      await service.insertRecord(userId, 'sort_test', { text: 'Zebra' });
      await service.insertRecord(userId, 'sort_test', { text: 'Apple' });
      await service.insertRecord(userId, 'sort_test', { text: 'Mango' });
      await service.insertRecord(userId, 'sort_test', { text: 'Banana' });

      const results = await service.getRecords(userId, 'sort_test', {
        sort: { field: 'text', order: 'desc' },
      });

      expect(results.map((r) => r.text)).toEqual([
        'Zebra',
        'Mango',
        'Banana',
        'Apple',
      ]);
    });

    it('ordenação de datas (asc)', async () => {
      await service.insertRecord(userId, 'sort_test', { date: '2024-03-15' });
      await service.insertRecord(userId, 'sort_test', { date: '2024-01-10' });
      await service.insertRecord(userId, 'sort_test', { date: '2024-12-25' });
      await service.insertRecord(userId, 'sort_test', { date: '2024-06-20' });

      const results = await service.getRecords(userId, 'sort_test', {
        sort: { field: 'date', order: 'asc' },
      });

      expect(results.map((r) => r.date)).toEqual([
        '2024-01-10',
        '2024-03-15',
        '2024-06-20',
        '2024-12-25',
      ]);
    });

    it('ordenação de datas (desc)', async () => {
      await service.insertRecord(userId, 'sort_test', { date: '2024-03-15' });
      await service.insertRecord(userId, 'sort_test', { date: '2024-01-10' });
      await service.insertRecord(userId, 'sort_test', { date: '2024-12-25' });
      await service.insertRecord(userId, 'sort_test', { date: '2024-06-20' });

      const results = await service.getRecords(userId, 'sort_test', {
        sort: { field: 'date', order: 'desc' },
      });

      expect(results.map((r) => r.date)).toEqual([
        '2024-12-25',
        '2024-06-20',
        '2024-03-15',
        '2024-01-10',
      ]);
    });
  });
});
