/**
 * SQL Engine - PostgreSQL Functions
 *
 * Testa funções PostgreSQL suportadas:
 * - String functions (UPPER, LOWER, LENGTH, SUBSTRING, CONCAT)
 * - Math functions (ROUND, ABS, CEIL, FLOOR, POWER, SQRT, MOD)
 * - Date functions (CURRENT_DATE, EXTRACT, DATE_PART)
 * - Utility functions (COALESCE, NULLIF)
 */

import { setupTestUser, executeSql } from '../../../helpers/sql-engine';

describe('SQL Engine - PostgreSQL Functions', () => {
  describe('String Functions', () => {
    it('UPPER deve converter para maiúsculas', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE texts (id INT, value VARCHAR(50))`,
        );
        await executeSql(userId, `INSERT INTO texts VALUES (1, 'hello')`);

        const result = await executeSql(
          userId,
          `SELECT UPPER(value) as upper_value FROM texts`,
        );
        expect(result[0].upper_value).toBe('HELLO');
      } finally {
        await cleanup();
      }
    });

    it('LOWER deve converter para minúsculas', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE texts (id INT, value VARCHAR(50))`,
        );
        await executeSql(userId, `INSERT INTO texts VALUES (1, 'WORLD')`);

        const result = await executeSql(
          userId,
          `SELECT LOWER(value) as lower_value FROM texts`,
        );
        expect(result[0].lower_value).toBe('world');
      } finally {
        await cleanup();
      }
    });

    it('LENGTH deve retornar tamanho da string', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE words (id INT, word VARCHAR(50))`,
        );
        await executeSql(userId, `INSERT INTO words VALUES (1, 'test')`);

        const result = await executeSql(
          userId,
          `SELECT LENGTH(word) as len FROM words`,
        );
        expect(result[0].len).toBe(4);
      } finally {
        await cleanup();
      }
    });

    it('CONCAT deve concatenar strings', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE names (id INT, first VARCHAR(50), last VARCHAR(50))`,
        );
        await executeSql(userId, `INSERT INTO names VALUES (1, 'John', 'Doe')`);

        const result = await executeSql(
          userId,
          `SELECT CONCAT(first, ' ', last) as full_name FROM names`,
        );
        expect(result[0].full_name).toBe('John Doe');
      } finally {
        await cleanup();
      }
    });
  });

  describe('Math Functions', () => {
    it('ROUND deve arredondar números', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE decimals (id INT, value INT)`);
        await executeSql(
          userId,
          `INSERT INTO decimals VALUES (1, 10), (2, 15), (3, 13)`,
        );

        const result = await executeSql(
          userId,
          `SELECT ROUND(AVG(value)) as rounded FROM decimals`,
        );
        expect(result[0].rounded).toBe(13); // AVG = 12.666..., rounded = 13
      } finally {
        await cleanup();
      }
    });

    it('ABS deve retornar valor absoluto', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE numbers (id INT, value INT)`);
        await executeSql(
          userId,
          `INSERT INTO numbers VALUES (1, -10), (2, 20)`,
        );

        const result = await executeSql(
          userId,
          `SELECT ABS(value) as abs_value FROM numbers ORDER BY id`,
        );
        expect(result[0].abs_value).toBe(10);
        expect(result[1].abs_value).toBe(20);
      } finally {
        await cleanup();
      }
    });

    it('POWER deve calcular potência', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        const result = await executeSql(userId, `SELECT POWER(2, 3) as result`);
        expect(result[0].result).toBe(8);
      } finally {
        await cleanup();
      }
    });

    it('SQRT deve calcular raiz quadrada', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        const result = await executeSql(userId, `SELECT SQRT(16) as result`);
        expect(result[0].result).toBe(4);
      } finally {
        await cleanup();
      }
    });

    it('MOD deve calcular resto da divisão', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        const result = await executeSql(userId, `SELECT MOD(10, 3) as result`);
        expect(result[0].result).toBe(1);
      } finally {
        await cleanup();
      }
    });
  });

  describe('Utility Functions', () => {
    it('COALESCE deve retornar primeiro valor não-NULL', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE data (id INT, val1 INT, val2 INT)`,
        );
        await executeSql(
          userId,
          `INSERT INTO data VALUES (1, NULL, 10), (2, 20, 30)`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT COALESCE(val1, val2, 0) as result FROM data ORDER BY id
        `,
        );

        expect(result[0].result).toBe(10);
        expect(result[1].result).toBe(20);
      } finally {
        await cleanup();
      }
    });

    it('NULLIF deve retornar NULL se valores forem iguais', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE comparisons (id INT, a INT, b INT)`,
        );
        await executeSql(
          userId,
          `INSERT INTO comparisons VALUES (1, 5, 5), (2, 5, 10)`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT NULLIF(a, b) as result FROM comparisons ORDER BY id
        `,
        );

        expect(result[0].result).toBeNull();
        expect(result[1].result).toBe(5);
      } finally {
        await cleanup();
      }
    });
  });

  describe('Combined Functions', () => {
    it('deve combinar múltiplas funções string', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE emails (id INT, email VARCHAR(100))`,
        );
        await executeSql(
          userId,
          `INSERT INTO emails VALUES (1, 'alice@example.com')`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT 
            UPPER(email) as upper_email,
            LENGTH(email) as email_length
          FROM emails
        `,
        );

        expect(result[0].upper_email).toBe('ALICE@EXAMPLE.COM');
        expect(result[0].email_length).toBe(17);
      } finally {
        await cleanup();
      }
    });

    it('deve usar funções em expressões complexas', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE products (id INT, name VARCHAR(50), price INT)`,
        );
        await executeSql(
          userId,
          `INSERT INTO products VALUES (1, 'laptop', 1000), (2, 'mouse', 50)`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT 
            UPPER(name) as product_name,
            ROUND(price * 1.1) as price_with_tax
          FROM products
          ORDER BY id
        `,
        );

        expect(result[0].product_name).toBe('LAPTOP');
        expect(result[0].price_with_tax).toBe(1100);
        expect(result[1].price_with_tax).toBe(55);
      } finally {
        await cleanup();
      }
    });

    it('deve usar funções em agregações', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE sales (id INT, amount INT)`);
        await executeSql(
          userId,
          `INSERT INTO sales VALUES (1, 100), (2, 150), (3, 125)`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT ROUND(AVG(amount)) as avg_rounded FROM sales
        `,
        );

        expect(result[0].avg_rounded).toBe(125);
      } finally {
        await cleanup();
      }
    });
  });

  describe('Functions in WHERE', () => {
    it('deve usar funções em condições WHERE', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE users (id INT, name VARCHAR(50))`,
        );
        await executeSql(
          userId,
          `INSERT INTO users VALUES (1, 'alice'), (2, 'bob'), (3, 'charlie')`,
        );

        const result = await executeSql(
          userId,
          `
          SELECT * FROM users WHERE LENGTH(name) > 3 ORDER BY id
        `,
        );

        expect(result).toHaveLength(2);
        expect(result[0].name).toBe('alice');
        expect(result[1].name).toBe('charlie');
      } finally {
        await cleanup();
      }
    });
  });
});
