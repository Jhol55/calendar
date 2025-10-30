/**
 * SQL Engine - DML Operations (INSERT, UPDATE, DELETE)
 *
 * Testa operações de manipulação de dados:
 * - INSERT (com/sem colunas, múltiplos valores)
 * - UPDATE (com WHERE, sem WHERE)
 * - DELETE (com WHERE, sem WHERE)
 * - Validações de integridade
 */

import {
  setupTestUser,
  executeSql,
  getAllRecords,
  countRecords,
} from '../../../helpers/sql-engine';

describe('SQL Engine - DML Operations', () => {
  describe('INSERT', () => {
    it('deve inserir com colunas especificadas', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE users (id INT, name VARCHAR(100), age INT)`,
        );
        await executeSql(
          userId,
          `INSERT INTO users (id, name, age) VALUES (1, 'Alice', 25)`,
        );

        const records = await getAllRecords(userId, 'users');
        expect(records).toHaveLength(1);
        expect(records[0]).toMatchObject({ id: 1, name: 'Alice', age: 25 });
        expect(records[0]._id).toBeDefined();
        expect(records[0]._createdAt).toBeDefined();
      } finally {
        await cleanup();
      }
    });

    it('deve inserir sem especificar colunas', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE products (id INT, name VARCHAR(50), price INT)`,
        );
        await executeSql(
          userId,
          `INSERT INTO products VALUES (1, 'Laptop', 1000)`,
        );

        const records = await getAllRecords(userId, 'products');
        expect(records[0]).toMatchObject({
          id: 1,
          name: 'Laptop',
          price: 1000,
        });
        expect(records[0]._id).toBeDefined();
      } finally {
        await cleanup();
      }
    });

    it('deve inserir múltiplos registros de uma vez', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE items (id INT, value INT)`);
        await executeSql(
          userId,
          `INSERT INTO items VALUES (1, 100), (2, 200), (3, 300)`,
        );

        const count = await countRecords(userId, 'items');
        expect(count).toBe(3);

        const records = await getAllRecords(userId, 'items');
        expect(records[2].value).toBe(300);
      } finally {
        await cleanup();
      }
    });

    it('deve inserir com valores NULL', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE nullable (id INT, optional VARCHAR(50))`,
        );
        await executeSql(userId, `INSERT INTO nullable VALUES (1, NULL)`);

        const records = await getAllRecords(userId, 'nullable');
        expect(records[0].optional).toBeNull();
      } finally {
        await cleanup();
      }
    });
  });

  describe('UPDATE', () => {
    it('deve atualizar com WHERE', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE scores (id INT, points INT)`);
        await executeSql(
          userId,
          `INSERT INTO scores VALUES (1, 10), (2, 20), (3, 30)`,
        );

        await executeSql(userId, `UPDATE scores SET points = 100 WHERE id = 2`);

        const records = await getAllRecords(userId, 'scores');
        const record2 = records.find((r: any) => r.id === 2);
        expect(record2.points).toBe(100);

        // Outros registros não devem ser afetados
        const record1 = records.find((r: any) => r.id === 1);
        expect(record1.points).toBe(10);
      } finally {
        await cleanup();
      }
    });

    it('deve atualizar múltiplas colunas', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE users (id INT, name VARCHAR(50), age INT)`,
        );
        await executeSql(userId, `INSERT INTO users VALUES (1, 'Alice', 25)`);

        await executeSql(
          userId,
          `UPDATE users SET name = 'Bob', age = 30 WHERE id = 1`,
        );

        const records = await getAllRecords(userId, 'users');
        expect(records[0]).toMatchObject({ id: 1, name: 'Bob', age: 30 });
        expect(records[0]._id).toBeDefined();
      } finally {
        await cleanup();
      }
    });

    it('deve atualizar todos os registros sem WHERE', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE flags (id INT, active INT)`);
        await executeSql(
          userId,
          `INSERT INTO flags VALUES (1, 0), (2, 0), (3, 0)`,
        );

        await executeSql(userId, `UPDATE flags SET active = 1`);

        const records = await getAllRecords(userId, 'flags');
        expect(records.every((r: any) => r.active === 1)).toBe(true);
      } finally {
        await cleanup();
      }
    });
  });

  describe('DELETE', () => {
    it('deve deletar com WHERE', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE tasks (id INT, status VARCHAR(20))`,
        );
        await executeSql(
          userId,
          `INSERT INTO tasks VALUES (1, 'done'), (2, 'pending'), (3, 'done')`,
        );

        await executeSql(userId, `DELETE FROM tasks WHERE status = 'done'`);

        const records = await getAllRecords(userId, 'tasks');
        expect(records).toHaveLength(1);
        expect(records[0].status).toBe('pending');
      } finally {
        await cleanup();
      }
    });

    it('deve deletar todos os registros sem WHERE', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE temp (id INT)`);
        await executeSql(userId, `INSERT INTO temp VALUES (1), (2), (3)`);

        await executeSql(userId, `DELETE FROM temp`);

        const count = await countRecords(userId, 'temp');
        expect(count).toBe(0);
      } finally {
        await cleanup();
      }
    });

    it('DELETE não deve afetar outras tabelas', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE table_a (id INT)`);
        await executeSql(userId, `CREATE TABLE table_b (id INT)`);
        await executeSql(userId, `INSERT INTO table_a VALUES (1), (2)`);
        await executeSql(userId, `INSERT INTO table_b VALUES (3), (4)`);

        await executeSql(userId, `DELETE FROM table_a`);

        const countA = await countRecords(userId, 'table_a');
        const countB = await countRecords(userId, 'table_b');

        expect(countA).toBe(0);
        expect(countB).toBe(2);
      } finally {
        await cleanup();
      }
    });
  });

  describe('Complex DML Scenarios', () => {
    it('deve executar INSERT, UPDATE e DELETE em sequência', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE orders (id INT, status VARCHAR(20), total INT)`,
        );

        // INSERT
        await executeSql(
          userId,
          `INSERT INTO orders VALUES (1, 'pending', 100), (2, 'pending', 200)`,
        );
        expect(await countRecords(userId, 'orders')).toBe(2);

        // UPDATE
        await executeSql(
          userId,
          `UPDATE orders SET status = 'approved' WHERE id = 1`,
        );
        const afterUpdate = await getAllRecords(userId, 'orders');
        expect(afterUpdate.find((r: any) => r.id === 1).status).toBe(
          'approved',
        );

        // DELETE
        await executeSql(userId, `DELETE FROM orders WHERE id = 2`);
        expect(await countRecords(userId, 'orders')).toBe(1);
      } finally {
        await cleanup();
      }
    });
  });
});
