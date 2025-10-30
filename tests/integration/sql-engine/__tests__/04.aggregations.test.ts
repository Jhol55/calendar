/**
 * SQL Engine - Aggregations
 *
 * Testa funções de agregação e GROUP BY:
 * - COUNT, SUM, AVG, MIN, MAX
 * - GROUP BY
 * - HAVING
 * - Agregações aninhadas
 */

import { setupTestUser, executeSql } from '../../../helpers/sql-engine';

describe('SQL Engine - Aggregations', () => {
  describe('Basic Aggregation Functions', () => {
    it('COUNT deve contar registros', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE items (id INT)`);
        await executeSql(userId, `INSERT INTO items VALUES (1), (2), (3)`);

        const result = await executeSql(
          userId,
          `SELECT COUNT(*) as total FROM items`,
        );
        expect(result[0].total).toBe(3);
      } finally {
        await cleanup();
      }
    });

    it('SUM deve somar valores', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE sales (id INT, amount INT)`);
        await executeSql(
          userId,
          `INSERT INTO sales VALUES (1, 100), (2, 200), (3, 300)`,
        );

        const result = await executeSql(
          userId,
          `SELECT SUM(amount) as total FROM sales`,
        );
        expect(result[0].total).toBe(600);
      } finally {
        await cleanup();
      }
    });

    it('AVG deve calcular média', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE scores (id INT, points INT)`);
        await executeSql(
          userId,
          `INSERT INTO scores VALUES (1, 80), (2, 90), (3, 70)`,
        );

        const result = await executeSql(
          userId,
          `SELECT AVG(points) as average FROM scores`,
        );
        expect(result[0].average).toBe(80);
      } finally {
        await cleanup();
      }
    });

    it('MIN e MAX devem retornar valores mínimo e máximo', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE numbers_test (id INT, num INT)`);
        await executeSql(
          userId,
          `INSERT INTO numbers_test VALUES (1, 5), (2, 10), (3, 3), (4, 8)`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT MIN(num) as minimum, MAX(num) as maximum FROM numbers_test
        `,
        );
        expect(result[0].minimum).toBe(3);
        expect(result[0].maximum).toBe(10);
      } finally {
        await cleanup();
      }
    });
  });

  describe('GROUP BY', () => {
    it('GROUP BY com COUNT', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE orders (id INT, status VARCHAR(20))`,
        );
        await executeSql(
          userId,
          `INSERT INTO orders VALUES 
          (1, 'pending'), (2, 'approved'), (3, 'pending'), 
          (4, 'approved'), (5, 'pending')`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT status, COUNT(*) as count 
          FROM orders 
          GROUP BY status
          ORDER BY status
        `,
        );

        expect(result).toHaveLength(2);
        const approved = result.find((r: any) => r.status === 'approved');
        const pending = result.find((r: any) => r.status === 'pending');

        expect(approved.count).toBe(2);
        expect(pending.count).toBe(3);
      } finally {
        await cleanup();
      }
    });

    it('GROUP BY com SUM', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE sales (id INT, category VARCHAR(20), amount INT)`,
        );
        await executeSql(
          userId,
          `INSERT INTO sales VALUES 
          (1, 'electronics', 100),
          (2, 'books', 50),
          (3, 'electronics', 200),
          (4, 'books', 30)`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT category, SUM(amount) as total 
          FROM sales 
          GROUP BY category
          ORDER BY category
        `,
        );

        expect(result).toHaveLength(2);
        expect(
          result.find((r: any) => r.category === 'electronics').total,
        ).toBe(300);
        expect(result.find((r: any) => r.category === 'books').total).toBe(80);
      } finally {
        await cleanup();
      }
    });

    it('GROUP BY com múltiplas agregações', async () => {
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

        const result = await executeSql(
          userId,
          `
          SELECT 
            category,
            COUNT(*) as count,
            SUM(price) as total,
            AVG(price) as average,
            MIN(price) as min_price,
            MAX(price) as max_price
          FROM products 
          GROUP BY category
          ORDER BY category
        `,
        );

        const electronics = result.find(
          (r: any) => r.category === 'electronics',
        );
        expect(electronics.count).toBe(2);
        expect(electronics.total).toBe(300);
        expect(electronics.average).toBe(150);
        expect(electronics.min_price).toBe(100);
        expect(electronics.max_price).toBe(200);
      } finally {
        await cleanup();
      }
    });
  });

  describe('HAVING', () => {
    it('HAVING deve filtrar resultados agregados', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE orders (id INT, customer_id INT, amount INT)`,
        );
        await executeSql(
          userId,
          `INSERT INTO orders VALUES 
          (1, 1, 100), (2, 1, 200), 
          (3, 2, 50), 
          (4, 3, 150), (5, 3, 250)`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT customer_id, SUM(amount) as total
          FROM orders
          GROUP BY customer_id
          HAVING SUM(amount) > 200
          ORDER BY customer_id
        `,
        );

        expect(result).toHaveLength(2);
        expect(result.map((r: any) => r.customer_id)).toEqual([1, 3]);
      } finally {
        await cleanup();
      }
    });

    it('HAVING com múltiplas condições', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE sales (id INT, region VARCHAR(20), amount INT)`,
        );
        await executeSql(
          userId,
          `INSERT INTO sales VALUES 
          (1, 'North', 100), (2, 'North', 200), (3, 'North', 150),
          (4, 'South', 50), (5, 'South', 60),
          (6, 'East', 300), (7, 'East', 400), (8, 'East', 50)`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT region, COUNT(*) as count, SUM(amount) as total
          FROM sales
          GROUP BY region
          HAVING COUNT(*) > 2 AND SUM(amount) > 300
        `,
        );

        expect(result).toHaveLength(2); // North and East
      } finally {
        await cleanup();
      }
    });
  });

  describe('Complex Aggregations', () => {
    it('Agregações com WHERE e GROUP BY', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE transactions (id INT, type VARCHAR(20), amount INT, status VARCHAR(20))`,
        );
        await executeSql(
          userId,
          `INSERT INTO transactions VALUES 
          (1, 'purchase', 100, 'completed'),
          (2, 'purchase', 200, 'completed'),
          (3, 'purchase', 150, 'pending'),
          (4, 'refund', 50, 'completed')`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT type, SUM(amount) as total
          FROM transactions
          WHERE status = 'completed'
          GROUP BY type
          ORDER BY type
        `,
        );

        expect(result).toHaveLength(2);
        expect(result.find((r: any) => r.type === 'purchase').total).toBe(300);
        expect(result.find((r: any) => r.type === 'refund').total).toBe(50);
      } finally {
        await cleanup();
      }
    });

    it('Funções aninhadas (ROUND com AVG)', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE measurements (id INT, value INT)`,
        );
        await executeSql(
          userId,
          `INSERT INTO measurements VALUES (1, 10), (2, 13), (3, 17)`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT ROUND(AVG(value)) as rounded_avg FROM measurements
        `,
        );

        expect(result[0].rounded_avg).toBe(13);
      } finally {
        await cleanup();
      }
    });
  });
});
