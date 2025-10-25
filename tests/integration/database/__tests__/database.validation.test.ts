// ============================================
// TESTES DE VALIDAÇÃO - DatabaseService
// ============================================

import {
  createTestService,
  generateTestUserId,
  expectErrorCode,
} from '../setup';
import { DatabaseService } from '@/services/database/database.service';

describe('DatabaseService - Validação', () => {
  let service: DatabaseService;
  let userId: string;

  beforeEach(() => {
    service = createTestService();
    userId = generateTestUserId();
  });

  // ============================================
  // 4.1. validateTableName
  // ============================================
  describe('validateTableName', () => {
    it('✅ deve aceitar nome válido: "my_table-123"', async () => {
      await expect(
        service.addColumns(userId, 'my_table-123', [
          { name: 'field', type: 'string' },
        ]),
      ).resolves.toBeDefined();
    });

    it('❌ deve rejeitar nome com espaços: "nome inválido"', async () => {
      await expectErrorCode(
        service.addColumns(userId, 'nome inválido', [
          { name: 'field', type: 'string' },
        ]),
        'INVALID_TABLE_NAME',
      );
    });

    it('❌ deve rejeitar nome vazio: ""', async () => {
      await expectErrorCode(
        service.addColumns(userId, '', [{ name: 'field', type: 'string' }]),
        'INVALID_TABLE_NAME',
      );
    });

    it('❌ deve rejeitar nome com caracteres especiais: "table@123"', async () => {
      await expectErrorCode(
        service.addColumns(userId, 'table@123', [
          { name: 'field', type: 'string' },
        ]),
        'INVALID_TABLE_NAME',
      );
    });
  });

  // ============================================
  // 4.2. validateColumns
  // ============================================
  describe('validateColumns', () => {
    it('✅ deve aceitar array válido de colunas', async () => {
      const schema = await service.addColumns(userId, 'test_table', [
        { name: 'name', type: 'string' },
        { name: 'age', type: 'number' },
        { name: 'active', type: 'boolean' },
      ]);

      expect(schema.columns).toHaveLength(3);
      expect(schema.columns[0]).toMatchObject({
        name: 'name',
        type: 'string',
      });
    });

    it('❌ deve rejeitar array vazio', async () => {
      await expectErrorCode(
        service.addColumns(userId, 'test_table', []),
        'INVALID_COLUMNS',
      );
    });

    it('❌ deve rejeitar coluna sem nome', async () => {
      await expectErrorCode(
        service.addColumns(userId, 'test_table', [
          { name: '', type: 'string' },
        ]),
        'INVALID_COLUMN',
      );
    });

    it('❌ deve rejeitar tipo inválido: "invalid"', async () => {
      await expectErrorCode(
        service.addColumns(userId, 'test_table', [
          { name: 'field', type: 'invalid' as 'string' },
        ]),
        'INVALID_COLUMN_TYPE',
      );
    });

    it('✅ deve aceitar todos os tipos válidos', async () => {
      const schema = await service.addColumns(userId, 'test_table', [
        { name: 'str', type: 'string' },
        { name: 'num', type: 'number' },
        { name: 'bool', type: 'boolean' },
        { name: 'dt', type: 'date' },
        { name: 'arr', type: 'array' },
        { name: 'obj', type: 'object' },
      ]);

      expect(schema.columns).toHaveLength(6);
    });
  });

  // ============================================
  // 4.3. validateFieldType
  // ============================================
  describe('validateFieldType', () => {
    beforeEach(async () => {
      await service.addColumns(userId, 'types_test', [
        { name: 'str_field', type: 'string', required: false },
        { name: 'num_field', type: 'number', required: false },
        { name: 'bool_field', type: 'boolean', required: false },
        { name: 'date_field', type: 'date', required: false },
        { name: 'arr_field', type: 'array', required: false },
        { name: 'obj_field', type: 'object', required: false },
      ]);
    });

    // STRING
    it('✅ string: "text" deve passar', async () => {
      await expect(
        service.insertRecord(userId, 'types_test', {
          str_field: 'text',
        }),
      ).resolves.toBeDefined();
    });

    it('❌ string: 123 deve falhar', async () => {
      await expectErrorCode(
        service.insertRecord(userId, 'types_test', {
          str_field: 123,
        }),
        'INVALID_FIELD_TYPE',
      );
    });

    // NUMBER
    it('✅ number: 42 deve passar', async () => {
      await expect(
        service.insertRecord(userId, 'types_test', {
          num_field: 42,
        }),
      ).resolves.toBeDefined();
    });

    it('✅ number: "42" (string) deve passar com conversão', async () => {
      await expect(
        service.insertRecord(userId, 'types_test', {
          num_field: '42',
        }),
      ).resolves.toBeDefined();
    });

    it('❌ number: NaN deve falhar', async () => {
      await expectErrorCode(
        service.insertRecord(userId, 'types_test', {
          num_field: NaN,
        }),
        'INVALID_FIELD_TYPE',
      );
    });

    it('❌ number: Infinity deve falhar', async () => {
      await expectErrorCode(
        service.insertRecord(userId, 'types_test', {
          num_field: Infinity,
        }),
        'INVALID_FIELD_TYPE',
      );
    });

    // BOOLEAN
    it('✅ boolean: true deve passar', async () => {
      await expect(
        service.insertRecord(userId, 'types_test', {
          bool_field: true,
        }),
      ).resolves.toBeDefined();
    });

    it('❌ boolean: "true" (string) deve falhar', async () => {
      await expectErrorCode(
        service.insertRecord(userId, 'types_test', {
          bool_field: 'true',
        }),
        'INVALID_FIELD_TYPE',
      );
    });

    // DATE
    it('✅ date: "2024-01-15" deve passar', async () => {
      await expect(
        service.insertRecord(userId, 'types_test', {
          date_field: '2024-01-15',
        }),
      ).resolves.toBeDefined();
    });

    it('✅ date: "2024-01-15T10:30:00.000Z" deve passar', async () => {
      await expect(
        service.insertRecord(userId, 'types_test', {
          date_field: '2024-01-15T10:30:00.000Z',
        }),
      ).resolves.toBeDefined();
    });

    it('✅ date: "15/01/2024" deve passar', async () => {
      await expect(
        service.insertRecord(userId, 'types_test', {
          date_field: '15/01/2024',
        }),
      ).resolves.toBeDefined();
    });

    it('❌ date: "1234567890" (timestamp Unix) deve falhar', async () => {
      await expectErrorCode(
        service.insertRecord(userId, 'types_test', {
          date_field: '1234567890',
        }),
        'INVALID_FIELD_TYPE',
      );
    });

    // ARRAY
    it('✅ array: [1,2,3] deve passar', async () => {
      await expect(
        service.insertRecord(userId, 'types_test', {
          arr_field: [1, 2, 3],
        }),
      ).resolves.toBeDefined();
    });

    it('❌ array: "array" (string) deve falhar', async () => {
      await expectErrorCode(
        service.insertRecord(userId, 'types_test', {
          arr_field: 'array',
        }),
        'INVALID_FIELD_TYPE',
      );
    });

    // OBJECT
    it('✅ object: {a:1} deve passar', async () => {
      await expect(
        service.insertRecord(userId, 'types_test', {
          obj_field: { a: 1 },
        }),
      ).resolves.toBeDefined();
    });

    it('❌ object: [] (array) deve falhar', async () => {
      await expectErrorCode(
        service.insertRecord(userId, 'types_test', {
          obj_field: [],
        }),
        'INVALID_FIELD_TYPE',
      );
    });

    it('✅ object: null deve passar para campo opcional', async () => {
      // Campos opcionais devem aceitar null
      const record = await service.insertRecord(userId, 'types_test', {
        obj_field: null,
      });
      expect(record.obj_field).toBeNull();
    });

    it('❌ object: null deve falhar para campo required', async () => {
      // Criar tabela com campo required
      await service.addColumns(userId, 'required_test', [
        { name: 'obj_field', type: 'object', required: true },
      ]);

      // Tentar inserir null em campo required → deve falhar
      await expectErrorCode(
        service.insertRecord(userId, 'required_test', {
          obj_field: null,
        }),
        'MISSING_REQUIRED_FIELD',
      );
    });
  });

  // ============================================
  // 4.4. validateRecord
  // ============================================
  describe('validateRecord', () => {
    beforeEach(async () => {
      await service.addColumns(userId, 'validation_test', [
        { name: 'required_field', type: 'string', required: true },
        { name: 'optional_field', type: 'string' },
        { name: 'default_field', type: 'number', default: 42 },
      ]);
    });

    it('✅ deve aceitar record válido com todos os campos', async () => {
      const record = await service.insertRecord(userId, 'validation_test', {
        required_field: 'value',
        optional_field: 'optional',
        default_field: 100,
      });

      expect(record.required_field).toBe('value');
      expect(record.optional_field).toBe('optional');
      expect(record.default_field).toBe(100);
    });

    it('❌ deve rejeitar campo required ausente', async () => {
      await expectErrorCode(
        service.insertRecord(userId, 'validation_test', {
          optional_field: 'value',
        }),
        'MISSING_REQUIRED_FIELD',
      );
    });

    it('✅ deve aplicar default quando campo ausente', async () => {
      const record = await service.insertRecord(userId, 'validation_test', {
        required_field: 'value',
      });

      expect(record.default_field).toBe(42);
    });

    it('❌ deve rejeitar tipo incorreto (string em campo number)', async () => {
      await expectErrorCode(
        service.insertRecord(userId, 'validation_test', {
          required_field: 'value',
          default_field: 'not_a_number',
        }),
        'INVALID_FIELD_TYPE',
      );
    });
  });
});
