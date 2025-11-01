// ============================================
// TESTES DE UNIQUE CONSTRAINTS - DatabaseService
// Suite completa para validar constraint UNIQUE
// ============================================

import {
  createTestService,
  generateStringUserId,
  expectErrorCode,
} from '../../setup';
import { DatabaseService } from '@/services/database/database.service';

describe('DatabaseService - UNIQUE Constraints (Suite Completa)', () => {
  console.log('\n📋 INICIANDO: DatabaseService - UNIQUE Constraints');

  let service: DatabaseService;
  let userId: string;

  beforeEach(() => {
    service = createTestService();
    userId = generateStringUserId();
  });

  // ============================================
  // 1. UNIQUE Básico - INSERT
  // ============================================
  describe('UNIQUE Básico - INSERT', () => {
    console.log('  📂 Grupo: UNIQUE Básico - INSERT');

    beforeEach(async () => {
      await service.addColumns(userId, 'unique_basic', [
        { name: 'email', type: 'string', unique: true },
        { name: 'name', type: 'string' },
      ]);
    });

    it('✅ deve permitir inserir primeiro valor único', async () => {
      const record = await service.insertRecord(userId, 'unique_basic', {
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(record.email).toBe('test@example.com');
    });

    it('❌ deve rejeitar segundo valor duplicado', async () => {
      await service.insertRecord(userId, 'unique_basic', {
        email: 'test@example.com',
        name: 'User 1',
      });

      await expectErrorCode(
        service.insertRecord(userId, 'unique_basic', {
          email: 'test@example.com',
          name: 'User 2',
        }),
        'UNIQUE_CONSTRAINT_VIOLATION',
      );
    });

    it('✅ deve permitir valores diferentes', async () => {
      await service.insertRecord(userId, 'unique_basic', {
        email: 'user1@example.com',
        name: 'User 1',
      });

      const record2 = await service.insertRecord(userId, 'unique_basic', {
        email: 'user2@example.com',
        name: 'User 2',
      });

      expect(record2.email).toBe('user2@example.com');
    });
  });

  // ============================================
  // 2. UNIQUE Básico - UPDATE
  // ============================================
  describe('UNIQUE Básico - UPDATE', () => {
    console.log('  📂 Grupo: UNIQUE Básico - UPDATE');

    beforeEach(async () => {
      await service.addColumns(userId, 'unique_update', [
        { name: 'email', type: 'string', unique: true },
        { name: 'username', type: 'string' },
      ]);

      await service.insertRecord(userId, 'unique_update', {
        email: 'user1@example.com',
        username: 'user1',
      });
      await service.insertRecord(userId, 'unique_update', {
        email: 'user2@example.com',
        username: 'user2',
      });
    });

    it('❌ deve rejeitar UPDATE que cria duplicata', async () => {
      await expectErrorCode(
        service.updateRecords(
          userId,
          'unique_update',
          {
            condition: 'AND',
            rules: [{ field: 'username', operator: 'equals', value: 'user2' }],
          },
          { email: 'user1@example.com' },
        ),
        'UNIQUE_CONSTRAINT_VIOLATION',
      );
    });

    it('✅ deve permitir UPDATE do próprio registro', async () => {
      const result = await service.updateRecords(
        userId,
        'unique_update',
        {
          condition: 'AND',
          rules: [
            { field: 'email', operator: 'equals', value: 'user1@example.com' },
          ],
        },
        { username: 'updated_user1' },
      );

      expect(result.success).toBe(true);
      expect(result.affected).toBe(1);
    });

    it('✅ deve permitir UPDATE para valor único diferente', async () => {
      const result = await service.updateRecords(
        userId,
        'unique_update',
        {
          condition: 'AND',
          rules: [{ field: 'username', operator: 'equals', value: 'user2' }],
        },
        { email: 'user3@example.com' },
      );

      expect(result.success).toBe(true);
      expect(result.affected).toBe(1);
    });
  });

  // ============================================
  // 3. NULL Values em UNIQUE
  // ============================================
  describe('NULL Values em UNIQUE', () => {
    console.log('  📂 Grupo: NULL Values em UNIQUE');

    beforeEach(async () => {
      await service.addColumns(userId, 'unique_null', [
        { name: 'email', type: 'string', unique: true },
        { name: 'phone', type: 'string', unique: true },
      ]);
    });

    it('✅ deve permitir múltiplos NULL em coluna UNIQUE', async () => {
      await service.insertRecord(userId, 'unique_null', {
        email: null,
        phone: '1111111111',
      });

      const record2 = await service.insertRecord(userId, 'unique_null', {
        email: null,
        phone: '2222222222',
      });

      expect(record2.email).toBeNull();
    });

    it('✅ deve permitir múltiplos undefined em coluna UNIQUE', async () => {
      await service.insertRecord(userId, 'unique_null', {
        phone: '1111111111',
      });

      const record2 = await service.insertRecord(userId, 'unique_null', {
        phone: '2222222222',
      });

      expect(record2.email).toBeUndefined();
    });

    it('✅ deve permitir mistura de NULL e undefined', async () => {
      await service.insertRecord(userId, 'unique_null', {
        email: null,
        phone: '1111111111',
      });

      const record2 = await service.insertRecord(userId, 'unique_null', {
        // email: undefined
        phone: '2222222222',
      });

      expect(record2.email).toBeUndefined();
    });

    it('❌ deve rejeitar valor duplicado mesmo com outros NULLs', async () => {
      await service.insertRecord(userId, 'unique_null', {
        email: 'test@example.com',
        phone: null,
      });

      await expectErrorCode(
        service.insertRecord(userId, 'unique_null', {
          email: 'test@example.com',
          phone: null,
        }),
        'UNIQUE_CONSTRAINT_VIOLATION',
      );
    });
  });

  // ============================================
  // 4. Múltiplas Colunas UNIQUE
  // ============================================
  describe('Múltiplas Colunas UNIQUE', () => {
    console.log('  📂 Grupo: Múltiplas Colunas UNIQUE');

    beforeEach(async () => {
      await service.addColumns(userId, 'multi_unique', [
        { name: 'email', type: 'string', unique: true },
        { name: 'username', type: 'string', unique: true },
        { name: 'phone', type: 'string', unique: true },
        { name: 'age', type: 'number' },
      ]);
    });

    it('❌ deve rejeitar duplicata na primeira coluna UNIQUE', async () => {
      await service.insertRecord(userId, 'multi_unique', {
        email: 'test@example.com',
        username: 'user1',
        phone: '1111111111',
        age: 25,
      });

      await expectErrorCode(
        service.insertRecord(userId, 'multi_unique', {
          email: 'test@example.com',
          username: 'user2',
          phone: '2222222222',
          age: 30,
        }),
        'UNIQUE_CONSTRAINT_VIOLATION',
      );
    });

    it('❌ deve rejeitar duplicata na segunda coluna UNIQUE', async () => {
      await service.insertRecord(userId, 'multi_unique', {
        email: 'user1@example.com',
        username: 'testuser',
        phone: '1111111111',
        age: 25,
      });

      await expectErrorCode(
        service.insertRecord(userId, 'multi_unique', {
          email: 'user2@example.com',
          username: 'testuser',
          phone: '2222222222',
          age: 30,
        }),
        'UNIQUE_CONSTRAINT_VIOLATION',
      );
    });

    it('❌ deve rejeitar duplicata na terceira coluna UNIQUE', async () => {
      await service.insertRecord(userId, 'multi_unique', {
        email: 'user1@example.com',
        username: 'user1',
        phone: '1111111111',
        age: 25,
      });

      await expectErrorCode(
        service.insertRecord(userId, 'multi_unique', {
          email: 'user2@example.com',
          username: 'user2',
          phone: '1111111111',
          age: 30,
        }),
        'UNIQUE_CONSTRAINT_VIOLATION',
      );
    });

    it('✅ deve permitir quando todas as colunas UNIQUE são diferentes', async () => {
      await service.insertRecord(userId, 'multi_unique', {
        email: 'user1@example.com',
        username: 'user1',
        phone: '1111111111',
        age: 25,
      });

      const record2 = await service.insertRecord(userId, 'multi_unique', {
        email: 'user2@example.com',
        username: 'user2',
        phone: '2222222222',
        age: 30,
      });

      expect(record2.email).toBe('user2@example.com');
    });
  });

  // ============================================
  // 5. UNIQUE em Múltiplas Partições
  // ============================================
  describe('UNIQUE em Múltiplas Partições', () => {
    console.log('  📂 Grupo: UNIQUE em Múltiplas Partições');

    beforeEach(async () => {
      await service.addColumns(userId, 'partitions_unique', [
        { name: 'email', type: 'string', unique: true },
        { name: 'counter', type: 'number' },
      ]);
    });

    it('❌ deve rejeitar duplicata entre partições diferentes', async () => {
      // Inserir 105 registros para forçar múltiplas partições
      for (let i = 0; i < 105; i++) {
        await service.insertRecord(userId, 'partitions_unique', {
          email: `user${i}@example.com`,
          counter: i,
        });
      }

      // Tentar inserir duplicata (deve buscar em todas as partições)
      await expectErrorCode(
        service.insertRecord(userId, 'partitions_unique', {
          email: 'user50@example.com',
          counter: 999,
        }),
        'UNIQUE_CONSTRAINT_VIOLATION',
      );
    });

    it('✅ deve permitir valores únicos em múltiplas partições', async () => {
      // Inserir 110 registros únicos
      for (let i = 0; i < 110; i++) {
        await service.insertRecord(userId, 'partitions_unique', {
          email: `user${i}@example.com`,
          counter: i,
        });
      }

      const records = await service.getRecords(userId, 'partitions_unique');
      expect(records.length).toBe(110);

      // Verificar que todos os emails são únicos
      const emails = records.map((r) => r.email);
      const uniqueEmails = new Set(emails);
      expect(uniqueEmails.size).toBe(110);
    });
  });

  // ============================================
  // 6. findDuplicatesForUniqueColumn
  // ============================================
  describe('findDuplicatesForUniqueColumn', () => {
    console.log('  📂 Grupo: findDuplicatesForUniqueColumn');

    it('✅ deve detectar duplicatas simples', async () => {
      await service.addColumns(userId, 'find_dups', [
        { name: 'email', type: 'string' },
      ]);

      await service.insertRecord(userId, 'find_dups', {
        email: 'dup@example.com',
      });
      await service.insertRecord(userId, 'find_dups', {
        email: 'dup@example.com',
      });
      await service.insertRecord(userId, 'find_dups', {
        email: 'unique@example.com',
      });

      const duplicates = await service.findDuplicatesForUniqueColumn(
        userId,
        'find_dups',
        'email',
      );

      expect(duplicates.length).toBe(1);
      expect(duplicates[0].value).toBe('dup@example.com');
      expect(duplicates[0].count).toBe(2);
      expect(duplicates[0].ids.length).toBe(2);
    });

    it('✅ deve detectar múltiplos valores duplicados', async () => {
      await service.addColumns(userId, 'multi_dups', [
        { name: 'category', type: 'string' },
      ]);

      await service.insertRecord(userId, 'multi_dups', { category: 'A' });
      await service.insertRecord(userId, 'multi_dups', { category: 'A' });
      await service.insertRecord(userId, 'multi_dups', { category: 'B' });
      await service.insertRecord(userId, 'multi_dups', { category: 'B' });
      await service.insertRecord(userId, 'multi_dups', { category: 'B' });
      await service.insertRecord(userId, 'multi_dups', { category: 'C' });

      const duplicates = await service.findDuplicatesForUniqueColumn(
        userId,
        'multi_dups',
        'category',
      );

      expect(duplicates.length).toBe(2);

      const dupA = duplicates.find((d) => d.value === 'A');
      expect(dupA?.count).toBe(2);

      const dupB = duplicates.find((d) => d.value === 'B');
      expect(dupB?.count).toBe(3);
    });

    it('✅ deve retornar array vazio quando não há duplicatas', async () => {
      await service.addColumns(userId, 'no_dups', [
        { name: 'email', type: 'string' },
      ]);

      await service.insertRecord(userId, 'no_dups', {
        email: 'user1@example.com',
      });
      await service.insertRecord(userId, 'no_dups', {
        email: 'user2@example.com',
      });

      const duplicates = await service.findDuplicatesForUniqueColumn(
        userId,
        'no_dups',
        'email',
      );

      expect(duplicates.length).toBe(0);
    });

    it('✅ deve ignorar valores NULL ao detectar duplicatas', async () => {
      await service.addColumns(userId, 'null_dups', [
        { name: 'email', type: 'string' },
      ]);

      await service.insertRecord(userId, 'null_dups', { email: null });
      await service.insertRecord(userId, 'null_dups', { email: null });
      await service.insertRecord(userId, 'null_dups', { email: null });

      const duplicates = await service.findDuplicatesForUniqueColumn(
        userId,
        'null_dups',
        'email',
      );

      expect(duplicates.length).toBe(0);
    });
  });

  // ============================================
  // 7. Edge Cases e Tipos Diferentes
  // ============================================
  describe('Edge Cases e Tipos Diferentes', () => {
    console.log('  📂 Grupo: Edge Cases e Tipos Diferentes');

    it('✅ UNIQUE com números', async () => {
      await service.addColumns(userId, 'unique_numbers', [
        { name: 'id', type: 'number', unique: true },
      ]);

      await service.insertRecord(userId, 'unique_numbers', { id: 1 });

      await expectErrorCode(
        service.insertRecord(userId, 'unique_numbers', { id: 1 }),
        'UNIQUE_CONSTRAINT_VIOLATION',
      );
    });

    it('✅ UNIQUE com booleans', async () => {
      await service.addColumns(userId, 'unique_booleans', [
        { name: 'flag', type: 'boolean', unique: true },
      ]);

      await service.insertRecord(userId, 'unique_booleans', { flag: true });

      await expectErrorCode(
        service.insertRecord(userId, 'unique_booleans', { flag: true }),
        'UNIQUE_CONSTRAINT_VIOLATION',
      );
    });

    it('✅ UNIQUE com datas', async () => {
      await service.addColumns(userId, 'unique_dates', [
        { name: 'event_date', type: 'date', unique: true },
      ]);

      await service.insertRecord(userId, 'unique_dates', {
        event_date: '2024-01-01',
      });

      await expectErrorCode(
        service.insertRecord(userId, 'unique_dates', {
          event_date: '2024-01-01',
        }),
        'UNIQUE_CONSTRAINT_VIOLATION',
      );
    });

    it('✅ UNIQUE com strings vazias (devem ser consideradas duplicatas)', async () => {
      await service.addColumns(userId, 'unique_empty', [
        { name: 'text', type: 'string', unique: true },
      ]);

      await service.insertRecord(userId, 'unique_empty', { text: '' });

      await expectErrorCode(
        service.insertRecord(userId, 'unique_empty', { text: '' }),
        'UNIQUE_CONSTRAINT_VIOLATION',
      );
    });

    it('✅ UNIQUE com zero (deve ser considerado valor válido)', async () => {
      await service.addColumns(userId, 'unique_zero', [
        { name: 'counter', type: 'number', unique: true },
      ]);

      await service.insertRecord(userId, 'unique_zero', { counter: 0 });

      await expectErrorCode(
        service.insertRecord(userId, 'unique_zero', { counter: 0 }),
        'UNIQUE_CONSTRAINT_VIOLATION',
      );
    });
  });

  // ============================================
  // 8. Performance e Stress
  // ============================================
  describe('Performance e Stress', () => {
    console.log('  📂 Grupo: Performance e Stress');

    it('✅ deve validar UNIQUE rapidamente com 200 registros', async () => {
      await service.addColumns(userId, 'perf_test', [
        { name: 'email', type: 'string', unique: true },
      ]);

      // Inserir 200 registros únicos
      for (let i = 0; i < 200; i++) {
        await service.insertRecord(userId, 'perf_test', {
          email: `user${i}@example.com`,
        });
      }

      const startTime = Date.now();

      // Tentar inserir duplicata
      await expectErrorCode(
        service.insertRecord(userId, 'perf_test', {
          email: 'user100@example.com',
        }),
        'UNIQUE_CONSTRAINT_VIOLATION',
      );

      const executionTime = Date.now() - startTime;

      // Validação deve ser rápida (< 500ms)
      expect(executionTime).toBeLessThan(500);
    });

    it('✅ deve detectar duplicatas rapidamente em dataset grande', async () => {
      await service.addColumns(userId, 'large_dups', [
        { name: 'code', type: 'string' },
      ]);

      // Criar dataset com algumas duplicatas
      for (let i = 0; i < 100; i++) {
        await service.insertRecord(userId, 'large_dups', {
          code: `CODE${i % 10}`,
        });
      }

      const startTime = Date.now();

      const duplicates = await service.findDuplicatesForUniqueColumn(
        userId,
        'large_dups',
        'code',
      );

      const executionTime = Date.now() - startTime;

      expect(duplicates.length).toBe(10); // 10 códigos únicos com duplicatas
      expect(executionTime).toBeLessThan(500);
    });
  });
});
