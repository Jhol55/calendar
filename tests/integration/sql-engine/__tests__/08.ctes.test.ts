/**
 * SQL Engine - Common Table Expressions (CTEs)
 *
 * Testa WITH queries:
 * - CTEs simples
 * - Múltiplos CTEs
 * - CTEs aninhados
 * - WITH RECURSIVE
 */

import { setupTestUser, executeSql } from '../../../helpers/sql-engine';

describe('SQL Engine - CTEs', () => {
  describe('Simple CTEs', () => {
    it('CTE básico com WITH', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE sales (id INT, amount INT)`);
        await executeSql(
          userId,
          `INSERT INTO sales VALUES (1, 100), (2, 200), (3, 300)`,
        );

        const result = await executeSql(
          userId,
          `
          WITH total_sales AS (
            SELECT SUM(amount) as total FROM sales
          )
          SELECT * FROM total_sales
        `,
        );

        expect(result[0].total).toBe(600);
      } finally {
        await cleanup();
      }
    });

    it('CTE com filtro e agregação', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE orders (id INT, status VARCHAR(20), amount INT)`,
        );
        await executeSql(
          userId,
          `INSERT INTO orders VALUES 
          (1, 'completed', 100),
          (2, 'completed', 200),
          (3, 'pending', 150)`,
        );

        const result = await executeSql(
          userId,
          `
          WITH completed_orders AS (
            SELECT * FROM orders WHERE status = 'completed'
          )
          SELECT SUM(amount) as total FROM completed_orders
        `,
        );

        expect(result[0].total).toBe(300);
      } finally {
        await cleanup();
      }
    });
  });

  describe('Multiple CTEs', () => {
    it('múltiplos CTEs em sequência', async () => {
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
          WITH electronics AS (
            SELECT * FROM products WHERE category = 'electronics'
          ),
          books AS (
            SELECT * FROM products WHERE category = 'books'
          )
          SELECT 
            (SELECT SUM(price) FROM electronics) as electronics_total,
            (SELECT SUM(price) FROM books) as books_total
        `,
        );

        expect(result[0].electronics_total).toBe(300);
        expect(result[0].books_total).toBe(40);
      } finally {
        await cleanup();
      }
    });

    it('CTE usado em JOIN', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE orders (id INT, customer_id INT, amount INT)`,
        );
        await executeSql(
          userId,
          `CREATE TABLE customers (id INT, name VARCHAR(50))`,
        );

        await executeSql(
          userId,
          `INSERT INTO customers VALUES (1, 'Alice'), (2, 'Bob')`,
        );
        await executeSql(
          userId,
          `INSERT INTO orders VALUES (1, 1, 100), (2, 1, 200), (3, 2, 150)`,
        );

        const result = await executeSql(
          userId,
          `
          WITH customer_totals AS (
            SELECT customer_id, SUM(amount) as total
            FROM orders
            GROUP BY customer_id
          )
          SELECT c.name, ct.total
          FROM customers c
          JOIN customer_totals ct ON c.id = ct.customer_id
          ORDER BY c.name
        `,
        );

        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({ name: 'Alice', total: 300 });
        expect(result[1]).toMatchObject({ name: 'Bob', total: 150 });
      } finally {
        await cleanup();
      }
    });
  });

  describe('WITH RECURSIVE', () => {
    it('recursão simples - números de 1 a 10', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        const result = await executeSql(
          userId,
          `
          WITH RECURSIVE numbers AS (
            SELECT 1 AS n
            UNION ALL
            SELECT n + 1 FROM numbers WHERE n < 10
          )
          SELECT * FROM numbers
        `,
        );

        expect(result).toHaveLength(10);
        expect(result[0].n).toBe(1);
        expect(result[9].n).toBe(10);
      } finally {
        await cleanup();
      }
    });

    it('recursão com múltiplas colunas', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        const result = await executeSql(
          userId,
          `
          WITH RECURSIVE series AS (
            SELECT 1 AS id, 10 AS value
            UNION ALL
            SELECT id + 1, value * 2 FROM series WHERE id < 5
          )
          SELECT * FROM series
        `,
        );

        expect(result).toHaveLength(5);
        expect(result[4].value).toBe(160); // 10 * 2^4
      } finally {
        await cleanup();
      }
    });

    it('recursão com dados de tabela', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE categories (id INT, name VARCHAR(50), parent_id INT)`,
        );
        await executeSql(
          userId,
          `INSERT INTO categories VALUES 
          (1, 'Root', NULL),
          (2, 'Electronics', 1),
          (3, 'Books', 1),
          (4, 'Laptops', 2),
          (5, 'Phones', 2)`,
        );

        const result = await executeSql(
          userId,
          `
          WITH RECURSIVE category_tree AS (
            SELECT id, name, parent_id, 1 as level
            FROM categories
            WHERE parent_id IS NULL
            
            UNION ALL
            
            SELECT c.id, c.name, c.parent_id, ct.level + 1
            FROM categories c
            JOIN category_tree ct ON c.parent_id = ct.id
          )
          SELECT * FROM category_tree ORDER BY level, id
        `,
        );

        expect(result).toHaveLength(5);
        expect(result[0].name).toBe('Root');
        expect(result[0].level).toBe(1);

        const laptops = result.find((r: any) => r.name === 'Laptops');
        expect(laptops.level).toBe(3);
      } finally {
        await cleanup();
      }
    });
  });

  describe('Complex CTE Scenarios', () => {
    it('CTE com window functions', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE scores (id INT, player VARCHAR(50), points INT)`,
        );
        await executeSql(
          userId,
          `INSERT INTO scores VALUES 
          (1, 'Alice', 100),
          (2, 'Bob', 150),
          (3, 'Charlie', 120)`,
        );

        const result = await executeSql(
          userId,
          `
          WITH ranked_players AS (
            SELECT 
              player, 
              points,
              RANK() OVER (ORDER BY points DESC) as player_rank
            FROM scores
          )
          SELECT * FROM ranked_players WHERE player_rank <= 2
        `,
        );

        expect(result).toHaveLength(2);
        expect(result[0].player).toBe('Bob');
        expect(result[0].player_rank).toBe(1);
      } finally {
        await cleanup();
      }
    });
  });
});
