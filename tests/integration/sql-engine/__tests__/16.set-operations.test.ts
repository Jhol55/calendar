/**
 * SQL ENGINE TESTS - Set Operations
 *
 * Tests: INTERSECT, EXCEPT (MINUS)
 */

import { setupTestUser, executeSql } from '../../../helpers/sql-engine';

describe('SQL Engine - Set Operations', () => {
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

  describe('INTERSECT operator', () => {
    beforeEach(async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS team_a`);
      await executeSql(userId, `DROP TABLE IF EXISTS team_b`);
      await executeSql(
        userId,
        `CREATE TABLE team_a (
        id INT,
        name VARCHAR(50)
      )`,
      );

      await executeSql(
        userId,
        `CREATE TABLE team_b (
        id INT,
        name VARCHAR(50)
      )`,
      );

      await executeSql(
        userId,
        `INSERT INTO team_a VALUES
        (1, 'Alice'),
        (2, 'Bob'),
        (3, 'Carol'),
        (4, 'Dave')`,
      );

      await executeSql(
        userId,
        `INSERT INTO team_b VALUES
        (2, 'Bob'),
        (3, 'Carol'),
        (5, 'Eve'),
        (6, 'Frank')`,
      );
    });

    test('INTERSECT returns only common rows', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name FROM team_a
        INTERSECT
        SELECT name FROM team_b
        ORDER BY name
      `,
      );

      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Bob');
      expect(result[1].name).toBe('Carol');
    });

    test('INTERSECT with no common rows returns empty', async () => {
      await executeSql(userId, `DELETE FROM team_b`);
      await executeSql(userId, `INSERT INTO team_b VALUES (10, 'Zoe')`);

      const result = await executeSql(
        userId,
        `
        SELECT name FROM team_a
        INTERSECT
        SELECT name FROM team_b
      `,
      );

      expect(result.length).toBe(0);
    });

    test('INTERSECT is commutative', async () => {
      const result1 = await executeSql(
        userId,
        `
        SELECT name FROM team_a INTERSECT SELECT name FROM team_b
      `,
      );

      const result2 = await executeSql(
        userId,
        `
        SELECT name FROM team_b INTERSECT SELECT name FROM team_a
      `,
      );

      expect(result1.length).toBe(result2.length);
      expect(result1.length).toBe(2);
    });

    test('INTERSECT with identical tables returns all rows', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name FROM team_a
        INTERSECT
        SELECT name FROM team_a
        ORDER BY name
      `,
      );

      expect(result.length).toBe(4);
    });

    test('INTERSECT removes duplicates', async () => {
      await executeSql(userId, `INSERT INTO team_a VALUES (2, 'Bob')`); // Duplicate

      const result = await executeSql(
        userId,
        `
        SELECT name FROM team_a
        INTERSECT
        SELECT name FROM team_b
        ORDER BY name
      `,
      );

      // Should still be 2 unique names
      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Bob');
      expect(result[1].name).toBe('Carol');
    });

    test('INTERSECT with WHERE clauses', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name FROM team_a WHERE id <= 3
        INTERSECT
        SELECT name FROM team_b WHERE id >= 2
        ORDER BY name
      `,
      );

      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Bob');
      expect(result[1].name).toBe('Carol');
    });
  });

  describe('EXCEPT operator', () => {
    beforeEach(async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS products_old`);
      await executeSql(userId, `DROP TABLE IF EXISTS products_new`);
      await executeSql(
        userId,
        `CREATE TABLE products_old (
        id INT,
        name VARCHAR(50),
        price INT
      )`,
      );

      await executeSql(
        userId,
        `CREATE TABLE products_new (
        id INT,
        name VARCHAR(50),
        price INT
      )`,
      );

      await executeSql(
        userId,
        `INSERT INTO products_old VALUES
        (1, 'Product A', 100),
        (2, 'Product B', 200),
        (3, 'Product C', 300),
        (4, 'Product D', 400)`,
      );

      await executeSql(
        userId,
        `INSERT INTO products_new VALUES
        (2, 'Product B', 200),
        (3, 'Product C', 350),
        (5, 'Product E', 500)`,
      );
    });

    test('EXCEPT returns rows in first query but not in second', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name FROM products_old
        EXCEPT
        SELECT name FROM products_new
        ORDER BY name
      `,
      );

      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Product A');
      expect(result[1].name).toBe('Product D');
    });

    test('EXCEPT is not commutative', async () => {
      const result1 = await executeSql(
        userId,
        `
        SELECT name FROM products_old EXCEPT SELECT name FROM products_new
      `,
      );

      const result2 = await executeSql(
        userId,
        `
        SELECT name FROM products_new EXCEPT SELECT name FROM products_old
      `,
      );

      expect(result1.length).toBe(2); // A, D
      expect(result2.length).toBe(1); // E
      expect(result2[0].name).toBe('Product E');
    });

    test('EXCEPT with identical tables returns empty', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name FROM products_old
        EXCEPT
        SELECT name FROM products_old
      `,
      );

      expect(result.length).toBe(0);
    });

    test('EXCEPT with no overlap returns all from first query', async () => {
      await executeSql(userId, `DELETE FROM products_new`);
      await executeSql(
        userId,
        `INSERT INTO products_new VALUES (10, 'Product Z', 1000)`,
      );

      const result = await executeSql(
        userId,
        `
        SELECT name FROM products_old
        EXCEPT
        SELECT name FROM products_new
        ORDER BY name
      `,
      );

      expect(result.length).toBe(4);
    });

    test('EXCEPT with empty second query returns all from first', async () => {
      await executeSql(userId, `DELETE FROM products_new`);

      const result = await executeSql(
        userId,
        `
        SELECT name FROM products_old
        EXCEPT
        SELECT name FROM products_new
      `,
      );

      expect(result.length).toBe(4);
    });

    test('EXCEPT removes duplicates from result', async () => {
      await executeSql(
        userId,
        `INSERT INTO products_old VALUES (1, 'Product A', 100)`,
      );

      const result = await executeSql(
        userId,
        `
        SELECT name FROM products_old
        EXCEPT
        SELECT name FROM products_new
        ORDER BY name
      `,
      );

      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Product A');
    });

    test('EXCEPT considers all columns for comparison', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT name, price FROM products_old
        EXCEPT
        SELECT name, price FROM products_new
        ORDER BY name
      `,
      );

      // Product C has different price (300 vs 350), so it's included
      expect(result.length).toBe(3);
      expect(result.map((r: any) => r.name).sort()).toEqual([
        'Product A',
        'Product C',
        'Product D',
      ]);
    });
  });

  describe('Multiple set operations', () => {
    beforeEach(async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS set_a`);
      await executeSql(userId, `DROP TABLE IF EXISTS set_b`);
      await executeSql(userId, `DROP TABLE IF EXISTS set_c`);
      await executeSql(userId, `CREATE TABLE set_a (value INT)`);
      await executeSql(userId, `CREATE TABLE set_b (value INT)`);
      await executeSql(userId, `CREATE TABLE set_c (value INT)`);

      await executeSql(userId, `INSERT INTO set_a VALUES (1), (2), (3), (4)`);
      await executeSql(userId, `INSERT INTO set_b VALUES (3), (4), (5), (6)`);
      await executeSql(userId, `INSERT INTO set_c VALUES (2), (3), (6), (7)`);
    });

    test('UNION and INTERSECT combined', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT value FROM set_a
        UNION
        SELECT value FROM set_b
        INTERSECT
        SELECT value FROM set_c
        ORDER BY value
      `,
      );

      // (A UNION B) INTERSECT C = elementos que estão em C E em (A ou B)
      expect(result.length).toBeGreaterThan(0);
    });

    test('EXCEPT with ORDER BY', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT value FROM set_a
        EXCEPT
        SELECT value FROM set_b
        ORDER BY value DESC
      `,
      );

      expect(result.length).toBe(2);
      expect(result[0].value).toBe(2);
      expect(result[1].value).toBe(1);
    });
  });

  describe('Error cases and edge cases', () => {
    test('INTERSECT with empty tables returns empty', async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS empty1`);
      await executeSql(userId, `DROP TABLE IF EXISTS empty2`);
      await executeSql(userId, `CREATE TABLE empty1 (id INT)`);
      await executeSql(userId, `CREATE TABLE empty2 (id INT)`);

      const result = await executeSql(
        userId,
        `
        SELECT id FROM empty1 INTERSECT SELECT id FROM empty2
      `,
      );

      expect(result.length).toBe(0);
    });

    test('EXCEPT with empty first table returns empty', async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS empty_table`);
      await executeSql(userId, `DROP TABLE IF EXISTS filled_table`);
      await executeSql(userId, `CREATE TABLE empty_table (id INT)`);
      await executeSql(userId, `CREATE TABLE filled_table (id INT)`);
      await executeSql(userId, `INSERT INTO filled_table VALUES (1), (2)`);

      const result = await executeSql(
        userId,
        `
        SELECT id FROM empty_table EXCEPT SELECT id FROM filled_table
      `,
      );

      expect(result.length).toBe(0);
    });

    test('Set operations with single row', async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS single1`);
      await executeSql(userId, `DROP TABLE IF EXISTS single2`);
      await executeSql(userId, `CREATE TABLE single1 (value INT)`);
      await executeSql(userId, `CREATE TABLE single2 (value INT)`);
      await executeSql(userId, `INSERT INTO single1 VALUES (42)`);
      await executeSql(userId, `INSERT INTO single2 VALUES (42)`);

      const intersect = await executeSql(
        userId,
        `
        SELECT value FROM single1 INTERSECT SELECT value FROM single2
      `,
      );
      expect(intersect.length).toBe(1);
      expect(intersect[0].value).toBe(42);

      const except = await executeSql(
        userId,
        `
        SELECT value FROM single1 EXCEPT SELECT value FROM single2
      `,
      );
      expect(except.length).toBe(0);
    });
  });
});
