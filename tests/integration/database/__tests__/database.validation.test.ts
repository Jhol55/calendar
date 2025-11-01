// ============================================
// TESTES DE VALIDAÇÃO - DatabaseService
// ============================================

import {
  createTestService,
  generateStringUserId,
  expectErrorCode,
} from '../../setup';
import { DatabaseService } from '@/services/database/database.service';

describe('DatabaseService - Validação', () => {
  console.log('\n📋 INICIANDO: DatabaseService - Validação');

  let service: DatabaseService;
  let userId: string;

  beforeEach(() => {
    service = createTestService();
    userId = generateStringUserId();
  });

  // ============================================
  // 4.1. validateTableName
  // ============================================
  describe('validateTableName', () => {
    console.log('  📂 Grupo: validateTableName');

    it('✅ deve aceitar nome válido: "my_table-123"', async () => {
      console.log('    ✓ Teste: ✅ deve aceitar nome válido: "my_table-123"');
      await expect(
        service.addColumns(userId, 'my_table-123', [
          { name: 'field', type: 'string' },
        ]),
      ).resolves.toBeDefined();
    });

    it('❌ deve rejeitar nome com espaços: "nome inválido"', async () => {
      console.log(
        '    ✓ Teste: ❌ deve rejeitar nome com espaços: "nome inválido"',
      );
      await expectErrorCode(
        service.addColumns(userId, 'nome inválido', [
          { name: 'field', type: 'string' },
        ]),
        'INVALID_TABLE_NAME',
      );
    });

    it('❌ deve rejeitar nome vazio: ""', async () => {
      console.log('    ✓ Teste: ❌ deve rejeitar nome vazio: ""');
      await expectErrorCode(
        service.addColumns(userId, '', [{ name: 'field', type: 'string' }]),
        'INVALID_TABLE_NAME',
      );
    });

    it('❌ deve rejeitar nome com caracteres especiais: "table@123"', async () => {
      console.log(
        '    ✓ Teste: ❌ deve rejeitar nome com caracteres especiais: "table@123"',
      );
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
    console.log('  📂 Grupo: validateColumns');

    it('✅ deve aceitar array válido de colunas', async () => {
      console.log('    ✓ Teste: ✅ deve aceitar array válido de colunas');
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
      console.log('    ✓ Teste: ❌ deve rejeitar array vazio');
      await expectErrorCode(
        service.addColumns(userId, 'test_table', []),
        'INVALID_COLUMNS',
      );
    });

    it('❌ deve rejeitar coluna sem nome', async () => {
      console.log('    ✓ Teste: ❌ deve rejeitar coluna sem nome');
      await expectErrorCode(
        service.addColumns(userId, 'test_table', [
          { name: '', type: 'string' },
        ]),
        'INVALID_COLUMN',
      );
    });

    it('❌ deve rejeitar tipo inválido: "invalid"', async () => {
      console.log('    ✓ Teste: ❌ deve rejeitar tipo inválido: "invalid"');
      await expectErrorCode(
        service.addColumns(userId, 'test_table', [
          { name: 'field', type: 'invalid' as 'string' },
        ]),
        'INVALID_COLUMN_TYPE',
      );
    });

    it('✅ deve aceitar todos os tipos válidos', async () => {
      console.log('    ✓ Teste: ✅ deve aceitar todos os tipos válidos');
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
    console.log('  📂 Grupo: validateFieldType');
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
      console.log('    ✓ Teste: ✅ string: "text" deve passar');
      await expect(
        service.insertRecord(userId, 'types_test', {
          str_field: 'text',
        }),
      ).resolves.toBeDefined();
    });

    it('❌ string: 123 deve falhar', async () => {
      console.log('    ✓ Teste: ❌ string: 123 deve falhar');
      await expectErrorCode(
        service.insertRecord(userId, 'types_test', {
          str_field: 123,
        }),
        'INVALID_FIELD_TYPE',
      );
    });

    // NUMBER
    it('✅ number: 42 deve passar', async () => {
      console.log('    ✓ Teste: ✅ number: 42 deve passar');
      await expect(
        service.insertRecord(userId, 'types_test', {
          num_field: 42,
        }),
      ).resolves.toBeDefined();
    });

    it('✅ number: "42" (string) deve passar com conversão', async () => {
      console.log(
        '    ✓ Teste: ✅ number: "42" (string) deve passar com conversão',
      );
      await expect(
        service.insertRecord(userId, 'types_test', {
          num_field: '42',
        }),
      ).resolves.toBeDefined();
    });

    it('❌ number: NaN deve falhar', async () => {
      console.log('    ✓ Teste: ❌ number: NaN deve falhar');
      await expectErrorCode(
        service.insertRecord(userId, 'types_test', {
          num_field: NaN,
        }),
        'INVALID_FIELD_TYPE',
      );
    });

    it('❌ number: Infinity deve falhar', async () => {
      console.log('    ✓ Teste: ❌ number: Infinity deve falhar');
      await expectErrorCode(
        service.insertRecord(userId, 'types_test', {
          num_field: Infinity,
        }),
        'INVALID_FIELD_TYPE',
      );
    });

    // BOOLEAN
    it('✅ boolean: true deve passar', async () => {
      console.log('    ✓ Teste: ✅ boolean: true deve passar');
      await expect(
        service.insertRecord(userId, 'types_test', {
          bool_field: true,
        }),
      ).resolves.toBeDefined();
    });

    it('✅ boolean: "true" (string) deve passar com conversão', async () => {
      console.log(
        '    ✓ Teste: ✅ boolean: "true" (string) deve passar com conversão',
      );
      await expect(
        service.insertRecord(userId, 'types_test', {
          bool_field: 'true',
        }),
      ).resolves.toBeDefined();
    });

    it('✅ boolean: "false" (string) deve passar com conversão', async () => {
      console.log(
        '    ✓ Teste: ✅ boolean: "false" (string) deve passar com conversão',
      );
      await expect(
        service.insertRecord(userId, 'types_test', {
          bool_field: 'false',
        }),
      ).resolves.toBeDefined();
    });

    it('❌ boolean: "invalid" (string) deve falhar', async () => {
      console.log('    ✓ Teste: ❌ boolean: "invalid" (string) deve falhar');
      await expectErrorCode(
        service.insertRecord(userId, 'types_test', {
          bool_field: 'invalid',
        }),
        'INVALID_FIELD_TYPE',
      );
    });

    // DATE
    it('✅ date: "2024-01-15" deve passar', async () => {
      console.log('    ✓ Teste: ✅ date: "2024-01-15" deve passar');
      await expect(
        service.insertRecord(userId, 'types_test', {
          date_field: '2024-01-15',
        }),
      ).resolves.toBeDefined();
    });

    it('✅ date: "2024-01-15T10:30:00.000Z" deve passar', async () => {
      console.log(
        '    ✓ Teste: ✅ date: "2024-01-15T10:30:00.000Z" deve passar',
      );
      await expect(
        service.insertRecord(userId, 'types_test', {
          date_field: '2024-01-15T10:30:00.000Z',
        }),
      ).resolves.toBeDefined();
    });

    it('✅ date: "15/01/2024" deve passar', async () => {
      console.log('    ✓ Teste: ✅ date: "15/01/2024" deve passar');
      await expect(
        service.insertRecord(userId, 'types_test', {
          date_field: '15/01/2024',
        }),
      ).resolves.toBeDefined();
    });

    it('❌ date: "1234567890" (timestamp Unix) deve falhar', async () => {
      console.log(
        '    ✓ Teste: ❌ date: "1234567890" (timestamp Unix) deve falhar',
      );
      await expectErrorCode(
        service.insertRecord(userId, 'types_test', {
          date_field: '1234567890',
        }),
        'INVALID_FIELD_TYPE',
      );
    });

    // ARRAY
    it('✅ array: [1,2,3] deve passar', async () => {
      console.log('    ✓ Teste: ✅ array: [1,2,3] deve passar');
      await expect(
        service.insertRecord(userId, 'types_test', {
          arr_field: [1, 2, 3],
        }),
      ).resolves.toBeDefined();
    });

    it('❌ array: "array" (string) deve falhar', async () => {
      console.log('    ✓ Teste: ❌ array: "array" (string) deve falhar');
      await expectErrorCode(
        service.insertRecord(userId, 'types_test', {
          arr_field: 'array',
        }),
        'INVALID_FIELD_TYPE',
      );
    });

    // OBJECT
    it('✅ object: {a:1} deve passar', async () => {
      console.log('    ✓ Teste: ✅ object: {a:1} deve passar');
      await expect(
        service.insertRecord(userId, 'types_test', {
          obj_field: { a: 1 },
        }),
      ).resolves.toBeDefined();
    });

    it('❌ object: [] (array) deve falhar', async () => {
      console.log('    ✓ Teste: ❌ object: [] (array) deve falhar');
      await expectErrorCode(
        service.insertRecord(userId, 'types_test', {
          obj_field: [],
        }),
        'INVALID_FIELD_TYPE',
      );
    });

    it('✅ object: null deve passar para campo opcional', async () => {
      console.log(
        '    ✓ Teste: ✅ object: null deve passar para campo opcional',
      );
      // Campos opcionais devem aceitar null
      const record = await service.insertRecord(userId, 'types_test', {
        obj_field: null,
      });
      expect(record.obj_field).toBeNull();
    });

    it('❌ object: null deve falhar para campo required', async () => {
      console.log(
        '    ✓ Teste: ❌ object: null deve falhar para campo required',
      );
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
    console.log('  📂 Grupo: validateRecord');
    beforeEach(async () => {
      await service.addColumns(userId, 'validation_test', [
        { name: 'required_field', type: 'string', required: true },
        { name: 'optional_field', type: 'string' },
        { name: 'default_field', type: 'number', default: 42 },
      ]);
    });

    it('✅ deve aceitar record válido com todos os campos', async () => {
      console.log(
        '    ✓ Teste: ✅ deve aceitar record válido com todos os campos',
      );
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
      console.log('    ✓ Teste: ❌ deve rejeitar campo required ausente');
      await expectErrorCode(
        service.insertRecord(userId, 'validation_test', {
          optional_field: 'value',
        }),
        'MISSING_REQUIRED_FIELD',
      );
    });

    it('✅ deve aplicar default quando campo ausente', async () => {
      console.log('    ✓ Teste: ✅ deve aplicar default quando campo ausente');
      const record = await service.insertRecord(userId, 'validation_test', {
        required_field: 'value',
      });

      expect(record.default_field).toBe(42);
    });

    it('❌ deve rejeitar tipo incorreto (string em campo number)', async () => {
      console.log(
        '    ✓ Teste: ❌ deve rejeitar tipo incorreto (string em campo number)',
      );
      await expectErrorCode(
        service.insertRecord(userId, 'validation_test', {
          required_field: 'value',
          default_field: 'not_a_number',
        }),
        'INVALID_FIELD_TYPE',
      );
    });
  });

  // ============================================
  // 4.4. UNIQUE Constraints
  // ============================================
  describe('UNIQUE Constraints', () => {
    console.log('  📂 Grupo: UNIQUE Constraints');

    beforeEach(async () => {
      await service.addColumns(userId, 'unique_test', [
        { name: 'email', type: 'string', unique: true },
        { name: 'username', type: 'string', unique: true },
        { name: 'age', type: 'number' },
      ]);
    });

    it('✅ deve permitir inserir primeiro registro com valor único', async () => {
      console.log(
        '    ✓ Teste: ✅ deve permitir inserir primeiro registro com valor único',
      );
      const record = await service.insertRecord(userId, 'unique_test', {
        email: 'test@example.com',
        username: 'testuser',
        age: 25,
      });

      expect(record.email).toBe('test@example.com');
      expect(record.username).toBe('testuser');
    });

    it('❌ deve rejeitar INSERT com valor duplicado em coluna UNIQUE', async () => {
      console.log(
        '    ✓ Teste: ❌ deve rejeitar INSERT com valor duplicado em coluna UNIQUE',
      );
      await service.insertRecord(userId, 'unique_test', {
        email: 'test@example.com',
        username: 'user1',
        age: 25,
      });

      await expectErrorCode(
        service.insertRecord(userId, 'unique_test', {
          email: 'test@example.com', // Duplicado
          username: 'user2',
          age: 30,
        }),
        'UNIQUE_CONSTRAINT_VIOLATION',
      );
    });

    it('❌ deve rejeitar UPDATE para valor duplicado em coluna UNIQUE', async () => {
      console.log(
        '    ✓ Teste: ❌ deve rejeitar UPDATE para valor duplicado em coluna UNIQUE',
      );
      await service.insertRecord(userId, 'unique_test', {
        email: 'user1@example.com',
        username: 'user1',
        age: 25,
      });

      await service.insertRecord(userId, 'unique_test', {
        email: 'user2@example.com',
        username: 'user2',
        age: 30,
      });

      await expectErrorCode(
        service.updateRecords(
          userId,
          'unique_test',
          {
            condition: 'AND',
            rules: [{ field: 'username', operator: 'equals', value: 'user2' }],
          },
          { email: 'user1@example.com' }, // Tentar duplicar email
        ),
        'UNIQUE_CONSTRAINT_VIOLATION',
      );
    });

    it('✅ deve permitir NULL em coluna UNIQUE (múltiplos NULLs)', async () => {
      console.log(
        '    ✓ Teste: ✅ deve permitir NULL em coluna UNIQUE (múltiplos NULLs)',
      );
      await service.insertRecord(userId, 'unique_test', {
        email: null,
        username: 'user1',
        age: 25,
      });

      // Segundo NULL deve ser permitido
      const record2 = await service.insertRecord(userId, 'unique_test', {
        email: null,
        username: 'user2',
        age: 30,
      });

      expect(record2.email).toBeNull();
    });

    it('✅ deve permitir undefined em coluna UNIQUE (múltiplos undefined)', async () => {
      console.log(
        '    ✓ Teste: ✅ deve permitir undefined em coluna UNIQUE (múltiplos undefined)',
      );
      await service.insertRecord(userId, 'unique_test', {
        username: 'user1',
        age: 25,
        // email: undefined (não fornecido)
      });

      // Segundo undefined deve ser permitido
      const record2 = await service.insertRecord(userId, 'unique_test', {
        username: 'user2',
        age: 30,
        // email: undefined (não fornecido)
      });

      expect(record2.email).toBeUndefined();
    });

    it('✅ deve permitir UPDATE do mesmo registro (não é duplicata)', async () => {
      console.log(
        '    ✓ Teste: ✅ deve permitir UPDATE do mesmo registro (não é duplicata)',
      );
      await service.insertRecord(userId, 'unique_test', {
        email: 'test@example.com',
        username: 'testuser',
        age: 25,
      });

      // Atualizar o próprio email para o mesmo valor deve funcionar
      const result = await service.updateRecords(
        userId,
        'unique_test',
        {
          condition: 'AND',
          rules: [
            { field: 'email', operator: 'equals', value: 'test@example.com' },
          ],
        },
        { age: 26 }, // Atualizar outro campo, email permanece igual
      );

      expect(result.success).toBe(true);
      expect(result.affected).toBe(1);
    });

    it('✅ deve detectar duplicatas existentes com findDuplicatesForUniqueColumn', async () => {
      console.log(
        '    ✓ Teste: ✅ deve detectar duplicatas existentes com findDuplicatesForUniqueColumn',
      );
      // Criar tabela sem UNIQUE inicialmente
      await service.addColumns(userId, 'find_dups_test', [
        { name: 'email', type: 'string' },
      ]);

      // Inserir duplicatas
      await service.insertRecord(userId, 'find_dups_test', {
        email: 'dup@example.com',
      });
      await service.insertRecord(userId, 'find_dups_test', {
        email: 'dup@example.com',
      });
      await service.insertRecord(userId, 'find_dups_test', {
        email: 'unique@example.com',
      });

      const duplicates = await service.findDuplicatesForUniqueColumn(
        userId,
        'find_dups_test',
        'email',
      );

      expect(duplicates.length).toBe(1);
      expect(duplicates[0].value).toBe('dup@example.com');
      expect(duplicates[0].count).toBe(2);
      expect(duplicates[0].ids.length).toBe(2);
    });

    it('❌ deve rejeitar duplicata em múltiplas partições', async () => {
      console.log(
        '    ✓ Teste: ❌ deve rejeitar duplicata em múltiplas partições',
      );
      // Inserir registros suficientes para criar múltiplas partições
      for (let i = 0; i < 105; i++) {
        await service.insertRecord(userId, 'unique_test', {
          email: `user${i}@example.com`,
          username: `user${i}`,
          age: 20 + i,
        });
      }

      // Tentar inserir duplicata (deve buscar em todas as partições)
      await expectErrorCode(
        service.insertRecord(userId, 'unique_test', {
          email: 'user50@example.com', // Duplicado de partição anterior
          username: 'newuser',
          age: 99,
        }),
        'UNIQUE_CONSTRAINT_VIOLATION',
      );
    });

    it('✅ deve permitir valores únicos diferentes', async () => {
      console.log('    ✓ Teste: ✅ deve permitir valores únicos diferentes');
      await service.insertRecord(userId, 'unique_test', {
        email: 'user1@example.com',
        username: 'user1',
        age: 25,
      });

      const record2 = await service.insertRecord(userId, 'unique_test', {
        email: 'user2@example.com',
        username: 'user2',
        age: 30,
      });

      expect(record2.email).toBe('user2@example.com');
      expect(record2.username).toBe('user2');
    });
  });
});
