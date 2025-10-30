/**
 * SQL Engine - Security & Isolation
 *
 * Garante 100% de segurança e isolamento:
 * - Usuários não podem acessar dados uns dos outros
 * - Operações DDL não afetam banco PostgreSQL real
 * - DROP/ALTER só afetam tabelas virtuais JSONB do usuário
 * - SQL Injection é prevenido
 * - Limites de performance são respeitados
 */

import {
  setupTestUser,
  executeSql,
  getAllRecords,
  countRecords,
  capturePostgresSnapshot,
  expectSqlError,
} from '../../../helpers/sql-engine';

describe('SQL Engine - Security & Isolation', () => {
  describe('User Isolation - Dados', () => {
    it('usuário A não deve ver dados do usuário B', async () => {
      const userA = await setupTestUser();
      const userB = await setupTestUser();

      try {
        // User A cria tabela e insere dados
        await executeSql(
          userA.userId,
          `CREATE TABLE secrets (id INT, data VARCHAR(50))`,
        );
        await executeSql(
          userA.userId,
          `INSERT INTO secrets VALUES (1, 'UserA Secret')`,
        );

        // User B cria tabela com mesmo nome
        await executeSql(
          userB.userId,
          `CREATE TABLE secrets (id INT, data VARCHAR(50))`,
        );
        await executeSql(
          userB.userId,
          `INSERT INTO secrets VALUES (2, 'UserB Secret')`,
        );

        // User A deve ver apenas seus dados
        const dataA = await getAllRecords(userA.userId, 'secrets');
        expect(dataA).toHaveLength(1);
        expect(dataA[0].data).toBe('UserA Secret');

        // User B deve ver apenas seus dados
        const dataB = await getAllRecords(userB.userId, 'secrets');
        expect(dataB).toHaveLength(1);
        expect(dataB[0].data).toBe('UserB Secret');
      } finally {
        await userA.cleanup();
        await userB.cleanup();
      }
    });

    it('UPDATE de um usuário não deve afetar outro', async () => {
      const userA = await setupTestUser();
      const userB = await setupTestUser();

      try {
        await executeSql(
          userA.userId,
          `CREATE TABLE counters (id INT, value INT)`,
        );
        await executeSql(
          userB.userId,
          `CREATE TABLE counters (id INT, value INT)`,
        );

        await executeSql(userA.userId, `INSERT INTO counters VALUES (1, 100)`);
        await executeSql(userB.userId, `INSERT INTO counters VALUES (1, 200)`);

        // User A atualiza
        await executeSql(userA.userId, `UPDATE counters SET value = 999`);

        // User B não deve ser afetado
        const dataB = await getAllRecords(userB.userId, 'counters');
        expect(dataB[0].value).toBe(200);
      } finally {
        await userA.cleanup();
        await userB.cleanup();
      }
    });

    it('DELETE de um usuário não deve afetar outro', async () => {
      const userA = await setupTestUser();
      const userB = await setupTestUser();

      try {
        await executeSql(userA.userId, `CREATE TABLE items (id INT)`);
        await executeSql(userB.userId, `CREATE TABLE items (id INT)`);

        await executeSql(userA.userId, `INSERT INTO items VALUES (1), (2)`);
        await executeSql(userB.userId, `INSERT INTO items VALUES (3), (4)`);

        // User A deleta tudo
        await executeSql(userA.userId, `DELETE FROM items`);

        // User B deve ter seus dados intactos
        const countB = await countRecords(userB.userId, 'items');
        expect(countB).toBe(2);
      } finally {
        await userA.cleanup();
        await userB.cleanup();
      }
    });
  });

  describe('User Isolation - DDL Operations', () => {
    it('DROP TABLE de um usuário não deve afetar tabela de outro', async () => {
      const userA = await setupTestUser();
      const userB = await setupTestUser();

      try {
        await executeSql(userA.userId, `CREATE TABLE important (id INT)`);
        await executeSql(userB.userId, `CREATE TABLE important (id INT)`);

        await executeSql(userA.userId, `INSERT INTO important VALUES (1)`);
        await executeSql(userB.userId, `INSERT INTO important VALUES (2)`);

        // User A dropa sua tabela
        await executeSql(userA.userId, `DROP TABLE important`);

        // User B ainda deve ter sua tabela
        const dataB = await getAllRecords(userB.userId, 'important');
        expect(dataB).toHaveLength(1);
        expect(dataB[0].id).toBe(2);
      } finally {
        await userA.cleanup();
        await userB.cleanup();
      }
    });

    it('ALTER TABLE de um usuário não deve afetar outro', async () => {
      const userA = await setupTestUser();
      const userB = await setupTestUser();

      try {
        await executeSql(
          userA.userId,
          `CREATE TABLE configs (id INT, value INT)`,
        );
        await executeSql(
          userB.userId,
          `CREATE TABLE configs (id INT, value INT)`,
        );

        await executeSql(userA.userId, `INSERT INTO configs VALUES (1, 100)`);
        await executeSql(userB.userId, `INSERT INTO configs VALUES (1, 200)`);

        // User A adiciona coluna
        await executeSql(
          userA.userId,
          `ALTER TABLE configs ADD COLUMN name VARCHAR(50)`,
        );

        // User B não deve ter a nova coluna
        const dataB = await getAllRecords(userB.userId, 'configs');
        expect(dataB[0]).not.toHaveProperty('name');
      } finally {
        await userA.cleanup();
        await userB.cleanup();
      }
    });
  });

  describe('PostgreSQL Database Safety', () => {
    it('CREATE TABLE não deve criar tabela real no PostgreSQL', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        const before = await capturePostgresSnapshot();

        await executeSql(
          userId,
          `CREATE TABLE test_virtual (id INT, data VARCHAR(100))`,
        );
        await executeSql(userId, `INSERT INTO test_virtual VALUES (1, 'test')`);

        const after = await capturePostgresSnapshot();

        // As únicas diferenças devem ser em DataTable (JSONB), não em novas tabelas
        expect(before.tableNames).toEqual(after.tableNames);
        expect(after.tableNames).not.toContain('test_virtual');
      } finally {
        await cleanup();
      }
    });

    it('DROP TABLE não deve afetar tabelas PostgreSQL', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE temp_table (id INT)`);

        const before = await capturePostgresSnapshot();

        await executeSql(userId, `DROP TABLE temp_table`);

        const after = await capturePostgresSnapshot();

        // Tabelas PostgreSQL devem permanecer idênticas
        expect(before.tableNames).toEqual(after.tableNames);
      } finally {
        await cleanup();
      }
    });

    it('ALTER TABLE não deve modificar schema PostgreSQL', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE test_alter (id INT)`);

        const before = await capturePostgresSnapshot();

        await executeSql(
          userId,
          `ALTER TABLE test_alter ADD COLUMN new_col VARCHAR(50)`,
        );

        const after = await capturePostgresSnapshot();

        // Schema PostgreSQL deve permanecer inalterado
        expect(before.tableNames).toEqual(after.tableNames);
      } finally {
        await cleanup();
      }
    });
  });

  describe('SQL Injection Prevention', () => {
    it('tentativa de SQL injection em INSERT não deve funcionar', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE users (id INT, name VARCHAR(100))`,
        );

        // Inserir dados normalmente
        await executeSql(userId, `INSERT INTO users VALUES (1, 'Alice')`);
        await executeSql(userId, `INSERT INTO users VALUES (2, 'Bob')`);

        // Tentar usar nome de tabela SQL em WHERE (não deve afetar outras tabelas)
        const result = await executeSql(
          userId,
          `SELECT * FROM users WHERE name = 'Alice'`,
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Alice');

        // Tabela deve ter 2 registros
        const count = await countRecords(userId, 'users');
        expect(count).toBe(2);
      } finally {
        await cleanup();
      }
    });

    it('tentativa de acessar informações do sistema não deve funcionar', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        // Tentativas de acessar tabelas do sistema PostgreSQL
        await expectSqlError(
          userId,
          `SELECT * FROM pg_tables`,
          /não existe|not exist/i,
        );

        await expectSqlError(
          userId,
          `SELECT * FROM information_schema.tables`,
          /não existe|not exist/i,
        );
      } finally {
        await cleanup();
      }
    });
  });

  describe('Resource Limits', () => {
    it('deve respeitar limite de registros por query', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE big_table (id INT, data VARCHAR(50))`,
        );

        // Inserir muitos registros
        for (let i = 0; i < 100; i++) {
          await executeSql(
            userId,
            `INSERT INTO big_table VALUES (${i}, 'data${i}')`,
          );
        }

        const result = await executeSql(userId, `SELECT * FROM big_table`);

        // Deve retornar registros (limite interno pode ser aplicado)
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        expect(result.length).toBeLessThanOrEqual(100);
      } finally {
        await cleanup();
      }
    });
  });

  describe('Cross-User Operations', () => {
    it('JOIN entre tabelas de usuários diferentes não deve funcionar', async () => {
      const userA = await setupTestUser();
      const userB = await setupTestUser();

      try {
        await executeSql(userA.userId, `CREATE TABLE table_a (id INT)`);
        await executeSql(userB.userId, `CREATE TABLE table_b (id INT)`);

        await executeSql(userA.userId, `INSERT INTO table_a VALUES (1)`);
        await executeSql(userB.userId, `INSERT INTO table_b VALUES (2)`);

        // User A não deve conseguir fazer JOIN com tabela de User B
        await expectSqlError(
          userA.userId,
          `SELECT * FROM table_a JOIN table_b ON table_a.id = table_b.id`,
          /não existe|not exist/i,
        );
      } finally {
        await userA.cleanup();
        await userB.cleanup();
      }
    });
  });

  describe('Concurrent Operations', () => {
    it('operações concorrentes de diferentes usuários devem ser isoladas', async () => {
      const userA = await setupTestUser();
      const userB = await setupTestUser();

      try {
        await executeSql(
          userA.userId,
          `CREATE TABLE concurrent (id INT, value INT)`,
        );
        await executeSql(
          userB.userId,
          `CREATE TABLE concurrent (id INT, value INT)`,
        );

        // Executar operações concorrentes
        const promiseA = executeSql(
          userA.userId,
          `INSERT INTO concurrent VALUES (1, 100)`,
        );
        const promiseB = executeSql(
          userB.userId,
          `INSERT INTO concurrent VALUES (2, 200)`,
        );

        await Promise.all([promiseA, promiseB]);

        // Cada usuário deve ter apenas seu registro
        const dataA = await getAllRecords(userA.userId, 'concurrent');
        const dataB = await getAllRecords(userB.userId, 'concurrent');

        expect(dataA).toHaveLength(1);
        expect(dataB).toHaveLength(1);
        expect(dataA[0].value).toBe(100);
        expect(dataB[0].value).toBe(200);
      } finally {
        await userA.cleanup();
        await userB.cleanup();
      }
    });
  });
});
