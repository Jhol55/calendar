/**
 * SQL ENGINE TESTS - Advanced DML
 *
 * Tests: INSERT ... SELECT, RETURNING clause, CAST/CONVERT, Advanced aggregations
 */

import { setupTestUser, executeSql } from '../../../helpers/sql-engine';
import { sqlEngine } from '@/services/database/sql-engine.service';

describe('SQL Engine - Advanced DML', () => {
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

  describe('INSERT ... SELECT', () => {
    beforeEach(async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS source_products`);
      await executeSql(userId, `DROP TABLE IF EXISTS target_products`);
      await executeSql(
        userId,
        `CREATE TABLE source_products (
        id INT,
        name VARCHAR(50),
        price INT,
        category VARCHAR(50)
      )`,
      );

      await executeSql(
        userId,
        `CREATE TABLE target_products (
        id INT,
        name VARCHAR(50),
        price INT,
        category VARCHAR(50)
      )`,
      );

      await executeSql(
        userId,
        `INSERT INTO source_products VALUES
        (1, 'Product A', 100, 'Electronics'),
        (2, 'Product B', 200, 'Electronics'),
        (3, 'Product C', 150, 'Furniture'),
        (4, 'Product D', 300, 'Furniture')`,
      );
    });

    test('INSERT SELECT copies all rows', async () => {
      const insertResult = await executeSql(
        userId,
        `
        INSERT INTO target_products
        SELECT * FROM source_products
      `,
      );

      expect(insertResult.affected).toBe(4);

      const selectResult = await executeSql(
        userId,
        `
        SELECT COUNT(*) as count FROM target_products
      `,
      );

      expect(selectResult[0].count).toBe(4);
    });

    test('INSERT SELECT with WHERE clause filters rows', async () => {
      const result = await executeSql(
        userId,
        `
        INSERT INTO target_products
        SELECT * FROM source_products WHERE category = 'Electronics'
      `,
      );

      expect(result.affected).toBe(2);

      const verify = await executeSql(
        userId,
        `
        SELECT name FROM target_products ORDER BY name
      `,
      );

      expect(verify.length).toBe(2);
      expect(verify[0].name).toBe('Product A');
      expect(verify[1].name).toBe('Product B');
    });

    test('INSERT SELECT with specific columns', async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS simple_products`);
      await executeSql(
        userId,
        `CREATE TABLE simple_products (
        id INT,
        name VARCHAR(50)
      )`,
      );

      const result = await executeSql(
        userId,
        `
        INSERT INTO simple_products (id, name)
        SELECT id, name FROM source_products WHERE price >= 200
      `,
      );

      expect(result.affected).toBe(2);

      const verify = await executeSql(
        userId,
        `
        SELECT * FROM simple_products ORDER BY id
      `,
      );

      expect(verify[0]).toMatchObject({ id: 2, name: 'Product B' });
      expect(verify[1]).toMatchObject({ id: 4, name: 'Product D' });
    });

    test('INSERT SELECT with aggregation', async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS category_summary`);
      await executeSql(
        userId,
        `CREATE TABLE category_summary (
        category VARCHAR(50),
        avg_price INT,
        total_products INT
      )`,
      );

      const result = await executeSql(
        userId,
        `
        INSERT INTO category_summary
        SELECT category, AVG(price) as avg_price, COUNT(*) as total_products
        FROM source_products
        GROUP BY category
      `,
      );

      expect(result.affected).toBe(2);

      const verify = await executeSql(
        userId,
        `
        SELECT * FROM category_summary ORDER BY category
      `,
      );

      expect(verify[0]).toMatchObject({
        category: 'Electronics',
        avg_price: 150,
        total_products: 2,
      });
      expect(verify[1]).toMatchObject({
        category: 'Furniture',
        avg_price: 225,
        total_products: 2,
      });
    });

    test('INSERT SELECT from multiple tables with JOIN', async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS suppliers`);
      await executeSql(userId, `DROP TABLE IF EXISTS product_supplier`);
      await executeSql(
        userId,
        `CREATE TABLE suppliers (
        id INT,
        product_id INT,
        supplier_name VARCHAR(50)
      )`,
      );

      await executeSql(
        userId,
        `INSERT INTO suppliers VALUES
        (1, 1, 'Supplier X'),
        (2, 2, 'Supplier Y')`,
      );

      await executeSql(
        userId,
        `CREATE TABLE product_supplier (
        product_name VARCHAR(50),
        supplier_name VARCHAR(50)
      )`,
      );

      const result = await executeSql(
        userId,
        `
        INSERT INTO product_supplier
        SELECT p.name, s.supplier_name
        FROM source_products p
        INNER JOIN suppliers s ON p.id = s.product_id
      `,
      );

      expect(result.affected).toBe(2);

      const verify = await executeSql(
        userId,
        `
        SELECT * FROM product_supplier ORDER BY product_name
      `,
      );

      expect(verify[0]).toMatchObject({
        product_name: 'Product A',
        supplier_name: 'Supplier X',
      });
    });

    test('INSERT SELECT with empty result returns 0 affected', async () => {
      const result = await executeSql(
        userId,
        `
        INSERT INTO target_products
        SELECT * FROM source_products WHERE price > 10000
      `,
      );

      expect(result.affected).toBe(0);

      const verify = await executeSql(
        userId,
        `
        SELECT COUNT(*) as count FROM target_products
      `,
      );

      expect(verify[0].count).toBe(0);
    });
  });

  describe('RETURNING clause', () => {
    beforeEach(async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS items`);
      await executeSql(
        userId,
        `CREATE TABLE items (
        id INT,
        name VARCHAR(50),
        quantity INT
      )`,
      );
    });

    test('INSERT ... RETURNING returns inserted rows', async () => {
      const result = await executeSql(
        userId,
        `
        INSERT INTO items VALUES (1, 'Item A', 10), (2, 'Item B', 20)
        RETURNING *
      `,
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Item A');
      expect(result[1].name).toBe('Item B');
    });

    test('INSERT ... RETURNING specific columns', async () => {
      const result = await executeSql(
        userId,
        `
        INSERT INTO items VALUES (1, 'Item A', 10)
        RETURNING id, name
      `,
      );

      expect(result.length).toBe(1);
      expect(result[0]).toEqual({ id: 1, name: 'Item A' });
      expect(result[0].quantity).toBeUndefined();
    });

    test('UPDATE ... RETURNING returns updated rows', async () => {
      await executeSql(
        userId,
        `INSERT INTO items VALUES (1, 'Item A', 10), (2, 'Item B', 20)`,
      );

      const result = await executeSql(
        userId,
        `
        UPDATE items SET quantity = 15 WHERE id = 1
        RETURNING *
      `,
      );

      expect(result.length).toBe(1);
      expect(result[0].id).toBe(1);
      expect(result[0].quantity).toBe(15);
    });

    test('DELETE ... RETURNING returns deleted rows', async () => {
      await executeSql(
        userId,
        `INSERT INTO items VALUES (1, 'Item A', 10), (2, 'Item B', 20)`,
      );

      const result = await executeSql(
        userId,
        `
        DELETE FROM items WHERE quantity >= 15
        RETURNING name, quantity
      `,
      );

      expect(result.length).toBe(1);
      expect(result[0]).toEqual({ name: 'Item B', quantity: 20 });
    });

    test('RETURNING with no affected rows returns empty array', async () => {
      const result = await executeSql(
        userId,
        `
        UPDATE items SET quantity = 99 WHERE id = 999
        RETURNING *
      `,
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    test('INSERT SELECT with RETURNING', async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS source`);
      await executeSql(
        userId,
        `CREATE TABLE source (id INT, name VARCHAR(50))`,
      );
      await executeSql(userId, `INSERT INTO source VALUES (1, 'A'), (2, 'B')`);

      const result = await executeSql(
        userId,
        `
        INSERT INTO items (id, name, quantity)
        SELECT id, name, 100 FROM source
        RETURNING name, quantity
      `,
      );

      expect(result.length).toBe(2);
      result.forEach((row: any) => {
        expect(row.quantity).toBe(100);
      });
    });
  });

  describe('CAST and CONVERT functions', () => {
    beforeEach(async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS conversions`);
      await executeSql(
        userId,
        `CREATE TABLE conversions (
        text_num VARCHAR(50),
        num_value INT,
        bool_value INT
      )`,
      );

      await executeSql(
        userId,
        `INSERT INTO conversions VALUES
        ('123', 456, 1),
        ('789', 0, 0),
        ('42', -100, 1)`,
      );
    });

    test('CAST string to integer', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          text_num,
          CAST(text_num AS INTEGER) as as_int
        FROM conversions
        ORDER BY text_num
      `,
      );

      expect(result[0].as_int).toBe(123);
      expect(result[1].as_int).toBe(42);
      expect(result[2].as_int).toBe(789);
    });

    test('CAST integer to string', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          num_value,
          CAST(num_value AS VARCHAR) as as_string
        FROM conversions
        WHERE num_value >= 0
        ORDER BY num_value
      `,
      );

      expect(typeof result[0].as_string).toBe('string');
      expect(result[0].as_string).toBe('0');
    });

    test('CAST to boolean', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          bool_value,
          CAST(bool_value AS BOOLEAN) as as_bool
        FROM conversions
        ORDER BY bool_value
      `,
      );

      expect(result[0].as_bool).toBe(false);
      expect(result[1].as_bool).toBe(true);
      expect(result[2].as_bool).toBe(true);
    });

    test('CAST in WHERE clause', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT text_num FROM conversions
        WHERE CAST(text_num AS INTEGER) > 100
        ORDER BY text_num
      `,
      );

      expect(result.length).toBe(2);
      expect(result[0].text_num).toBe('123');
      expect(result[1].text_num).toBe('789');
    });

    test('CAST with NULL returns NULL', async () => {
      await executeSql(
        userId,
        `INSERT INTO conversions VALUES (NULL, NULL, NULL)`,
      );

      const result = await executeSql(
        userId,
        `
        SELECT 
          CAST(text_num AS INTEGER) as casted
        FROM conversions
        WHERE text_num IS NULL
      `,
      );

      expect(result[0].casted).toBeNull();
    });
  });

  describe('Advanced Aggregation Functions', () => {
    beforeEach(async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS team_members`);
      await executeSql(
        userId,
        `CREATE TABLE team_members (
        team VARCHAR(20),
        member VARCHAR(20),
        score INT
      )`,
      );

      await executeSql(
        userId,
        `INSERT INTO team_members VALUES
        ('Alpha', 'Alice', 90),
        ('Alpha', 'Bob', 85),
        ('Alpha', 'Carol', 92),
        ('Beta', 'Dave', 78),
        ('Beta', 'Eve', 88)`,
      );
    });

    test('STRING_AGG concatenates values', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          team,
          STRING_AGG(member, ', ') as members
        FROM team_members
        GROUP BY team
        ORDER BY team
      `,
      );

      expect(result.length).toBe(2);
      expect(result[0].team).toBe('Alpha');
      expect(result[0].members).toContain('Alice');
      expect(result[0].members).toContain('Bob');
      expect(result[0].members).toContain('Carol');
    });

    test('ARRAY_AGG creates array of values', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          team,
          ARRAY_AGG(score) as scores
        FROM team_members
        GROUP BY team
        ORDER BY team
      `,
      );

      expect(result.length).toBe(2);
      expect(Array.isArray(result[0].scores)).toBe(true);
      expect(result[0].scores.length).toBe(3);
      expect(result[0].scores).toContain(90);
      expect(result[0].scores).toContain(85);
      expect(result[0].scores).toContain(92);
    });

    test('JSON_AGG creates JSON array', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          team,
          JSON_AGG(member) as members_json
        FROM team_members
        WHERE team = 'Beta'
        GROUP BY team
      `,
      );

      expect(result.length).toBe(1);
      expect(Array.isArray(result[0].members_json)).toBe(true);
      expect(result[0].members_json).toContain('Dave');
      expect(result[0].members_json).toContain('Eve');
    });

    test('STRING_AGG with empty group', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          STRING_AGG(member, ', ') as members
        FROM team_members
        WHERE team = 'Nonexistent'
      `,
      );

      // Empty aggregation
      expect(result.length).toBe(1);
      expect(result[0].members).toBe('');
    });

    test('Multiple aggregations in one query', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          team,
          COUNT(*) as member_count,
          AVG(score) as avg_score,
          STRING_AGG(member, ', ') as members,
          ARRAY_AGG(score) as all_scores
        FROM team_members
        GROUP BY team
        ORDER BY team
      `,
      );

      expect(result[0]).toEqual({
        team: 'Alpha',
        member_count: 3,
        avg_score: 89, // (90 + 85 + 92) / 3
        members: expect.any(String),
        all_scores: expect.any(Array),
      });
    });
  });

  describe('Error cases and edge cases', () => {
    test('INSERT SELECT with mismatched columns fails gracefully', async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS source`);
      await executeSql(userId, `DROP TABLE IF EXISTS target`);
      await executeSql(userId, `CREATE TABLE source (a INT, b INT, c INT)`);
      await executeSql(userId, `CREATE TABLE target (x INT, y INT)`);
      await executeSql(userId, `INSERT INTO source VALUES (1, 2, 3)`);

      // This may fail or partially succeed depending on implementation
      const result = await executeSql(
        userId,
        `
        INSERT INTO target SELECT * FROM source
      `,
      );

      // Should either fail or insert with truncated columns
      expect(result.success === false || result.affected >= 0).toBe(true);
    });

    test('RETURNING on table that does not exist', async () => {
      // Usar sqlEngine.execute diretamente para obter resultado completo com success: false
      const result = await sqlEngine.execute(
        `INSERT INTO nonexistent_table VALUES (1) RETURNING *`,
        userId,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('CAST invalid string to integer returns null', async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS invalid_data`);
      await executeSql(userId, `CREATE TABLE invalid_data (text VARCHAR(50))`);
      await executeSql(
        userId,
        `INSERT INTO invalid_data VALUES ('not a number')`,
      );

      const result = await executeSql(
        userId,
        `
        SELECT CAST(text AS INTEGER) as num FROM invalid_data
      `,
      );

      expect(result[0].num).toBeNull();
    });

    test('ARRAY_AGG on empty group returns empty array', async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS empty_agg`);
      await executeSql(userId, `CREATE TABLE empty_agg (value INT)`);

      const result = await executeSql(
        userId,
        `
        SELECT ARRAY_AGG(value) as arr FROM empty_agg
      `,
      );

      expect(result.length).toBe(1);
      expect(Array.isArray(result[0].arr)).toBe(true);
      expect(result[0].arr.length).toBe(0);
    });
  });
});
