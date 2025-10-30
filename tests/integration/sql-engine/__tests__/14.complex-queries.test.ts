/**
 * SQL Engine - Complex Queries
 *
 * Testa queries complexas que combinam múltiplas features:
 * - CTEs + Window Functions + Aggregations + JOINs
 * - Queries reais do sistema
 * - Cenários avançados
 */

import { setupTestUser, executeSql } from '../../../helpers/sql-engine';

// Tipos para os resultados das queries
interface ProdutoComEstatisticas {
  categoria: string;
  nome: string;
  valor: number;
  refeicoes: number;
  percentual_categoria: number;
  media_categoria: number;
  comparativo: string;
  rank_categoria: number;
}

describe('SQL Engine - Complex Queries', () => {
  describe('Real-World Query - Produtos com Estatísticas', () => {
    it('query complexa com CTEs, window functions e agregações', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        // Criar e popular tabela produtos
        await executeSql(
          userId,
          `CREATE TABLE produtos (
          id INT, 
          nome VARCHAR(100), 
          categoria VARCHAR(50), 
          valor INT, 
          refeicoes INT
        )`,
        );

        await executeSql(
          userId,
          `INSERT INTO produtos VALUES 
          (1, 'Produto A', 'Categoria1', 100, 10),
          (2, 'Produto B', 'Categoria1', 200, 20),
          (3, 'Produto C', 'Categoria1', 150, 15),
          (4, 'Produto D', 'Categoria2', 300, 30),
          (5, 'Produto E', 'Categoria2', 250, 25)`,
        );

        const result = await executeSql(
          userId,
          `
          WITH categoria_stats AS (
            SELECT 
              categoria,
              COUNT(*) AS total_produtos,
              SUM(valor) AS soma_valor,
              AVG(valor) AS media_valor,
              MAX(valor) AS maior_valor,
              MIN(valor) AS menor_valor
            FROM produtos 
            GROUP BY categoria
          ),
          ranking_produtos AS (
            SELECT 
              p.*,
              RANK() OVER (PARTITION BY categoria ORDER BY valor DESC) AS rank_categoria,
              SUM(valor) OVER (PARTITION BY categoria) AS total_categoria,
              ROUND(valor * 100 / SUM(valor) OVER (PARTITION BY categoria)) AS percentual_categoria
            FROM produtos p
          )
          SELECT 
            r.categoria,
            r.nome,
            r.valor,
            r.refeicoes,
            r.percentual_categoria,
            c.media_valor AS media_categoria,
            CASE 
              WHEN r.valor > c.media_valor THEN 'Acima da média'
              WHEN r.valor = c.media_valor THEN 'Na média'
              ELSE 'Abaixo da média'
            END AS comparativo,
            r.rank_categoria
          FROM ranking_produtos r
          JOIN categoria_stats c ON c.categoria = r.categoria
          WHERE r.percentual_categoria > 10
          ORDER BY r.categoria, r.rank_categoria
        `,
        );

        expect(result.length).toBeGreaterThan(0);

        // Validações da query complexa
        expect(result[0]).toHaveProperty('categoria');
        expect(result[0]).toHaveProperty('nome');
        expect(result[0]).toHaveProperty('valor');
        expect(result[0]).toHaveProperty('media_categoria');
        expect(result[0]).toHaveProperty('comparativo');
        expect(result[0]).toHaveProperty('rank_categoria');

        // Validar que os rankings fazem sentido
        const typedResult = result as ProdutoComEstatisticas[];
        const cat1Products = typedResult.filter(
          (r) => r.categoria === 'Categoria1',
        );
        if (cat1Products.length > 0) {
          expect(cat1Products[0].rank_categoria).toBe(1);
        }
      } finally {
        await cleanup();
      }
    });
  });

  describe('Complex Scenario - Recursive CTE with Aggregations', () => {
    it('WITH RECURSIVE com agregações e joins', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE categories (
          id INT, 
          name VARCHAR(50), 
          parent_id INT
        )`,
        );

        await executeSql(
          userId,
          `CREATE TABLE products (
          id INT, 
          category_id INT, 
          price INT
        )`,
        );

        await executeSql(
          userId,
          `INSERT INTO categories VALUES 
          (1, 'Root', NULL),
          (2, 'Electronics', 1),
          (3, 'Computers', 2),
          (4, 'Laptops', 3)`,
        );

        await executeSql(
          userId,
          `INSERT INTO products VALUES 
          (1, 4, 1000),
          (2, 4, 1500),
          (3, 3, 500)`,
        );

        const result = await executeSql(
          userId,
          `
          WITH RECURSIVE category_tree AS (
            SELECT id, name, parent_id, 1 as level
            FROM categories
            WHERE id = 4
            
            UNION ALL
            
            SELECT c.id, c.name, c.parent_id, ct.level + 1
            FROM categories c
            JOIN category_tree ct ON c.id = ct.parent_id
          ),
          category_sales AS (
            SELECT 
              c.id,
              c.name,
              SUM(p.price) as total_sales
            FROM category_tree c
            LEFT JOIN products p ON p.category_id = c.id
            GROUP BY c.id, c.name
          )
          SELECT * FROM category_sales WHERE total_sales > 0
        `,
        );

        expect(result.length).toBeGreaterThan(0);
      } finally {
        await cleanup();
      }
    });
  });

  describe('Complex Scenario - Multiple CTEs with Window Functions', () => {
    it('múltiplos CTEs com window functions e subqueries', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE orders (
          id INT,
          customer_id INT,
          order_date VARCHAR(20),
          amount INT
        )`,
        );

        await executeSql(
          userId,
          `INSERT INTO orders VALUES 
          (1, 1, '2024-01', 100),
          (2, 1, '2024-01', 150),
          (3, 2, '2024-01', 200),
          (4, 1, '2024-02', 120),
          (5, 2, '2024-02', 180)`,
        );

        const result = await executeSql(
          userId,
          `
          WITH monthly_totals AS (
            SELECT 
              customer_id,
              order_date,
              SUM(amount) as monthly_total
            FROM orders
            GROUP BY customer_id, order_date
          ),
          customer_rankings AS (
            SELECT 
              customer_id,
              order_date,
              monthly_total,
              RANK() OVER (PARTITION BY order_date ORDER BY monthly_total DESC) as monthly_rank,
              AVG(monthly_total) OVER (PARTITION BY order_date) as avg_monthly
            FROM monthly_totals
          )
          SELECT 
            customer_id,
            order_date,
            monthly_total,
            monthly_rank,
            ROUND(avg_monthly) as avg_monthly,
            CASE 
              WHEN monthly_total > avg_monthly THEN 'Above Average'
              ELSE 'Below Average'
            END as performance
          FROM customer_rankings
          ORDER BY order_date, monthly_rank
        `,
        );

        expect(result.length).toBeGreaterThan(0);
        expect(result[0]).toHaveProperty('performance');
      } finally {
        await cleanup();
      }
    });
  });

  describe('Complex Scenario - Multi-level Aggregations', () => {
    it('agregações em múltiplos níveis com HAVING', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE transactions (
          id INT,
          department VARCHAR(50),
          category VARCHAR(50),
          amount INT
        )`,
        );

        await executeSql(
          userId,
          `INSERT INTO transactions VALUES 
          (1, 'Sales', 'Product', 100),
          (2, 'Sales', 'Product', 200),
          (3, 'Sales', 'Service', 150),
          (4, 'Marketing', 'Product', 300),
          (5, 'Marketing', 'Product', 250)`,
        );

        const result = await executeSql(
          userId,
          `
          WITH dept_summary AS (
            SELECT 
              department,
              category,
              COUNT(*) as transaction_count,
              SUM(amount) as total_amount,
              AVG(amount) as avg_amount
            FROM transactions
            GROUP BY department, category
            HAVING COUNT(*) > 1
          )
          SELECT 
            department,
            SUM(total_amount) as dept_total,
            ROUND(AVG(avg_amount)) as dept_avg,
            COUNT(*) as category_count
          FROM dept_summary
          GROUP BY department
          ORDER BY dept_total DESC
        `,
        );

        expect(result.length).toBeGreaterThan(0);
        expect(result[0]).toHaveProperty('dept_total');
        expect(result[0]).toHaveProperty('dept_avg');
      } finally {
        await cleanup();
      }
    });
  });

  describe('Complex Scenario - Full Outer Join with Aggregations', () => {
    it('FULL OUTER JOIN com agregações e filtros', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE sales_team_a (
          id INT,
          product VARCHAR(50),
          sales INT
        )`,
        );

        await executeSql(
          userId,
          `CREATE TABLE sales_team_b (
          id INT,
          product VARCHAR(50),
          sales INT
        )`,
        );

        await executeSql(
          userId,
          `INSERT INTO sales_team_a VALUES 
          (1, 'Product1', 100),
          (2, 'Product2', 200)`,
        );

        await executeSql(
          userId,
          `INSERT INTO sales_team_b VALUES 
          (3, 'Product2', 150),
          (4, 'Product3', 300)`,
        );

        const result = await executeSql(
          userId,
          `
          WITH combined_sales AS (
            SELECT 
              COALESCE(a.product, b.product) as product,
              COALESCE(a.sales, 0) as team_a_sales,
              COALESCE(b.sales, 0) as team_b_sales
            FROM sales_team_a a
            FULL OUTER JOIN sales_team_b b ON a.product = b.product
          )
          SELECT 
            product,
            team_a_sales,
            team_b_sales,
            (team_a_sales + team_b_sales) as total_sales
          FROM combined_sales
          WHERE (team_a_sales + team_b_sales) > 100
          ORDER BY total_sales DESC
        `,
        );

        expect(result.length).toBeGreaterThan(0);
        expect(result[0]).toHaveProperty('total_sales');
      } finally {
        await cleanup();
      }
    });
  });

  describe('Complex Scenario - Nested CTEs', () => {
    it('CTEs aninhados com referências cruzadas', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE events (
          id INT,
          event_type VARCHAR(50),
          value INT
        )`,
        );

        await executeSql(
          userId,
          `INSERT INTO events VALUES 
          (1, 'click', 1),
          (2, 'click', 1),
          (3, 'view', 1),
          (4, 'click', 1),
          (5, 'purchase', 1)`,
        );

        const result = await executeSql(
          userId,
          `
          WITH event_counts AS (
            SELECT 
              event_type,
              COUNT(*) as count
            FROM events
            GROUP BY event_type
          ),
          total_events AS (
            SELECT SUM(count) as total FROM event_counts
          ),
          event_percentages AS (
            SELECT 
              ec.event_type,
              ec.count,
              ROUND(ec.count * 100 / te.total) as percentage
            FROM event_counts ec
            CROSS JOIN total_events te
          )
          SELECT * FROM event_percentages
          WHERE percentage > 10
          ORDER BY percentage DESC
        `,
        );

        expect(result.length).toBeGreaterThan(0);
        expect(result[0]).toHaveProperty('percentage');
      } finally {
        await cleanup();
      }
    });
  });
});
