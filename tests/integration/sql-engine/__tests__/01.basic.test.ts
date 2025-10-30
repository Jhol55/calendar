/**
 * SQL Engine - Testes Básicos
 *
 * Valida funcionalidades básicas do SQL Engine:
 * - CREATE TABLE
 * - INSERT
 * - SELECT
 * - DROP TABLE
 * - Isolamento de usuários
 */

import {
  setupTestUser,
  executeSql,
  tableExists,
  getAllRecords,
  countRecords,
  capturePostgresSnapshot,
  compareSnapshots,
  type PostgresSnapshot,
} from '../../../helpers/sql-engine';

describe('SQL Engine - Basic Operations', () => {
  let postgresSnapshotBefore: PostgresSnapshot;

  beforeAll(async () => {
    postgresSnapshotBefore = await capturePostgresSnapshot();
    console.log(
      `📸 PostgreSQL snapshot: ${postgresSnapshotBefore.tableNames.length} tables`,
    );
  });

  afterAll(async () => {
    const postgresSnapshotAfter = await capturePostgresSnapshot();
    compareSnapshots(postgresSnapshotBefore, postgresSnapshotAfter);
    console.log('✅ PostgreSQL integrity verified');
  });

  describe('CREATE TABLE', () => {
    it('deve criar tabela simples', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        // Criar tabela
        await executeSql(
          userId,
          `CREATE TABLE users (id INT, name VARCHAR(100))`,
        );

        // Validar que existe
        const exists = await tableExists(userId, 'users');
        expect(exists).toBe(true);

        console.log('✅ Tabela criada com sucesso');
      } finally {
        await cleanup();
      }
    });
  });

  describe('INSERT', () => {
    it('deve inserir dados', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE products (id INT, name VARCHAR(100))`,
        );
        await executeSql(
          userId,
          `INSERT INTO products VALUES (1, 'Product A')`,
        );

        const count = await countRecords(userId, 'products');
        expect(count).toBe(1);

        console.log('✅ Dados inseridos com sucesso');
      } finally {
        await cleanup();
      }
    });
  });

  describe('SELECT', () => {
    it('deve fazer SELECT simples', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE items (id INT, value INT)`);
        await executeSql(userId, `INSERT INTO items VALUES (1, 100), (2, 200)`);

        const result = await executeSql(
          userId,
          `SELECT * FROM items ORDER BY id`,
        );

        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe(1);
        expect(result[0].value).toBe(100);

        console.log('✅ SELECT executado com sucesso');
      } finally {
        await cleanup();
      }
    });
  });

  describe('DROP TABLE', () => {
    it('deve dropar tabela', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE temp (id INT)`);

        let exists = await tableExists(userId, 'temp');
        expect(exists).toBe(true);

        await executeSql(userId, `DROP TABLE temp`);

        exists = await tableExists(userId, 'temp');
        expect(exists).toBe(false);

        console.log('✅ Tabela dropada com sucesso');
      } finally {
        await cleanup();
      }
    });
  });

  describe('User Isolation', () => {
    it('dados de um usuário não devem ser visíveis para outro', async () => {
      const userA = await setupTestUser();
      const userB = await setupTestUser();

      try {
        // User A cria tabela e insere dados
        await executeSql(
          userA.userId,
          `CREATE TABLE private_data (id INT, secret VARCHAR(50))`,
        );
        await executeSql(
          userA.userId,
          `INSERT INTO private_data VALUES (1, 'secret A')`,
        );

        // User B tenta fazer SELECT (não deve ver dados do User A)
        await executeSql(
          userB.userId,
          `CREATE TABLE private_data (id INT, secret VARCHAR(50))`,
        );
        const resultB = await executeSql(
          userB.userId,
          `SELECT * FROM private_data`,
        );

        // User B não deve ver dados do User A
        expect(resultB).toEqual([]);

        // User A deve ver seus próprios dados
        const resultA = await executeSql(
          userA.userId,
          `SELECT * FROM private_data`,
        );
        expect(resultA).toHaveLength(1);
        expect(resultA[0].secret).toBe('secret A');

        console.log('✅ Isolamento de usuários funcionando');
      } finally {
        await userA.cleanup();
        await userB.cleanup();
      }
    });
  });

  describe('PostgreSQL Safety', () => {
    it('CREATE TABLE não deve criar tabela PostgreSQL real', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE test_safety (id INT)`);

        // Validar que não é tabela PostgreSQL
        const snapshot = await capturePostgresSnapshot();
        expect(snapshot.tableNames).not.toContain('test_safety');

        console.log('✅ CREATE TABLE isolado do PostgreSQL');
      } finally {
        await cleanup();
      }
    });
  });
});
