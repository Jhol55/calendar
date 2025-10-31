/**
 * SQL ENGINE TESTS - Advanced Window Functions
 *
 * Tests: LEAD, LAG, FIRST_VALUE, LAST_VALUE, NTH_VALUE, NTILE, CUME_DIST, PERCENT_RANK
 */

import { setupTestUser, executeSql } from '../../../helpers/sql-engine';

describe('SQL Engine - Advanced Window Functions', () => {
  let userId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupTestUser();
    userId = setup.userId;
    cleanup = setup.cleanup;

    jest.setTimeout(30000);
  });

  afterAll(async () => {
    await cleanup();
  });

  describe('LEAD and LAG functions', () => {
    beforeEach(async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS stock_prices`);
      await executeSql(
        userId,
        `CREATE TABLE stock_prices (
        date VARCHAR(20),
        symbol VARCHAR(10),
        price INT
      )`,
      );

      await executeSql(
        userId,
        `INSERT INTO stock_prices VALUES
        ('2024-01-01', 'AAPL', 100),
        ('2024-01-02', 'AAPL', 105),
        ('2024-01-03', 'AAPL', 102),
        ('2024-01-04', 'AAPL', 108),
        ('2024-01-01', 'GOOGL', 200),
        ('2024-01-02', 'GOOGL', 195),
        ('2024-01-03', 'GOOGL', 205)`,
      );
    });

    test('LEAD gets next row value', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          date,
          price,
          LEAD(price) OVER (ORDER BY date) as next_price
        FROM stock_prices
        WHERE symbol = 'AAPL'
        ORDER BY date
      `,
      );

      expect(result.length).toBe(4);
      expect(result[0]).toEqual({
        date: '2024-01-01',
        price: 100,
        next_price: 105,
      });
      expect(result[1]).toEqual({
        date: '2024-01-02',
        price: 105,
        next_price: 102,
      });
      expect(result[2]).toEqual({
        date: '2024-01-03',
        price: 102,
        next_price: 108,
      });
      expect(result[3].next_price).toBeNull(); // Last row has no next
    });

    test('LAG gets previous row value', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          date,
          price,
          LAG(price) OVER (ORDER BY date) as prev_price
        FROM stock_prices
        WHERE symbol = 'AAPL'
        ORDER BY date
      `,
      );

      expect(result.length).toBe(4);
      expect(result[0].prev_price).toBeNull(); // First row has no previous
      expect(result[1]).toEqual({
        date: '2024-01-02',
        price: 105,
        prev_price: 100,
      });
      expect(result[2]).toEqual({
        date: '2024-01-03',
        price: 102,
        prev_price: 105,
      });
    });

    test('LEAD with offset 2', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          date,
          price,
          LEAD(price, 2) OVER (ORDER BY date) as price_in_2_days
        FROM stock_prices
        WHERE symbol = 'AAPL'
        ORDER BY date
      `,
      );

      expect(result[0].price_in_2_days).toBe(102);
      expect(result[1].price_in_2_days).toBe(108);
      expect(result[2].price_in_2_days).toBeNull();
      expect(result[3].price_in_2_days).toBeNull();
    });

    test('LAG with default value', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          date,
          LAG(price, 1, 0) OVER (ORDER BY date) as prev_price
        FROM stock_prices
        WHERE symbol = 'AAPL'
        ORDER BY date
      `,
      );

      expect(result[0].prev_price).toBe(0); // Default value instead of null
    });

    test('LEAD with PARTITION BY', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          symbol,
          date,
          price,
          LEAD(price) OVER (PARTITION BY symbol ORDER BY date) as next_price
        FROM stock_prices
        ORDER BY symbol, date
      `,
      );

      expect(result.length).toBe(7);
      // Each symbol has independent LAG calculation
      const aapl = result.filter((r: any) => r.symbol === 'AAPL');
      const googl = result.filter((r: any) => r.symbol === 'GOOGL');

      expect(aapl[3].next_price).toBeNull();
      expect(googl[2].next_price).toBeNull();
    });
  });

  describe('FIRST_VALUE, LAST_VALUE, NTH_VALUE', () => {
    beforeEach(async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS sales_data`);
      await executeSql(
        userId,
        `CREATE TABLE sales_data (
        month VARCHAR(20),
        region VARCHAR(20),
        sales INT
      )`,
      );

      await executeSql(
        userId,
        `INSERT INTO sales_data VALUES
        ('2024-01', 'North', 1000),
        ('2024-02', 'North', 1500),
        ('2024-03', 'North', 1200),
        ('2024-01', 'South', 800),
        ('2024-02', 'South', 900),
        ('2024-03', 'South', 950)`,
      );
    });

    test('FIRST_VALUE gets first value in window', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          month,
          sales,
          FIRST_VALUE(sales) OVER (ORDER BY month) as first_month_sales
        FROM sales_data
        WHERE region = 'North'
        ORDER BY month
      `,
      );

      expect(result.length).toBe(3);
      result.forEach((row: any) => {
        expect(row.first_month_sales).toBe(1000);
      });
    });

    test('LAST_VALUE gets last value in window', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          month,
          sales,
          LAST_VALUE(sales) OVER (ORDER BY month) as last_month_sales
        FROM sales_data
        WHERE region = 'North'
        ORDER BY month
      `,
      );

      expect(result.length).toBe(3);
      // All rows should see the same last value (1200)
      result.forEach((row: any) => {
        expect(row.last_month_sales).toBe(1200);
      });
    });

    test('NTH_VALUE gets specific position value', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          month,
          sales,
          NTH_VALUE(sales, 2) OVER (ORDER BY month) as second_month_sales
        FROM sales_data
        WHERE region = 'North'
        ORDER BY month
      `,
      );

      expect(result.length).toBe(3);
      // All rows should see the 2nd value (1500)
      result.forEach((row: any) => {
        expect(row.second_month_sales).toBe(1500);
      });
    });

    test('FIRST_VALUE with PARTITION BY', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          region,
          month,
          sales,
          FIRST_VALUE(sales) OVER (PARTITION BY region ORDER BY month) as first_sales
        FROM sales_data
        ORDER BY region, month
      `,
      );

      const north = result.filter((r: any) => r.region === 'North');
      const south = result.filter((r: any) => r.region === 'South');

      north.forEach((row: any) => expect(row.first_sales).toBe(1000));
      south.forEach((row: any) => expect(row.first_sales).toBe(800));
    });

    test('NTH_VALUE beyond window size returns null', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          month,
          NTH_VALUE(sales, 10) OVER (ORDER BY month) as tenth_value
        FROM sales_data
        WHERE region = 'North'
      `,
      );

      result.forEach((row: any) => {
        expect(row.tenth_value).toBeNull();
      });
    });
  });

  describe('NTILE function', () => {
    beforeEach(async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS scores`);
      await executeSql(
        userId,
        `CREATE TABLE scores (
        student VARCHAR(20),
        score INT
      )`,
      );

      await executeSql(
        userId,
        `INSERT INTO scores VALUES
        ('Alice', 95),
        ('Bob', 85),
        ('Carol', 90),
        ('Dave', 75),
        ('Eve', 80),
        ('Frank', 70),
        ('Grace', 88),
        ('Henry', 92)`,
      );
    });

    test('NTILE divides into quartiles', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          student,
          score,
          NTILE(4) OVER (ORDER BY score DESC) as quartile
        FROM scores
        ORDER BY score DESC
      `,
      );

      expect(result.length).toBe(8);

      // Check that each quartile has 2 students (8 / 4 = 2)
      const quartile1 = result.filter((r: any) => r.quartile === 1);
      const quartile2 = result.filter((r: any) => r.quartile === 2);
      const quartile3 = result.filter((r: any) => r.quartile === 3);
      const quartile4 = result.filter((r: any) => r.quartile === 4);

      expect(quartile1.length).toBe(2);
      expect(quartile2.length).toBe(2);
      expect(quartile3.length).toBe(2);
      expect(quartile4.length).toBe(2);

      // Top quartile should have highest scores
      expect(quartile1[0].score).toBeGreaterThanOrEqual(90);
    });

    test('NTILE with uneven distribution', async () => {
      await executeSql(
        userId,
        `DELETE FROM scores WHERE student IN ('Frank', 'Grace', 'Henry')`,
      );

      const result = await executeSql(
        userId,
        `
        SELECT 
          student,
          score,
          NTILE(3) OVER (ORDER BY score DESC) as tercile
        FROM scores
        ORDER BY score DESC
      `,
      );

      expect(result.length).toBe(5);

      // 5 students into 3 buckets: 2, 2, 1
      const tercile1 = result.filter((r: any) => r.tercile === 1);
      const tercile2 = result.filter((r: any) => r.tercile === 2);
      const tercile3 = result.filter((r: any) => r.tercile === 3);

      expect(tercile1.length).toBe(2);
      expect(tercile2.length).toBe(2);
      expect(tercile3.length).toBe(1);
    });

    test('NTILE(1) puts all in same bucket', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          student,
          NTILE(1) OVER (ORDER BY score) as bucket
        FROM scores
      `,
      );

      result.forEach((row: any) => {
        expect(row.bucket).toBe(1);
      });
    });
  });

  describe('CUME_DIST and PERCENT_RANK', () => {
    beforeEach(async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS grades`);
      await executeSql(
        userId,
        `CREATE TABLE grades (
        student VARCHAR(20),
        grade INT
      )`,
      );

      await executeSql(
        userId,
        `INSERT INTO grades VALUES
        ('Alice', 90),
        ('Bob', 80),
        ('Carol', 90),
        ('Dave', 70),
        ('Eve', 80),
        ('Frank', 95)`,
      );
    });

    test('CUME_DIST calculates cumulative distribution', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          student,
          grade,
          CUME_DIST() OVER (ORDER BY grade) as cume_dist
        FROM grades
        ORDER BY grade, student
      `,
      );

      expect(result.length).toBe(6);

      // Dave (70) - 1/6 = 0.1666...
      const dave = result.find((r: any) => r.student === 'Dave');
      expect(dave?.cume_dist).toBeCloseTo(1 / 6, 2);

      // Frank (95) - 6/6 = 1
      const frank = result.find((r: any) => r.student === 'Frank');
      expect(frank?.cume_dist).toBe(1);
    });

    test('PERCENT_RANK calculates percentile rank', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          student,
          grade,
          PERCENT_RANK() OVER (ORDER BY grade) as pct_rank
        FROM grades
        ORDER BY grade, student
      `,
      );

      expect(result.length).toBe(6);

      // First row (Dave, 70) should have percent_rank = 0
      const dave = result.find((r: any) => r.student === 'Dave');
      expect(dave?.pct_rank).toBe(0);

      // Last row (Frank, 95) should have percent_rank = 1
      const frank = result.find((r: any) => r.student === 'Frank');
      expect(frank?.pct_rank).toBe(1);
    });

    test('PERCENT_RANK with ties', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          student,
          grade,
          PERCENT_RANK() OVER (ORDER BY grade) as pct_rank
        FROM grades
        ORDER BY grade, student
      `,
      );

      // Alice and Carol both have grade 90, should have same percent_rank
      const alice = result.find((r: any) => r.student === 'Alice');
      const carol = result.find((r: any) => r.student === 'Carol');

      expect(alice?.pct_rank).toBe(carol?.pct_rank);
    });

    test('CUME_DIST and PERCENT_RANK with single row', async () => {
      await executeSql(userId, `DELETE FROM grades`);
      await executeSql(userId, `INSERT INTO grades VALUES ('Solo', 100)`);

      const result = await executeSql(
        userId,
        `
        SELECT 
          CUME_DIST() OVER (ORDER BY grade) as cume_dist,
          PERCENT_RANK() OVER (ORDER BY grade) as pct_rank
        FROM grades
      `,
      );

      expect(result[0].cume_dist).toBe(1);
      expect(result[0].pct_rank).toBe(0);
    });
  });

  describe('Combined window functions', () => {
    beforeEach(async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS employee_sales`);
      await executeSql(
        userId,
        `CREATE TABLE employee_sales (
        emp_name VARCHAR(20),
        dept VARCHAR(20),
        sales INT
      )`,
      );

      await executeSql(
        userId,
        `INSERT INTO employee_sales VALUES
        ('Alice', 'North', 1000),
        ('Bob', 'North', 1500),
        ('Carol', 'North', 1200),
        ('Dave', 'South', 800),
        ('Eve', 'South', 900)`,
      );
    });

    test('Multiple window functions in same query', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          emp_name,
          dept,
          sales,
          LAG(sales) OVER (PARTITION BY dept ORDER BY sales) as prev_sales,
          LEAD(sales) OVER (PARTITION BY dept ORDER BY sales) as next_sales,
          FIRST_VALUE(sales) OVER (PARTITION BY dept ORDER BY sales) as min_sales,
          LAST_VALUE(sales) OVER (PARTITION BY dept ORDER BY sales) as max_sales
        FROM employee_sales
        ORDER BY dept, sales
      `,
      );

      expect(result.length).toBe(5);

      const north = result.filter((r: any) => r.dept === 'North');

      // First North employee (Alice, 1000)
      expect(north[0].prev_sales).toBeNull();
      expect(north[0].next_sales).toBe(1200);
      expect(north[0].min_sales).toBe(1000);
    });

    test('NTILE with PERCENT_RANK', async () => {
      const result = await executeSql(
        userId,
        `
        SELECT 
          emp_name,
          sales,
          NTILE(3) OVER (ORDER BY sales) as tercile,
          PERCENT_RANK() OVER (ORDER BY sales) as pct_rank
        FROM employee_sales
        ORDER BY sales
      `,
      );

      expect(result.length).toBe(5);

      // Verify first employee has lowest percentile
      expect(result[0].pct_rank).toBe(0);

      // Verify last employee is in top tercile
      expect(result[4].tercile).toBe(3);
    });
  });

  describe('Error cases and edge cases', () => {
    test('Window function on empty table', async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS empty_table`);
      await executeSql(userId, `CREATE TABLE empty_table (value INT)`);

      const result = await executeSql(
        userId,
        `
        SELECT 
          value,
          LEAD(value) OVER (ORDER BY value) as next_value
        FROM empty_table
      `,
      );

      expect(result.length).toBe(0);
    });

    test('NTILE with bucket count larger than rows', async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS few_rows`);
      await executeSql(userId, `CREATE TABLE few_rows (id INT)`);
      await executeSql(userId, `INSERT INTO few_rows VALUES (1), (2)`);

      const result = await executeSql(
        userId,
        `
        SELECT 
          id,
          NTILE(10) OVER (ORDER BY id) as bucket
        FROM few_rows
      `,
      );

      expect(result.length).toBe(2);
      expect(result[0].bucket).toBe(1);
      expect(result[1].bucket).toBe(2);
    });

    test('NTH_VALUE with N = 0', async () => {
      await executeSql(userId, `DROP TABLE IF EXISTS data`);
      await executeSql(userId, `CREATE TABLE data (value INT)`);
      await executeSql(userId, `INSERT INTO data VALUES (10), (20), (30)`);

      const result = await executeSql(
        userId,
        `
        SELECT 
          value,
          NTH_VALUE(value, 0) OVER (ORDER BY value) as zeroth
        FROM data
      `,
      );

      result.forEach((row: any) => {
        expect(row.zeroth).toBeNull();
      });
    });
  });
});
