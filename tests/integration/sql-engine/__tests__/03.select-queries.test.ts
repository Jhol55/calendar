/**
 * SQL Engine - SELECT Queries
 *
 * Testa queries SELECT com:
 * - WHERE (comparações, AND, OR, IN, LIKE, BETWEEN, IS NULL)
 * - ORDER BY
 * - LIMIT / OFFSET
 * - DISTINCT
 */

import { setupTestUser, executeSql } from '../../../helpers/sql-engine';

describe('SQL Engine - SELECT Queries', () => {
  describe('WHERE Clauses', () => {
    it('WHERE com operadores de comparação (=, !=, >, <, >=, <=)', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE numbers (id INT, value INT)`);
        await executeSql(
          userId,
          `INSERT INTO numbers VALUES (1, 10), (2, 20), (3, 30), (4, 40)`,
        );

        const equals = await executeSql(
          userId,
          `SELECT * FROM numbers WHERE value = 20`,
        );
        expect(equals).toHaveLength(1);
        expect(equals[0].value).toBe(20);

        const notEquals = await executeSql(
          userId,
          `SELECT * FROM numbers WHERE value != 20`,
        );
        expect(notEquals).toHaveLength(3);

        const greaterThan = await executeSql(
          userId,
          `SELECT * FROM numbers WHERE value > 20`,
        );
        expect(greaterThan).toHaveLength(2);

        const lessThanOrEqual = await executeSql(
          userId,
          `SELECT * FROM numbers WHERE value <= 20`,
        );
        expect(lessThanOrEqual).toHaveLength(2);
      } finally {
        await cleanup();
      }
    });

    it('WHERE com AND e OR', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE products (id INT, category VARCHAR(20), price INT)`,
        );
        await executeSql(
          userId,
          `INSERT INTO products VALUES 
          (1, 'electronics', 100),
          (2, 'electronics', 200),
          (3, 'books', 15),
          (4, 'books', 25)`,
        );

        const and = await executeSql(
          userId,
          `
          SELECT * FROM products 
          WHERE category = 'electronics' AND price > 150
        `,
        );
        expect(and).toHaveLength(1);
        expect(and[0].price).toBe(200);

        const or = await executeSql(
          userId,
          `
          SELECT * FROM products 
          WHERE category = 'electronics' OR price < 20
        `,
        );
        expect(or).toHaveLength(3);
      } finally {
        await cleanup();
      }
    });

    it('WHERE com IN', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE items (id INT, status VARCHAR(20))`,
        );
        await executeSql(
          userId,
          `INSERT INTO items VALUES 
          (1, 'active'), (2, 'pending'), (3, 'archived'), (4, 'active')`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT * FROM items WHERE status IN ('active', 'pending')
        `,
        );
        expect(result).toHaveLength(3);
      } finally {
        await cleanup();
      }
    });

    it('WHERE com LIKE', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE users (id INT, email VARCHAR(50))`,
        );
        await executeSql(
          userId,
          `INSERT INTO users VALUES 
          (1, 'alice@gmail.com'),
          (2, 'bob@yahoo.com'),
          (3, 'charlie@gmail.com')`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT * FROM users WHERE email LIKE '%gmail%'
        `,
        );
        expect(result).toHaveLength(2);
      } finally {
        await cleanup();
      }
    });

    it('WHERE com BETWEEN', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE scores (id INT, points INT)`);
        await executeSql(
          userId,
          `INSERT INTO scores VALUES (1, 50), (2, 75), (3, 90), (4, 100)`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT * FROM scores WHERE points BETWEEN 70 AND 95
        `,
        );
        expect(result).toHaveLength(2);
        expect(result.map((r: any) => r.points).sort()).toEqual([75, 90]);
      } finally {
        await cleanup();
      }
    });

    it('WHERE com IS NULL / IS NOT NULL', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE data (id INT, value INT)`);
        await executeSql(
          userId,
          `INSERT INTO data VALUES (1, 10), (2, NULL), (3, 30)`,
        );

        const isNull = await executeSql(
          userId,
          `SELECT * FROM data WHERE value IS NULL`,
        );
        expect(isNull).toHaveLength(1);

        const isNotNull = await executeSql(
          userId,
          `SELECT * FROM data WHERE value IS NOT NULL`,
        );
        expect(isNotNull).toHaveLength(2);
      } finally {
        await cleanup();
      }
    });
  });

  describe('ORDER BY', () => {
    it('ORDER BY ASC e DESC', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE scores (id INT, points INT)`);
        await executeSql(
          userId,
          `INSERT INTO scores VALUES (1, 30), (2, 10), (3, 20)`,
        );

        const asc = await executeSql(
          userId,
          `SELECT * FROM scores ORDER BY points ASC`,
        );
        expect(asc.map((r: any) => r.points)).toEqual([10, 20, 30]);

        const desc = await executeSql(
          userId,
          `SELECT * FROM scores ORDER BY points DESC`,
        );
        expect(desc.map((r: any) => r.points)).toEqual([30, 20, 10]);
      } finally {
        await cleanup();
      }
    });

    it('ORDER BY com múltiplas colunas', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE users (id INT, age INT, name VARCHAR(20))`,
        );
        await executeSql(
          userId,
          `INSERT INTO users VALUES 
          (1, 25, 'Charlie'),
          (2, 25, 'Alice'),
          (3, 30, 'Bob')`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT * FROM users ORDER BY age ASC, name ASC
        `,
        );
        expect(result[0].name).toBe('Alice');
        expect(result[1].name).toBe('Charlie');
        expect(result[2].name).toBe('Bob');
      } finally {
        await cleanup();
      }
    });
  });

  describe('LIMIT and OFFSET', () => {
    it('LIMIT deve retornar quantidade correta', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE items (id INT)`);
        await executeSql(
          userId,
          `INSERT INTO items VALUES (1), (2), (3), (4), (5)`,
        );

        const result = await executeSql(userId, `SELECT * FROM items LIMIT 3`);
        expect(result).toHaveLength(3);
      } finally {
        await cleanup();
      }
    });

    it('OFFSET deve pular registros corretamente', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE items (id INT)`);
        await executeSql(
          userId,
          `INSERT INTO items VALUES (1), (2), (3), (4), (5)`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT * FROM items ORDER BY id LIMIT 2 OFFSET 2
        `,
        );
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe(3);
        expect(result[1].id).toBe(4);
      } finally {
        await cleanup();
      }
    });
  });

  describe('DISTINCT', () => {
    it('DISTINCT deve remover duplicatas', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE orders (id INT, status VARCHAR(20))`,
        );
        await executeSql(
          userId,
          `INSERT INTO orders VALUES 
          (1, 'pending'), (2, 'approved'), (3, 'pending'), (4, 'approved'), (5, 'pending')`,
        );

        const result = await executeSql(
          userId,
          `SELECT DISTINCT status FROM orders`,
        );
        expect(result).toHaveLength(2);
      } finally {
        await cleanup();
      }
    });
  });

  describe('SELECT specific columns', () => {
    it('SELECT com colunas específicas', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE users (id INT, name VARCHAR(50), email VARCHAR(50), age INT)`,
        );
        await executeSql(
          userId,
          `INSERT INTO users VALUES (1, 'Alice', 'alice@test.com', 25)`,
        );

        const result = await executeSql(userId, `SELECT name, age FROM users`);
        expect(result[0]).toMatchObject({ name: 'Alice', age: 25 });
        expect(result[0].email).toBeUndefined();
      } finally {
        await cleanup();
      }
    });

    it('SELECT com aliases', async () => {
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

        const result = await executeSql(
          userId,
          `
          SELECT name AS product_name, price AS product_price FROM products
        `,
        );
        expect(result[0]).toHaveProperty('product_name', 'Laptop');
        expect(result[0]).toHaveProperty('product_price', 1000);
      } finally {
        await cleanup();
      }
    });
  });
});
