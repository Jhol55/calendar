/**
 * SQL Engine - UNION Operations
 *
 * Testa operações UNION:
 * - UNION (remove duplicatas)
 * - UNION ALL (mantém duplicatas)
 * - UNION com ORDER BY
 * - UNION de múltiplas queries
 */

import { setupTestUser, executeSql } from '../../../helpers/sql-engine';

describe('SQL Engine - UNION', () => {
  describe('UNION - Remove Duplicates', () => {
    it('UNION deve remover duplicatas', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE table_a (id INT, value VARCHAR(20))`,
        );
        await executeSql(
          userId,
          `CREATE TABLE table_b (id INT, value VARCHAR(20))`,
        );

        await executeSql(
          userId,
          `INSERT INTO table_a VALUES (1, 'Apple'), (2, 'Banana')`,
        );
        await executeSql(
          userId,
          `INSERT INTO table_b VALUES (2, 'Banana'), (3, 'Cherry')`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT value FROM table_a
          UNION
          SELECT value FROM table_b
          ORDER BY value
        `,
        );

        expect(result).toHaveLength(3);
        expect(result.map((r: any) => r.value)).toEqual([
          'Apple',
          'Banana',
          'Cherry',
        ]);
      } finally {
        await cleanup();
      }
    });
  });

  describe('UNION ALL - Keep Duplicates', () => {
    it('UNION ALL deve manter duplicatas', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE set_a (id INT, item VARCHAR(20))`,
        );
        await executeSql(
          userId,
          `CREATE TABLE set_b (id INT, item VARCHAR(20))`,
        );

        await executeSql(userId, `INSERT INTO set_a VALUES (1, 'X'), (2, 'Y')`);
        await executeSql(userId, `INSERT INTO set_b VALUES (3, 'Y'), (4, 'Z')`);

        const result = await executeSql(
          userId,
          `
          SELECT item FROM set_a
          UNION ALL
          SELECT item FROM set_b
          ORDER BY item
        `,
        );

        expect(result).toHaveLength(4);
        expect(result.filter((r: any) => r.item === 'Y')).toHaveLength(2);
      } finally {
        await cleanup();
      }
    });
  });

  describe('UNION with Filters', () => {
    it('UNION com WHERE em ambas queries', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE active_users (id INT, name VARCHAR(50))`,
        );
        await executeSql(
          userId,
          `CREATE TABLE inactive_users (id INT, name VARCHAR(50))`,
        );

        await executeSql(
          userId,
          `INSERT INTO active_users VALUES (1, 'Alice'), (2, 'Bob')`,
        );
        await executeSql(
          userId,
          `INSERT INTO inactive_users VALUES (3, 'Charlie'), (4, 'David')`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT name FROM active_users WHERE id < 2
          UNION
          SELECT name FROM inactive_users WHERE id > 3
          ORDER BY name
        `,
        );

        expect(result).toHaveLength(2);
        expect(result.map((r: any) => r.name)).toEqual(['Alice', 'David']);
      } finally {
        await cleanup();
      }
    });
  });

  describe('UNION with Different Types', () => {
    it('UNION com múltiplas colunas', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE employees (id INT, name VARCHAR(50), dept VARCHAR(20))`,
        );
        await executeSql(
          userId,
          `CREATE TABLE contractors (id INT, name VARCHAR(50), dept VARCHAR(20))`,
        );

        await executeSql(
          userId,
          `INSERT INTO employees VALUES (1, 'Alice', 'Engineering')`,
        );
        await executeSql(
          userId,
          `INSERT INTO contractors VALUES (2, 'Bob', 'Marketing')`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT name, dept FROM employees
          UNION
          SELECT name, dept FROM contractors
          ORDER BY name
        `,
        );

        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({ name: 'Alice', dept: 'Engineering' });
        expect(result[1]).toMatchObject({ name: 'Bob', dept: 'Marketing' });
      } finally {
        await cleanup();
      }
    });
  });

  describe('Multiple UNION', () => {
    it('UNION de 3 ou mais queries', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE t1 (value INT)`);
        await executeSql(userId, `CREATE TABLE t2 (value INT)`);
        await executeSql(userId, `CREATE TABLE t3 (value INT)`);

        await executeSql(userId, `INSERT INTO t1 VALUES (1)`);
        await executeSql(userId, `INSERT INTO t2 VALUES (2)`);
        await executeSql(userId, `INSERT INTO t3 VALUES (3)`);

        const result = await executeSql(
          userId,
          `
          SELECT value FROM t1
          UNION
          SELECT value FROM t2
          UNION
          SELECT value FROM t3
          ORDER BY value
        `,
        );

        expect(result).toHaveLength(3);
        expect(result.map((r: any) => r.value)).toEqual([1, 2, 3]);
      } finally {
        await cleanup();
      }
    });
  });

  describe('UNION with Aggregations', () => {
    it('UNION com agregações', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE sales_2023 (id INT, amount INT)`,
        );
        await executeSql(
          userId,
          `CREATE TABLE sales_2024 (id INT, amount INT)`,
        );

        await executeSql(
          userId,
          `INSERT INTO sales_2023 VALUES (1, 100), (2, 200)`,
        );
        await executeSql(
          userId,
          `INSERT INTO sales_2024 VALUES (3, 150), (4, 250)`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT 2023 as year, SUM(amount) as total FROM sales_2023
          UNION ALL
          SELECT 2024 as year, SUM(amount) as total FROM sales_2024
          ORDER BY year
        `,
        );

        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({ year: 2023, total: 300 });
        expect(result[1]).toMatchObject({ year: 2024, total: 400 });
      } finally {
        await cleanup();
      }
    });
  });
});
