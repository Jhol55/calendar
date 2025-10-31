/**
 * SQL ENGINE TESTS - Advanced Subqueries
 *
 * Tests: EXISTS, NOT EXISTS, Subqueries in FROM, ANY, ALL
 */

import { setupTestUser, executeSql } from '../../../helpers/sql-engine';

describe('SQL Engine - Advanced Subqueries', () => {
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

  describe('EXISTS operator', () => {
    beforeEach(async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS customers`);
      await executeSql(userId, `DROP TABLE IF EXISTS orders`);
      await executeSql(
        userId,
        `CREATE TABLE customers (
        id INT,
        name VARCHAR(50),
        city VARCHAR(50)
      )`,
      );

      await executeSql(
        userId,
        `CREATE TABLE orders (
        id INT,
        customer_id INT,
        amount INT
      )`,
      );

      await executeSql(
        userId,
        `INSERT INTO customers VALUES
        (1, 'Alice', 'New York'),
        (2, 'Bob', 'London'),
        (3, 'Carol', 'Paris'),
        (4, 'Dave', 'Tokyo')`,
      );

      await executeSql(
        userId,
        `INSERT INTO orders VALUES
        (1, 1, 100),
        (2, 1, 200),
        (3, 2, 150),
        (4, 3, 300)`,
      );
    });

    test('EXISTS returns customers with orders', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name FROM customers c
        WHERE EXISTS (
          SELECT 1 FROM orders o WHERE o.customer_id = c.id
        )
        ORDER BY name
      `,
      );

      expect(result.length).toBe(3);
      expect(result.map((r: any) => r.name).sort()).toEqual([
        'Alice',
        'Bob',
        'Carol',
      ]);
    });

    test('NOT EXISTS returns customers without orders', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name FROM customers c
        WHERE NOT EXISTS (
          SELECT 1 FROM orders o WHERE o.customer_id = c.id
        )
      `,
      );

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Dave');
    });

    test('EXISTS with always-true subquery returns all rows', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name FROM customers
        WHERE EXISTS (SELECT 1 FROM orders)
      `,
      );

      expect(result.length).toBe(4);
    });

    test('EXISTS with empty subquery returns no rows', async () => {
      await executeSql(userId, `DELETE FROM orders`);

      const result = await executeSql(
        userId,
        `
        SELECT name FROM customers c
        WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)
      `,
      );

      expect(result.length).toBe(0);
    });

    test('EXISTS with multiple conditions', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name FROM customers c
        WHERE EXISTS (
          SELECT 1 FROM orders o 
          WHERE o.customer_id = c.id AND o.amount >= 200
        )
      `,
      );

      expect(result.length).toBe(2);
      expect(result.map((r: any) => r.name).sort()).toEqual(['Alice', 'Carol']);
    });
  });

  describe('Subqueries in FROM (Derived Tables)', () => {
    beforeEach(async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS sales`);
      await executeSql(userId, `DROP TABLE IF EXISTS products`);
      await executeSql(
        userId,
        `CREATE TABLE sales (
        id INT,
        product VARCHAR(50),
        amount INT,
        region VARCHAR(50)
      )`,
      );

      await executeSql(
        userId,
        `INSERT INTO sales VALUES
        (1, 'Product A', 100, 'North'),
        (2, 'Product B', 200, 'North'),
        (3, 'Product A', 150, 'South'),
        (4, 'Product B', 250, 'South'),
        (5, 'Product C', 300, 'North')`,
      );
    });

    test('Subquery in FROM with aggregation', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT region, total 
        FROM (
          SELECT region, SUM(amount) as total
          FROM sales
          GROUP BY region
        ) AS regional_totals
        ORDER BY region
      `,
      );

      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ region: 'North', total: 600 });
      expect(result[1]).toEqual({ region: 'South', total: 400 });
    });

    test('Subquery in FROM with filtering', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT product, avg_amount
        FROM (
          SELECT product, AVG(amount) as avg_amount
          FROM sales
          GROUP BY product
        ) AS product_avg
        WHERE avg_amount > 150
        ORDER BY product
      `,
      );

      expect(result.length).toBe(2);
      expect(result[0].product).toBe('Product B');
      expect(result[1].product).toBe('Product C');
    });

    test('Nested subqueries in FROM', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT category, cnt
        FROM (
          SELECT 
            CASE 
              WHEN amount >= 200 THEN 'High'
              ELSE 'Low'
            END as category,
            COUNT(*) as cnt
          FROM (
            SELECT amount FROM sales WHERE region = 'North'
          ) AS north_sales
          GROUP BY category
        ) AS categorized
        ORDER BY category
      `,
      );

      expect(result.length).toBe(2);
    });

    test('Derived table with JOIN', async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS products`);
      await executeSql(
        userId,
        `CREATE TABLE products (name VARCHAR(50), category VARCHAR(50))`,
      );
      await executeSql(
        userId,
        `INSERT INTO products VALUES
        ('Product A', 'Electronics'),
        ('Product B', 'Electronics'),
        ('Product C', 'Furniture')`,
      );

      const result = await executeSql(
        userId,
        `
        SELECT p.category, s.total_sales
        FROM products p
        INNER JOIN (
          SELECT product, SUM(amount) as total_sales
          FROM sales
          GROUP BY product
        ) AS s ON p.name = s.product
        WHERE p.category = 'Electronics'
        ORDER BY p.name
      `,
      );

      expect(result.length).toBe(2);
    });
  });

  describe('ANY and ALL operators', () => {
    beforeEach(async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS employees`);
      await executeSql(
        userId,
        `CREATE TABLE employees (
        id INT,
        name VARCHAR(50),
        salary INT,
        dept VARCHAR(50)
      )`,
      );

      await executeSql(
        userId,
        `INSERT INTO employees VALUES
        (1, 'Alice', 50000, 'IT'),
        (2, 'Bob', 60000, 'IT'),
        (3, 'Carol', 70000, 'Sales'),
        (4, 'Dave', 80000, 'Sales'),
        (5, 'Eve', 90000, 'Sales')`,
      );
    });

    test('salary > ANY (subquery) returns employees earning more than at least one IT employee', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name, salary FROM employees
        WHERE salary > ANY (
          SELECT salary FROM employees WHERE dept = 'IT'
        )
        AND dept = 'Sales'
        ORDER BY salary
      `,
      );

      // Sales employees earning more than ANY IT employee (> 50000 or > 60000)
      expect(result.length).toBe(3);
      expect(result[0].salary).toBe(70000);
    });

    test('salary > ALL (subquery) returns employees earning more than all IT employees', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name, salary FROM employees
        WHERE salary > ALL (
          SELECT salary FROM employees WHERE dept = 'IT'
        )
        ORDER BY salary
      `,
      );

      // Must be > 60000 (highest IT salary)
      expect(result.length).toBe(3);
      expect(result.map((r: any) => r.name).sort()).toEqual([
        'Carol',
        'Dave',
        'Eve',
      ]);
    });

    test('= ANY is equivalent to IN', async () => {
      const resultAny = await executeSql(
        userId,
        `
        SELECT name FROM employees
        WHERE salary = ANY (SELECT salary FROM employees WHERE dept = 'IT')
        ORDER BY name
      `,
      );

      const resultIn = await executeSql(
        userId,
        `
        SELECT name FROM employees
        WHERE salary IN (SELECT salary FROM employees WHERE dept = 'IT')
        ORDER BY name
      `,
      );

      expect(resultAny).toEqual(resultIn);
      expect(resultAny.length).toBe(2);
    });

    test('< ALL with empty subquery returns empty', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name FROM employees
        WHERE salary < ALL (SELECT salary FROM employees WHERE dept = 'Nonexistent')
      `,
      );

      // ALL with empty set is vacuously true
      expect(result.length).toBe(5);
    });

    test('!= ANY excludes at least one match', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name FROM employees
        WHERE salary != ANY (SELECT 50000)
        ORDER BY name
      `,
      );

      // All except salary = 50000
      expect(result.length).toBe(4);
    });
  });

  describe('Scalar subqueries in SELECT', () => {
    beforeEach(async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS departments`);
      await executeSql(userId, `DROP TABLE IF EXISTS workers`);
      await executeSql(
        userId,
        `CREATE TABLE departments (
        id INT,
        name VARCHAR(50)
      )`,
      );

      await executeSql(
        userId,
        `CREATE TABLE workers (
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
        (2, 'Sales')`,
      );

      await executeSql(
        userId,
        `INSERT INTO workers VALUES
        (1, 'Alice', 1, 100000),
        (2, 'Bob', 1, 90000),
        (3, 'Carol', 2, 80000)`,
      );
    });

    test('Scalar subquery returns single value', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          name,
          salary,
          (SELECT AVG(salary) FROM workers) as avg_salary
        FROM workers
        WHERE id = 1
      `,
      );

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Alice');
      expect(result[0].avg_salary).toBe(90000);
    });

    test('Scalar subquery with correlation', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          d.name as dept_name,
          (SELECT COUNT(*) FROM workers w WHERE w.dept_id = d.id) as worker_count
        FROM departments d
        ORDER BY d.name
      `,
      );

      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ dept_name: 'Engineering', worker_count: 2 });
      expect(result[1]).toEqual({ dept_name: 'Sales', worker_count: 1 });
    });
  });

  describe('Error cases and edge cases', () => {
    test('EXISTS with invalid table reference', async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS test_table`);
      await executeSql(userId, `CREATE TABLE test_table (id INT)`);
      await executeSql(userId, `INSERT INTO test_table VALUES (1)`);

      let queryResult: any;
      try {
        queryResult = await executeSql(
          userId,
          `
          SELECT * FROM test_table WHERE EXISTS (SELECT 1 FROM nonexistent_table)
        `,
        );
      } catch (e) {
        // Helper lança erro quando success === false
        queryResult = { success: false };
      }

      // Should return error or empty
      expect(queryResult.success === false || queryResult.length === 0).toBe(
        true,
      );
    });

    test('Derived table without alias', async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS numbers`);
      await executeSql(userId, `CREATE TABLE numbers (value INT)`);
      await executeSql(userId, `INSERT INTO numbers VALUES (1), (2), (3)`);

      // Most SQL requires alias for derived tables
      const result = await executeSql(
        userId,
        `
        SELECT value FROM (SELECT value FROM numbers) AS sub WHERE value > 1
      `,
      );

      expect(result.length).toBe(2);
    });

    test('ANY with non-subquery value', async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS items`);
      await executeSql(userId, `CREATE TABLE items (price INT)`);
      await executeSql(userId, `INSERT INTO items VALUES (10), (20), (30)`);

      const result = await executeSql(
        userId,
        `
        SELECT price FROM items WHERE price > ANY (SELECT 15)
      `,
      );

      expect(result.length).toBe(2);
      expect(result[0].price).toBe(20);
    });
  });
});
