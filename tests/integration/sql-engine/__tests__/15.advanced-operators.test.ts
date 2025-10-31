/**
 * SQL ENGINE TESTS - Advanced Operators
 *
 * Tests: LIKE, ILIKE, BETWEEN, IN with subquery
 */

import { setupTestUser, executeSql } from '../../../helpers/sql-engine';

describe('SQL Engine - Advanced Operators', () => {
  let userId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupTestUser();
    userId = setup.userId;
    cleanup = setup.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  describe('LIKE and ILIKE operators', () => {
    beforeEach(async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS users`);
      await executeSql(
        userId,
        `CREATE TABLE users (
        id INT,
        name VARCHAR(100),
        email VARCHAR(100)
      )`,
      );

      await executeSql(
        userId,
        `INSERT INTO users VALUES
        (1, 'John Doe', 'john@example.com'),
        (2, 'Jane Smith', 'jane@EXAMPLE.COM'),
        (3, 'Bob Johnson', 'bob@test.com'),
        (4, 'Alice Williams', 'alice@example.com')`,
      );
    });

    test('LIKE with % wildcard at end', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name FROM users WHERE name LIKE 'John%' ORDER BY name
      `,
      );

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('John Doe');
    });

    test('LIKE with % wildcard at start', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name FROM users WHERE name LIKE '%Smith'
      `,
      );

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Jane Smith');
    });

    test('LIKE with % wildcards on both sides', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name, email FROM users WHERE email LIKE '%example%' ORDER BY id
      `,
      );

      // LIKE é case-sensitive, então só faz match com lowercase 'example'
      expect(result.length).toBe(2);
      expect(result[0].email).toBe('john@example.com');
      expect(result[1].email).toBe('alice@example.com');
    });

    test('ILIKE is case-insensitive', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name FROM users WHERE email ILIKE '%EXAMPLE%' ORDER BY id
      `,
      );

      expect(result.length).toBe(3);
    });

    test('NOT LIKE excludes matching rows', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name, email FROM users WHERE email NOT LIKE '%example%' ORDER BY id
      `,
      );

      // NOT LIKE é case-sensitive, exclui apenas lowercase 'example'
      expect(result.length).toBe(2);
      expect(result[0].email).toBe('jane@EXAMPLE.COM');
      expect(result[1].email).toBe('bob@test.com');
    });

    test('LIKE without wildcards acts as equals', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name FROM users WHERE name LIKE 'John Doe'
      `,
      );

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('John Doe');
    });

    test('LIKE returns empty for no matches', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT * FROM users WHERE name LIKE 'Nonexistent%'
      `,
      );

      expect(result.length).toBe(0);
    });
  });

  describe('BETWEEN operator', () => {
    beforeEach(async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS products`);
      await executeSql(
        userId,
        `CREATE TABLE products (
        id INT,
        name VARCHAR(50),
        price INT,
        stock INT
      )`,
      );

      await executeSql(
        userId,
        `INSERT INTO products VALUES
        (1, 'Product A', 10, 100),
        (2, 'Product B', 25, 50),
        (3, 'Product C', 50, 25),
        (4, 'Product D', 75, 10),
        (5, 'Product E', 100, 5)`,
      );
    });

    test('BETWEEN includes boundary values', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name, price FROM products 
        WHERE price BETWEEN 25 AND 75 
        ORDER BY price
      `,
      );

      expect(result.length).toBe(3);
      expect(result[0].price).toBe(25);
      expect(result[1].price).toBe(50);
      expect(result[2].price).toBe(75);
    });

    test('BETWEEN with equal boundaries', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name FROM products WHERE price BETWEEN 50 AND 50
      `,
      );

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Product C');
    });

    test('NOT BETWEEN excludes range', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name, price FROM products 
        WHERE price NOT BETWEEN 25 AND 75 
        ORDER BY price
      `,
      );

      expect(result.length).toBe(2);
      expect(result[0].price).toBe(10);
      expect(result[1].price).toBe(100);
    });

    test('BETWEEN with no matches returns empty', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT * FROM products WHERE price BETWEEN 200 AND 300
      `,
      );

      expect(result.length).toBe(0);
    });

    test('BETWEEN works with negative numbers', async () => {
      await executeSql(
        userId,
        `INSERT INTO products VALUES (6, 'Product F', -10, 0)`,
      );

      const result = await executeSql(
        userId,
        `
        SELECT name FROM products WHERE price BETWEEN -10 AND 10 ORDER BY price
      `,
      );

      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Product F');
    });
  });

  describe('IN operator with subquery', () => {
    beforeEach(async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS employees`);
      await executeSql(userId, `DROP TABLE IF EXISTS departments`);
      await executeSql(
        userId,
        `CREATE TABLE departments (
        id INT,
        name VARCHAR(50)
      )`,
      );

      await executeSql(
        userId,
        `CREATE TABLE employees (
        id INT,
        name VARCHAR(50),
        dept_id INT,
        salary INT
      )`,
      );

      await executeSql(
        userId,
        `INSERT INTO departments VALUES
        (1, 'Engineering'),
        (2, 'Sales'),
        (3, 'Marketing')`,
      );

      await executeSql(
        userId,
        `INSERT INTO employees VALUES
        (1, 'Alice', 1, 100000),
        (2, 'Bob', 1, 90000),
        (3, 'Carol', 2, 80000),
        (4, 'Dave', 2, 85000),
        (5, 'Eve', 3, 70000)`,
      );
    });

    test('IN with subquery filters correctly', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name FROM employees 
        WHERE dept_id IN (SELECT id FROM departments WHERE name LIKE '%ing%')
        ORDER BY name
      `,
      );

      expect(result.length).toBe(3);
      expect(result[0].name).toBe('Alice');
      expect(result[1].name).toBe('Bob');
      expect(result[2].name).toBe('Eve');
    });

    test('NOT IN with subquery excludes correctly', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name FROM employees 
        WHERE dept_id NOT IN (SELECT id FROM departments WHERE name = 'Sales')
        ORDER BY name
      `,
      );

      expect(result.length).toBe(3);
      expect(result[0].name).toBe('Alice');
      expect(result[1].name).toBe('Bob');
      expect(result[2].name).toBe('Eve');
    });

    test('IN with empty subquery returns empty', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name FROM employees 
        WHERE dept_id IN (SELECT id FROM departments WHERE name = 'Nonexistent')
      `,
      );

      expect(result.length).toBe(0);
    });

    test('IN with literal values still works', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name FROM employees WHERE dept_id IN (1, 3) ORDER BY name
      `,
      );

      expect(result.length).toBe(3);
      expect(result[0].name).toBe('Alice');
    });

    test('IN with subquery returning multiple values', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name FROM employees 
        WHERE salary IN (SELECT salary FROM employees WHERE salary >= 85000)
        ORDER BY salary DESC
      `,
      );

      // Salários >= 85000: Alice (100000), Bob (90000), Dave (85000)
      expect(result.length).toBe(3);
      expect(result[0].name).toBe('Alice');
      expect(result[1].name).toBe('Bob');
      expect(result[2].name).toBe('Dave');
    });
  });

  describe('Error cases', () => {
    test('LIKE with invalid pattern handles gracefully', async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS test_table`);
      await executeSql(userId, `CREATE TABLE test_table (name VARCHAR(50))`);
      await executeSql(userId, `INSERT INTO test_table VALUES ('test')`);

      const result = await executeSql(
        userId,
        `
        SELECT * FROM test_table WHERE name LIKE ''
      `,
      );

      expect(result.length).toBe(0);
    });

    test('BETWEEN with reversed boundaries returns empty', async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS numbers`);
      await executeSql(userId, `CREATE TABLE numbers (value INT)`);
      await executeSql(userId, `INSERT INTO numbers VALUES (5), (10), (15)`);

      const result = await executeSql(
        userId,
        `
        SELECT * FROM numbers WHERE value BETWEEN 15 AND 5
      `,
      );

      // BETWEEN com valores invertidos retorna vazio (comportamento SQL padrão)
      expect(result.length).toBe(0);
    });
  });
});
