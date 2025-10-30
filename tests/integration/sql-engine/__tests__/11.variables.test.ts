/**
 * SQL Engine - Variables
 *
 * Testa substituição de variáveis em queries SQL:
 * - {{variable}} syntax
 * - Variáveis em diferentes contextos (WHERE, INSERT, VALUES)
 * - Variáveis com tipos diferentes (string, number, boolean)
 * - Variáveis não definidas
 */

import {
  setupTestUser,
  executeSql,
  getAllRecords,
} from '../../../helpers/sql-engine';

describe('SQL Engine - Variables', () => {
  describe('Variable Substitution - Basic', () => {
    it('deve substituir variável em WHERE', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE users (id INT, name VARCHAR(50))`,
        );
        await executeSql(
          userId,
          `INSERT INTO users VALUES (1, 'Alice'), (2, 'Bob')`,
        );

        const result = await executeSql(
          userId,
          `SELECT * FROM users WHERE id = {{userId}}`,
          { userId: 1 },
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Alice');
      } finally {
        await cleanup();
      }
    });

    it('deve substituir variável string em WHERE', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE products (id INT, category VARCHAR(50))`,
        );
        await executeSql(
          userId,
          `INSERT INTO products VALUES (1, 'electronics'), (2, 'books')`,
        );

        const result = await executeSql(
          userId,
          `SELECT * FROM products WHERE category = '{{cat}}'`,
          { cat: 'electronics' },
        );

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(1);
      } finally {
        await cleanup();
      }
    });

    it('deve substituir múltiplas variáveis', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE orders (id INT, customer_id INT, status VARCHAR(20))`,
        );
        await executeSql(
          userId,
          `INSERT INTO orders VALUES 
          (1, 1, 'pending'),
          (2, 1, 'approved'),
          (3, 2, 'pending')`,
        );

        const result = await executeSql(
          userId,
          `SELECT * FROM orders WHERE customer_id = {{cid}} AND status = '{{status}}'`,
          { cid: 1, status: 'pending' },
        );

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(1);
      } finally {
        await cleanup();
      }
    });
  });

  describe('Variable Substitution - INSERT', () => {
    it('deve substituir variáveis em INSERT VALUES', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE logs (id INT, message VARCHAR(100))`,
        );

        await executeSql(
          userId,
          `INSERT INTO logs VALUES ({{id}}, '{{msg}}')`,
          { id: 1, msg: 'Test message' },
        );

        const records = await getAllRecords(userId, 'logs');
        expect(records[0]).toMatchObject({ id: 1, message: 'Test message' });
      } finally {
        await cleanup();
      }
    });
  });

  describe('Variable Substitution - UPDATE', () => {
    it('deve substituir variáveis em UPDATE SET e WHERE', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE counters (id INT, value INT)`);
        await executeSql(userId, `INSERT INTO counters VALUES (1, 0), (2, 0)`);

        await executeSql(
          userId,
          `UPDATE counters SET value = {{newValue}} WHERE id = {{counterId}}`,
          { newValue: 100, counterId: 1 },
        );

        const records = await getAllRecords(userId, 'counters');
        const updated = records.find((r: any) => r.id === 1);
        expect(updated.value).toBe(100);
      } finally {
        await cleanup();
      }
    });
  });

  describe('Variable Substitution - DELETE', () => {
    it('deve substituir variáveis em DELETE WHERE', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE tasks (id INT, status VARCHAR(20))`,
        );
        await executeSql(
          userId,
          `INSERT INTO tasks VALUES (1, 'done'), (2, 'pending')`,
        );

        await executeSql(
          userId,
          `DELETE FROM tasks WHERE status = '{{status}}'`,
          { status: 'done' },
        );

        const records = await getAllRecords(userId, 'tasks');
        expect(records).toHaveLength(1);
        expect(records[0].status).toBe('pending');
      } finally {
        await cleanup();
      }
    });
  });

  describe('Variable Types', () => {
    it('deve tratar números corretamente', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE numbers (id INT, value INT)`);
        await executeSql(
          userId,
          `INSERT INTO numbers VALUES ({{id}}, {{value}})`,
          { id: 1, value: 42 },
        );

        const records = await getAllRecords(userId, 'numbers');
        expect(records[0].id).toBe(1);
        expect(records[0].value).toBe(42);
        expect(typeof records[0].value).toBe('number');
      } finally {
        await cleanup();
      }
    });

    it('deve tratar booleanos corretamente', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE flags (id INT, active INT)`);
        await executeSql(userId, `INSERT INTO flags VALUES (1, {{active}})`, {
          active: 1,
        });

        const records = await getAllRecords(userId, 'flags');
        expect(records[0].active).toBe(1);
      } finally {
        await cleanup();
      }
    });

    it('deve tratar NULL corretamente', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE nullable (id INT, value INT)`);
        await executeSql(userId, `INSERT INTO nullable VALUES (1, {{value}})`, {
          value: null,
        });

        const records = await getAllRecords(userId, 'nullable');
        expect(records).toHaveLength(1);
        expect(records[0].value).toBeNull();
      } finally {
        await cleanup();
      }
    });
  });

  describe('Variable Edge Cases', () => {
    it('deve funcionar quando variável não é fornecida mas não é usada', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE simple (id INT)`);

        // Query sem variáveis, mas variables={} fornecido
        await executeSql(userId, `INSERT INTO simple VALUES (1)`, {});

        const records = await getAllRecords(userId, 'simple');
        expect(records).toHaveLength(1);
      } finally {
        await cleanup();
      }
    });

    it('query sem variáveis deve funcionar sem passar variables', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE test (id INT)`);
        await executeSql(userId, `INSERT INTO test VALUES (1)`);

        const records = await getAllRecords(userId, 'test');
        expect(records).toHaveLength(1);
      } finally {
        await cleanup();
      }
    });

    it('deve preservar espaços em strings', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE messages (id INT, text VARCHAR(100))`,
        );
        await executeSql(
          userId,
          `INSERT INTO messages VALUES (1, '{{text}}')`,
          { text: 'Hello World' },
        );

        const records = await getAllRecords(userId, 'messages');
        expect(records[0].text).toBe('Hello World');
      } finally {
        await cleanup();
      }
    });
  });

  describe('Variables in Complex Queries', () => {
    it('deve substituir variáveis em JOIN', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE orders (id INT, customer_id INT)`,
        );
        await executeSql(
          userId,
          `CREATE TABLE customers (id INT, name VARCHAR(50))`,
        );

        await executeSql(userId, `INSERT INTO orders VALUES (1, 1), (2, 2)`);
        await executeSql(
          userId,
          `INSERT INTO customers VALUES (1, 'Alice'), (2, 'Bob')`,
        );

        const result = await executeSql(
          userId,
          `SELECT c.name FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.id = {{orderId}}`,
          { orderId: 1 },
        );

        expect(result[0].name).toBe('Alice');
      } finally {
        await cleanup();
      }
    });

    it('deve substituir variáveis em agregações', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE sales (id INT, region VARCHAR(20), amount INT)`,
        );
        await executeSql(
          userId,
          `INSERT INTO sales VALUES 
          (1, 'North', 100),
          (2, 'North', 200),
          (3, 'South', 150)`,
        );

        const result = await executeSql(
          userId,
          `SELECT SUM(amount) as total FROM sales WHERE region = '{{region}}'`,
          { region: 'North' },
        );

        expect(result[0].total).toBe(300);
      } finally {
        await cleanup();
      }
    });
  });
});
