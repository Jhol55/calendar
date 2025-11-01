/**
 * SQL Engine - ALTER TABLE
 *
 * Testa operações ALTER TABLE:
 * - ADD COLUMN
 * - DROP COLUMN
 * - RENAME COLUMN
 * - RENAME TABLE
 * - Isolamento entre usuários
 */

import {
  setupTestUser,
  executeSql,
  getAllRecords,
  expectSqlError,
} from '../../../helpers/sql-engine';

describe('SQL Engine - ALTER TABLE', () => {
  describe('ADD COLUMN', () => {
    it('deve adicionar coluna simples', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE users (id INT, name VARCHAR(50))`,
        );
        await executeSql(userId, `INSERT INTO users VALUES (1, 'Alice')`);

        await executeSql(userId, `ALTER TABLE users ADD COLUMN age INT`);

        const records = await getAllRecords(userId, 'users');
        expect(records[0]).toHaveProperty('age');
      } finally {
        await cleanup();
      }
    });

    it('deve adicionar múltiplas colunas', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE products (id INT, name VARCHAR(50))`,
        );
        await executeSql(userId, `INSERT INTO products VALUES (1, 'Laptop')`);

        await executeSql(userId, `ALTER TABLE products ADD COLUMN price INT`);
        await executeSql(userId, `ALTER TABLE products ADD COLUMN stock INT`);

        const records = await getAllRecords(userId, 'products');
        expect(records[0]).toHaveProperty('price');
        expect(records[0]).toHaveProperty('stock');
      } finally {
        await cleanup();
      }
    });

    it('registros existentes devem ter NULL na nova coluna', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE items (id INT)`);
        await executeSql(userId, `INSERT INTO items VALUES (1), (2)`);

        await executeSql(
          userId,
          `ALTER TABLE items ADD COLUMN description VARCHAR(100)`,
        );

        const records = await getAllRecords(userId, 'items');
        expect(records[0].description).toBeNull();
        expect(records[1].description).toBeNull();
      } finally {
        await cleanup();
      }
    });
  });

  describe('DROP COLUMN', () => {
    it('deve remover coluna', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE users (id INT, name VARCHAR(50), age INT)`,
        );
        await executeSql(userId, `INSERT INTO users VALUES (1, 'Alice', 25)`);

        await executeSql(userId, `ALTER TABLE users DROP COLUMN age`);

        const records = await getAllRecords(userId, 'users');
        expect(records[0]).not.toHaveProperty('age');
        expect(records[0]).toHaveProperty('name');
      } finally {
        await cleanup();
      }
    });

    it('deve preservar dados de outras colunas', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE products (id INT, name VARCHAR(50), price INT, stock INT)`,
        );
        await executeSql(
          userId,
          `INSERT INTO products VALUES (1, 'Laptop', 1000, 50)`,
        );

        await executeSql(userId, `ALTER TABLE products DROP COLUMN price`);

        const records = await getAllRecords(userId, 'products');
        expect(records[0].name).toBe('Laptop');
        expect(records[0].stock).toBe(50);
        expect(records[0]).not.toHaveProperty('price');
      } finally {
        await cleanup();
      }
    });

    it('DROP COLUMN em tabela vazia deve funcionar', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE empty_table (id INT, data VARCHAR(50))`,
        );
        await executeSql(userId, `ALTER TABLE empty_table DROP COLUMN data`);

        const result = await executeSql(userId, `SELECT * FROM empty_table`);
        expect(result).toHaveLength(0);
      } finally {
        await cleanup();
      }
    });
  });

  describe('RENAME COLUMN', () => {
    it('deve renomear coluna', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE users (id INT, user_name VARCHAR(50))`,
        );
        await executeSql(userId, `INSERT INTO users VALUES (1, 'Alice')`);

        await executeSql(
          userId,
          `ALTER TABLE users RENAME COLUMN user_name TO name`,
        );

        const records = await getAllRecords(userId, 'users');
        expect(records[0]).toHaveProperty('name', 'Alice');
        expect(records[0]).not.toHaveProperty('user_name');
      } finally {
        await cleanup();
      }
    });

    it('deve preservar valores ao renomear', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE products (id INT, old_price INT)`,
        );
        await executeSql(
          userId,
          `INSERT INTO products VALUES (1, 100), (2, 200)`,
        );

        await executeSql(
          userId,
          `ALTER TABLE products RENAME COLUMN old_price TO price`,
        );

        const records = await getAllRecords(userId, 'products');
        expect(records[0].price).toBe(100);
        expect(records[1].price).toBe(200);
      } finally {
        await cleanup();
      }
    });
  });

  describe('RENAME TABLE', () => {
    it('deve renomear tabela', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE old_name (id INT, data VARCHAR(50))`,
        );
        await executeSql(userId, `INSERT INTO old_name VALUES (1, 'test')`);

        await executeSql(userId, `ALTER TABLE old_name RENAME TO new_name`);

        // Tabela antiga não deve existir
        await expectSqlError(
          userId,
          `SELECT * FROM old_name`,
          /não existe|not exist/i,
        );

        // Nova tabela deve ter os dados
        const records = await getAllRecords(userId, 'new_name');
        expect(records[0].data).toBe('test');
      } finally {
        await cleanup();
      }
    });

    it('RENAME TABLE deve preservar todos os dados', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE table_a (id INT, value INT)`);
        await executeSql(
          userId,
          `INSERT INTO table_a VALUES (1, 10), (2, 20), (3, 30)`,
        );

        await executeSql(userId, `ALTER TABLE table_a RENAME TO table_b`);

        const records = await getAllRecords(userId, 'table_b');
        expect(records).toHaveLength(3);
        expect(records.map((r: any) => r.value)).toEqual([10, 20, 30]);
      } finally {
        await cleanup();
      }
    });
  });

  describe('ALTER TABLE - User Isolation', () => {
    it('ALTER TABLE de um usuário não deve afetar outro', async () => {
      const userA = await setupTestUser();
      const userB = await setupTestUser();

      try {
        await executeSql(
          userA.userId,
          `CREATE TABLE shared_name (id INT, col_a VARCHAR(50))`,
        );
        await executeSql(
          userB.userId,
          `CREATE TABLE shared_name (id INT, col_b VARCHAR(50))`,
        );

        await executeSql(
          userA.userId,
          `INSERT INTO shared_name VALUES (1, 'A')`,
        );
        await executeSql(
          userB.userId,
          `INSERT INTO shared_name VALUES (2, 'B')`,
        );

        // User A adiciona coluna
        await executeSql(
          userA.userId,
          `ALTER TABLE shared_name ADD COLUMN new_col VARCHAR(50)`,
        );

        // User B não deve ter a nova coluna
        const recordsB = await getAllRecords(userB.userId, 'shared_name');
        expect(recordsB[0]).not.toHaveProperty('new_col');
        expect(recordsB[0]).toHaveProperty('col_b');
      } finally {
        await userA.cleanup();
        await userB.cleanup();
      }
    });

    it('DROP COLUMN de um usuário não deve afetar outro', async () => {
      const userA = await setupTestUser();
      const userB = await setupTestUser();

      try {
        await executeSql(userA.userId, `CREATE TABLE data (id INT, value INT)`);
        await executeSql(userB.userId, `CREATE TABLE data (id INT, value INT)`);

        await executeSql(userA.userId, `INSERT INTO data VALUES (1, 100)`);
        await executeSql(userB.userId, `INSERT INTO data VALUES (2, 200)`);

        // User A remove coluna
        await executeSql(userA.userId, `ALTER TABLE data DROP COLUMN value`);

        // User B ainda deve ter a coluna
        const recordsB = await getAllRecords(userB.userId, 'data');
        expect(recordsB[0]).toHaveProperty('value', 200);
      } finally {
        await userA.cleanup();
        await userB.cleanup();
      }
    });

    it('RENAME TABLE de um usuário não deve afetar outro', async () => {
      const userA = await setupTestUser();
      const userB = await setupTestUser();

      try {
        await executeSql(userA.userId, `CREATE TABLE original (id INT)`);
        await executeSql(userB.userId, `CREATE TABLE original (id INT)`);

        await executeSql(userA.userId, `INSERT INTO original VALUES (1)`);
        await executeSql(userB.userId, `INSERT INTO original VALUES (2)`);

        // User A renomeia
        await executeSql(
          userA.userId,
          `ALTER TABLE original RENAME TO renamed`,
        );

        // User B ainda deve ter tabela "original"
        const recordsB = await getAllRecords(userB.userId, 'original');
        expect(recordsB).toHaveLength(1);
        expect(recordsB[0].id).toBe(2);

        // User A deve ter "renamed"
        const recordsA = await getAllRecords(userA.userId, 'renamed');
        expect(recordsA[0].id).toBe(1);
      } finally {
        await userA.cleanup();
        await userB.cleanup();
      }
    });
  });

  describe('Complex ALTER Scenarios', () => {
    it('múltiplas operações ALTER em sequência', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE evolving (id INT, col1 VARCHAR(50))`,
        );
        await executeSql(userId, `INSERT INTO evolving VALUES (1, 'data')`);

        // ADD
        await executeSql(userId, `ALTER TABLE evolving ADD COLUMN col2 INT`);

        // RENAME
        await executeSql(
          userId,
          `ALTER TABLE evolving RENAME COLUMN col1 TO name`,
        );

        // DROP
        await executeSql(userId, `ALTER TABLE evolving DROP COLUMN col2`);

        const records = await getAllRecords(userId, 'evolving');
        expect(records[0]).toHaveProperty('name', 'data');
        expect(records[0]).not.toHaveProperty('col1');
        expect(records[0]).not.toHaveProperty('col2');
      } finally {
        await cleanup();
      }
    });

    it('ALTER TABLE após INSERT e SELECT', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE lifecycle (id INT, status VARCHAR(20))`,
        );
        await executeSql(userId, `INSERT INTO lifecycle VALUES (1, 'active')`);

        const beforeAlter = await executeSql(userId, `SELECT * FROM lifecycle`);
        expect(beforeAlter).toHaveLength(1);

        await executeSql(
          userId,
          `ALTER TABLE lifecycle ADD COLUMN priority INT`,
        );

        await executeSql(
          userId,
          `INSERT INTO lifecycle VALUES (2, 'pending', 5)`,
        );

        const afterAlter = await getAllRecords(userId, 'lifecycle');
        expect(afterAlter).toHaveLength(2);
        expect(afterAlter[0].priority).toBeNull();
        expect(afterAlter[1].priority).toBe(5);
      } finally {
        await cleanup();
      }
    });
  });

  // ============================================
  // 10.11. CREATE TABLE with UNIQUE
  // ============================================
  describe('CREATE TABLE with UNIQUE', () => {
    console.log('  📂 Grupo: CREATE TABLE with UNIQUE');

    it('✅ Query 1: CREATE TABLE com coluna UNIQUE', async () => {
      console.log('    ✓ Teste: ✅ Query 1: CREATE TABLE com coluna UNIQUE');

      const { userId, cleanup } = await setupTestUser();
      try {
        await executeSql(
          userId,
          `CREATE TABLE users (
            id INT,
            email VARCHAR(255) UNIQUE,
            username VARCHAR(100) UNIQUE,
            age INT
          )`,
        );

        // Inserir primeiro registro
        await executeSql(
          userId,
          `INSERT INTO users VALUES (1, 'test@example.com', 'testuser', 25)`,
        );

        const records = await getAllRecords(userId, 'users');
        expect(records).toHaveLength(1);
        expect(records[0].email).toBe('test@example.com');
      } finally {
        await cleanup();
      }
    });

    it('❌ Query 2: INSERT deve falhar com valor UNIQUE duplicado', async () => {
      console.log(
        '    ✓ Teste: ❌ Query 2: INSERT deve falhar com valor UNIQUE duplicado',
      );

      const { userId, cleanup } = await setupTestUser();
      try {
        await executeSql(
          userId,
          `CREATE TABLE users (
            id INT,
            email VARCHAR(255) UNIQUE,
            username VARCHAR(100)
          )`,
        );

        await executeSql(
          userId,
          `INSERT INTO users VALUES (1, 'test@example.com', 'user1')`,
        );

        // Tentar inserir email duplicado
        await expectSqlError(
          userId,
          `INSERT INTO users VALUES (2, 'test@example.com', 'user2')`,
        );
      } finally {
        await cleanup();
      }
    });

    it('❌ Query 3: UPDATE deve falhar ao criar duplicata UNIQUE', async () => {
      console.log(
        '    ✓ Teste: ❌ Query 3: UPDATE deve falhar ao criar duplicata UNIQUE',
      );

      const { userId, cleanup } = await setupTestUser();
      try {
        await executeSql(
          userId,
          `CREATE TABLE users (
            id INT,
            email VARCHAR(255) UNIQUE,
            username VARCHAR(100)
          )`,
        );

        await executeSql(
          userId,
          `INSERT INTO users VALUES (1, 'user1@example.com', 'user1')`,
        );
        await executeSql(
          userId,
          `INSERT INTO users VALUES (2, 'user2@example.com', 'user2')`,
        );

        // Tentar atualizar para email duplicado
        await expectSqlError(
          userId,
          `UPDATE users SET email = 'user1@example.com' WHERE username = 'user2'`,
        );
      } finally {
        await cleanup();
      }
    });

    it('✅ Query 4: NULL permitido em coluna UNIQUE (múltiplos NULLs)', async () => {
      console.log(
        '    ✓ Teste: ✅ Query 4: NULL permitido em coluna UNIQUE (múltiplos NULLs)',
      );

      const { userId, cleanup } = await setupTestUser();
      try {
        await executeSql(
          userId,
          `CREATE TABLE users (
            id INT,
            email VARCHAR(255) UNIQUE,
            username VARCHAR(100)
          )`,
        );

        await executeSql(userId, `INSERT INTO users VALUES (1, NULL, 'user1')`);
        await executeSql(userId, `INSERT INTO users VALUES (2, NULL, 'user2')`);

        const records = await getAllRecords(userId, 'users');
        expect(records).toHaveLength(2);
        expect(records[0].email).toBeNull();
        expect(records[1].email).toBeNull();
      } finally {
        await cleanup();
      }
    });

    it('✅ Query 5: Valores diferentes permitidos em coluna UNIQUE', async () => {
      console.log(
        '    ✓ Teste: ✅ Query 5: Valores diferentes permitidos em coluna UNIQUE',
      );

      const { userId, cleanup } = await setupTestUser();
      try {
        await executeSql(
          userId,
          `CREATE TABLE users (
            id INT,
            email VARCHAR(255) UNIQUE
          )`,
        );

        for (let i = 1; i <= 10; i++) {
          await executeSql(
            userId,
            `INSERT INTO users VALUES (${i}, 'user${i}@example.com')`,
          );
        }

        const records = await getAllRecords(userId, 'users');
        expect(records).toHaveLength(10);

        // Verificar que todos os emails são únicos
        const emails = records.map((r: any) => r.email);
        const uniqueEmails = new Set(emails);
        expect(uniqueEmails.size).toBe(10);
      } finally {
        await cleanup();
      }
    });

    it('✅ Query 6: UPDATE do mesmo registro não viola UNIQUE', async () => {
      console.log(
        '    ✓ Teste: ✅ Query 6: UPDATE do mesmo registro não viola UNIQUE',
      );

      const { userId, cleanup } = await setupTestUser();
      try {
        await executeSql(
          userId,
          `CREATE TABLE users (
            id INT,
            email VARCHAR(255) UNIQUE,
            age INT
          )`,
        );

        await executeSql(
          userId,
          `INSERT INTO users VALUES (1, 'test@example.com', 25)`,
        );

        // Atualizar outro campo, mantendo email igual
        await executeSql(
          userId,
          `UPDATE users SET age = 26 WHERE email = 'test@example.com'`,
        );

        const records = await getAllRecords(userId, 'users');
        expect(records).toHaveLength(1);
        expect(records[0].age).toBe(26);
        expect(records[0].email).toBe('test@example.com');
      } finally {
        await cleanup();
      }
    });

    it('✅ Query 7: Múltiplas colunas UNIQUE independentes', async () => {
      console.log(
        '    ✓ Teste: ✅ Query 7: Múltiplas colunas UNIQUE independentes',
      );

      const { userId, cleanup } = await setupTestUser();
      try {
        await executeSql(
          userId,
          `CREATE TABLE users (
            id INT,
            email VARCHAR(255) UNIQUE,
            username VARCHAR(100) UNIQUE,
            phone VARCHAR(20) UNIQUE
          )`,
        );

        await executeSql(
          userId,
          `INSERT INTO users VALUES (1, 'user1@example.com', 'user1', '1111111111')`,
        );

        // Deve falhar se duplicar email
        await expectSqlError(
          userId,
          `INSERT INTO users VALUES (2, 'user1@example.com', 'user2', '2222222222')`,
        );

        // Deve falhar se duplicar username
        await expectSqlError(
          userId,
          `INSERT INTO users VALUES (3, 'user3@example.com', 'user1', '3333333333')`,
        );

        // Deve falhar se duplicar phone
        await expectSqlError(
          userId,
          `INSERT INTO users VALUES (4, 'user4@example.com', 'user4', '1111111111')`,
        );

        // Deve funcionar com todos valores únicos
        await executeSql(
          userId,
          `INSERT INTO users VALUES (5, 'user5@example.com', 'user5', '5555555555')`,
        );

        const records = await getAllRecords(userId, 'users');
        expect(records).toHaveLength(2);
      } finally {
        await cleanup();
      }
    });
  });
});
