/**
 * SQL Engine - Window Functions
 *
 * Testa funções de janela (OVER):
 * - RANK, DENSE_RANK, ROW_NUMBER
 * - SUM/AVG/COUNT OVER
 * - PARTITION BY
 * - ORDER BY em window functions
 */

import { setupTestUser, executeSql } from '../../../helpers/sql-engine';

describe('SQL Engine - Window Functions', () => {
  describe('Ranking Functions', () => {
    it('RANK() OVER (ORDER BY)', async () => {
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
          (3, 'Charlie', 150),
          (4, 'David', 90)`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT 
            player, 
            points,
            RANK() OVER (ORDER BY points DESC) as points_rank
          FROM scores
          ORDER BY points_rank, player
        `,
        );

        expect(result[0].points_rank).toBe(1);
        expect(result[1].points_rank).toBe(1); // Empate
        expect(result[2].points_rank).toBe(3); // Pula para 3
        expect(result[3].points_rank).toBe(4);
      } finally {
        await cleanup();
      }
    });

    it('ROW_NUMBER() deve numerar sequencialmente', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE items (id INT, value INT)`);
        await executeSql(
          userId,
          `INSERT INTO items VALUES (1, 10), (2, 20), (3, 10)`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT 
            value,
            ROW_NUMBER() OVER (ORDER BY value DESC) as row_num
          FROM items
        `,
        );

        expect(result[0].row_num).toBe(1);
        expect(result[1].row_num).toBe(2);
        expect(result[2].row_num).toBe(3);
      } finally {
        await cleanup();
      }
    });

    it('DENSE_RANK() não deve pular posições', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE competitors (id INT, name VARCHAR(50), score INT)`,
        );
        await executeSql(
          userId,
          `INSERT INTO competitors VALUES 
          (1, 'A', 100),
          (2, 'B', 90),
          (3, 'C', 90),
          (4, 'D', 80)`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT 
            name, 
            score,
            DENSE_RANK() OVER (ORDER BY score DESC) as dense_rank
          FROM competitors
          ORDER BY dense_rank, name
        `,
        );

        expect(result[0].dense_rank).toBe(1);
        expect(result[1].dense_rank).toBe(2);
        expect(result[2].dense_rank).toBe(2);
        expect(result[3].dense_rank).toBe(3); // Não pula para 4
      } finally {
        await cleanup();
      }
    });
  });

  describe('PARTITION BY', () => {
    it('RANK com PARTITION BY', async () => {
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
          (3, 'South', 150),
          (4, 'South', 250)`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT 
            region, 
            amount,
            RANK() OVER (PARTITION BY region ORDER BY amount DESC) as rank_in_region
          FROM sales
          ORDER BY region, rank_in_region
        `,
        );

        expect(result).toHaveLength(4);

        const northFirst = result.find(
          (r: any) => r.region === 'North' && r.rank_in_region === 1,
        );
        expect(northFirst.amount).toBe(200);

        const southFirst = result.find(
          (r: any) => r.region === 'South' && r.rank_in_region === 1,
        );
        expect(southFirst.amount).toBe(250);
      } finally {
        await cleanup();
      }
    });

    it('ROW_NUMBER com PARTITION BY', async () => {
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
            price,
            ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC) as row_in_category
          FROM products
          ORDER BY category, row_in_category
        `,
        );

        // Cada categoria deve ter row numbers de 1 a 2
        const electronicsRows = result.filter(
          (r: any) => r.category === 'electronics',
        );
        expect(electronicsRows[0].row_in_category).toBe(1);
        expect(electronicsRows[1].row_in_category).toBe(2);

        const booksRows = result.filter((r: any) => r.category === 'books');
        expect(booksRows[0].row_in_category).toBe(1);
        expect(booksRows[1].row_in_category).toBe(2);
      } finally {
        await cleanup();
      }
    });
  });

  describe('Aggregate Window Functions', () => {
    it('SUM OVER (PARTITION BY)', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE orders (id INT, customer_id INT, amount INT)`,
        );
        await executeSql(
          userId,
          `INSERT INTO orders VALUES 
          (1, 1, 100),
          (2, 1, 200),
          (3, 2, 150)`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT 
            customer_id, 
            amount,
            SUM(amount) OVER (PARTITION BY customer_id) as customer_total
          FROM orders
          ORDER BY customer_id, id
        `,
        );

        const customer1Orders = result.filter((r: any) => r.customer_id === 1);
        expect(customer1Orders[0].customer_total).toBe(300);
        expect(customer1Orders[1].customer_total).toBe(300);

        const customer2Order = result.find((r: any) => r.customer_id === 2);
        expect(customer2Order.customer_total).toBe(150);
      } finally {
        await cleanup();
      }
    });

    it('AVG OVER (PARTITION BY)', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE scores (id INT, team VARCHAR(20), points INT)`,
        );
        await executeSql(
          userId,
          `INSERT INTO scores VALUES 
          (1, 'A', 80),
          (2, 'A', 100),
          (3, 'B', 90)`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT 
            team, 
            points,
            AVG(points) OVER (PARTITION BY team) as team_average
          FROM scores
          ORDER BY team, id
        `,
        );

        const teamA = result.filter((r: any) => r.team === 'A');
        expect(teamA[0].team_average).toBe(90);

        const teamB = result.find((r: any) => r.team === 'B');
        expect(teamB.team_average).toBe(90);
      } finally {
        await cleanup();
      }
    });

    it('COUNT OVER ()', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE items (id INT, category VARCHAR(20))`,
        );
        await executeSql(
          userId,
          `INSERT INTO items VALUES 
          (1, 'A'), (2, 'A'), (3, 'B')`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT 
            category,
            COUNT(*) OVER (PARTITION BY category) as category_count
          FROM items
        `,
        );

        const categoryA = result.filter((r: any) => r.category === 'A');
        expect(categoryA[0].category_count).toBe(2);

        const categoryB = result.find((r: any) => r.category === 'B');
        expect(categoryB.category_count).toBe(1);
      } finally {
        await cleanup();
      }
    });
  });

  describe('Complex Window Scenarios', () => {
    it('múltiplas window functions na mesma query', async () => {
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
          `
          SELECT 
            region, 
            amount,
            RANK() OVER (PARTITION BY region ORDER BY amount DESC) as amount_rank,
            SUM(amount) OVER (PARTITION BY region) as total
          FROM sales
          ORDER BY region, amount_rank
        `,
        );

        expect(result).toHaveLength(3);

        const northFirst = result[0];
        expect(northFirst.amount_rank).toBe(1);
        expect(northFirst.total).toBe(300);
      } finally {
        await cleanup();
      }
    });

    it('window function com WHERE', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE products (id INT, category VARCHAR(20), price INT, active INT)`,
        );
        await executeSql(
          userId,
          `INSERT INTO products VALUES 
          (1, 'electronics', 100, 1),
          (2, 'electronics', 200, 1),
          (3, 'electronics', 150, 0)`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT 
            price,
            RANK() OVER (ORDER BY price DESC) as price_rank
          FROM products
          WHERE active = 1
        `,
        );

        expect(result).toHaveLength(2);
        expect(result[0].price).toBe(200);
        expect(result[0].price_rank).toBe(1);
      } finally {
        await cleanup();
      }
    });
  });
});
