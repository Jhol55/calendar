/**
 * SQL Engine - JOINs
 *
 * Testa todos os tipos de JOIN:
 * - INNER JOIN
 * - LEFT JOIN
 * - RIGHT JOIN
 * - FULL OUTER JOIN
 * - CROSS JOIN
 */

import { setupTestUser, executeSql } from '../../../helpers/sql-engine';

describe('SQL Engine - JOINs', () => {
  describe('INNER JOIN', () => {
    it('INNER JOIN básico', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE customers (id INT, name VARCHAR(50))`,
        );
        await executeSql(
          userId,
          `CREATE TABLE orders (id INT, customer_id INT, amount INT)`,
        );

        await executeSql(
          userId,
          `INSERT INTO customers VALUES (1, 'Alice'), (2, 'Bob'), (3, 'Charlie')`,
        );
        await executeSql(
          userId,
          `INSERT INTO orders VALUES (1, 1, 100), (2, 1, 200), (3, 2, 150)`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT c.name, o.amount
          FROM customers c
          INNER JOIN orders o ON c.id = o.customer_id
          ORDER BY c.name, o.amount
        `,
        );

        expect(result).toHaveLength(3);
        expect(result[0]).toMatchObject({ name: 'Alice', amount: 100 });
        expect(result[2].name).toBe('Bob');
      } finally {
        await cleanup();
      }
    });

    it('INNER JOIN com múltiplas condições', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE users (id INT, dept_id INT, name VARCHAR(50))`,
        );
        await executeSql(
          userId,
          `CREATE TABLE departments (id INT, location INT, name VARCHAR(50))`,
        );

        await executeSql(
          userId,
          `INSERT INTO users VALUES (1, 1, 'Alice'), (2, 2, 'Bob')`,
        );
        await executeSql(
          userId,
          `INSERT INTO departments VALUES (1, 1, 'Engineering'), (2, 2, 'Sales')`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT u.name as user_name, d.name as dept_name
          FROM users u
          INNER JOIN departments d ON u.dept_id = d.id AND u.dept_id = 1
        `,
        );

        expect(result).toHaveLength(1);
        expect(result[0].user_name).toBe('Alice');
      } finally {
        await cleanup();
      }
    });
  });

  describe('LEFT JOIN', () => {
    it('LEFT JOIN deve incluir registros sem match', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE customers (id INT, name VARCHAR(50))`,
        );
        await executeSql(
          userId,
          `CREATE TABLE orders (id INT, customer_id INT, amount INT)`,
        );

        await executeSql(
          userId,
          `INSERT INTO customers VALUES (1, 'Alice'), (2, 'Bob'), (3, 'Charlie')`,
        );
        await executeSql(
          userId,
          `INSERT INTO orders VALUES (1, 1, 100), (2, 1, 200)`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT c.name, o.amount
          FROM customers c
          LEFT JOIN orders o ON c.id = o.customer_id
          ORDER BY c.name
        `,
        );

        expect(result).toHaveLength(4); // Alice (2 orders), Bob (null), Charlie (null)

        const charlie = result.find((r: any) => r.name === 'Charlie');
        expect(charlie.amount).toBeNull();
      } finally {
        await cleanup();
      }
    });
  });

  describe('RIGHT JOIN', () => {
    it('RIGHT JOIN deve incluir registros da direita sem match', async () => {
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
          `INSERT INTO orders VALUES (1, 1, 100), (2, 99, 200)`,
        );
        await executeSql(
          userId,
          `INSERT INTO customers VALUES (1, 'Alice'), (2, 'Bob')`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT o.amount, c.name
          FROM orders o
          RIGHT JOIN customers c ON o.customer_id = c.id
          ORDER BY c.id
        `,
        );

        expect(result).toHaveLength(2);
        expect(result[0].name).toBe('Alice');
        expect(result[0].amount).toBe(100);
        expect(result[1].name).toBe('Bob');
        expect(result[1].amount).toBeNull();
      } finally {
        await cleanup();
      }
    });
  });

  describe('FULL OUTER JOIN', () => {
    it('FULL JOIN deve incluir todos os registros de ambas tabelas', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE table_a (id INT, value VARCHAR(10))`,
        );
        await executeSql(
          userId,
          `CREATE TABLE table_b (id INT, value VARCHAR(10))`,
        );

        await executeSql(
          userId,
          `INSERT INTO table_a VALUES (1, 'A1'), (2, 'A2')`,
        );
        await executeSql(
          userId,
          `INSERT INTO table_b VALUES (2, 'B2'), (3, 'B3')`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT a.value as val_a, b.value as val_b
          FROM table_a a
          FULL OUTER JOIN table_b b ON a.id = b.id
          ORDER BY a.id, b.id
        `,
        );

        expect(result).toHaveLength(3); // (1, null), (2, 2), (null, 3)
      } finally {
        await cleanup();
      }
    });
  });

  describe('CROSS JOIN', () => {
    it('CROSS JOIN deve fazer produto cartesiano', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE colors (id INT, name VARCHAR(10))`,
        );
        await executeSql(
          userId,
          `CREATE TABLE sizes (id INT, name VARCHAR(10))`,
        );

        await executeSql(
          userId,
          `INSERT INTO colors VALUES (1, 'Red'), (2, 'Blue')`,
        );
        await executeSql(
          userId,
          `INSERT INTO sizes VALUES (1, 'Small'), (2, 'Large')`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT c.name as color, s.name as size
          FROM colors c
          CROSS JOIN sizes s
          ORDER BY c.name, s.name
        `,
        );

        expect(result).toHaveLength(4); // 2 * 2 = 4
        expect(result[0]).toMatchObject({ color: 'Blue', size: 'Large' });
      } finally {
        await cleanup();
      }
    });
  });

  describe('Multiple JOINs', () => {
    it('deve fazer JOIN de 3 tabelas', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE users (id INT, name VARCHAR(50))`,
        );
        await executeSql(
          userId,
          `CREATE TABLE orders (id INT, user_id INT, product_id INT)`,
        );
        await executeSql(
          userId,
          `CREATE TABLE products (id INT, name VARCHAR(50), price INT)`,
        );

        await executeSql(userId, `INSERT INTO users VALUES (1, 'Alice')`);
        await executeSql(
          userId,
          `INSERT INTO products VALUES (1, 'Laptop', 1000), (2, 'Mouse', 50)`,
        );
        await executeSql(
          userId,
          `INSERT INTO orders VALUES (1, 1, 1), (2, 1, 2)`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT u.name, p.name as product, p.price
          FROM users u
          INNER JOIN orders o ON u.id = o.user_id
          INNER JOIN products p ON o.product_id = p.id
          ORDER BY p.price
        `,
        );

        expect(result).toHaveLength(2);
        expect(result[0].product).toBe('Mouse');
        expect(result[1].product).toBe('Laptop');
      } finally {
        await cleanup();
      }
    });
  });

  describe('JOINs with Aggregations', () => {
    it('JOIN com agregação', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE customers (id INT, name VARCHAR(50))`,
        );
        await executeSql(
          userId,
          `CREATE TABLE orders (id INT, customer_id INT, amount INT)`,
        );

        await executeSql(
          userId,
          `INSERT INTO customers VALUES (1, 'Alice'), (2, 'Bob')`,
        );
        await executeSql(
          userId,
          `INSERT INTO orders VALUES 
          (1, 1, 100), (2, 1, 200), (3, 2, 150)`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT c.name, COUNT(o.id) as order_count, SUM(o.amount) as total
          FROM customers c
          LEFT JOIN orders o ON c.id = o.customer_id
          GROUP BY c.name
          ORDER BY c.name
        `,
        );

        expect(result).toHaveLength(2);
        const alice = result.find((r: any) => r.name === 'Alice');
        expect(alice.order_count).toBe(2);
        expect(alice.total).toBe(300);
      } finally {
        await cleanup();
      }
    });
  });
});
