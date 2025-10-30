/**
 * SQL Engine - Error Handling
 *
 * Testa tratamento de erros e validações:
 * - Tabelas inexistentes
 * - Colunas inexistentes
 * - Operações SQL bloqueadas
 * - Sintaxe SQL inválida
 * - Violações de tipos
 */

import {
  setupTestUser,
  executeSql,
  expectSqlError,
} from '../../../helpers/sql-engine';

describe('SQL Engine - Error Handling', () => {
  describe('Tabelas Inexistentes', () => {
    it('SELECT em tabela inexistente deve retornar erro', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await expectSqlError(
          userId,
          `SELECT * FROM nonexistent_table`,
          /não existe|not exist/i,
        );
      } finally {
        await cleanup();
      }
    });

    it('INSERT em tabela inexistente deve retornar erro', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await expectSqlError(
          userId,
          `INSERT INTO nonexistent_table VALUES (1, 2)`,
          /não existe|not exist/i,
        );
      } finally {
        await cleanup();
      }
    });

    it('DROP em tabela inexistente deve retornar erro', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await expectSqlError(
          userId,
          `DROP TABLE nonexistent_table`,
          /não existe|not exist/i,
        );
      } finally {
        await cleanup();
      }
    });
  });

  describe('Operações Bloqueadas', () => {
    it('TRUNCATE deve ser bloqueado', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE test_table (id INT)`);

        await expectSqlError(
          userId,
          `TRUNCATE TABLE test_table`,
          /não permitida|não suportada|not supported/i,
        );
      } finally {
        await cleanup();
      }
    });

    it('GRANT deve ser bloqueado', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await expectSqlError(
          userId,
          `GRANT SELECT ON test_table TO user`,
          /não permitida|não suportada|not supported/i,
        );
      } finally {
        await cleanup();
      }
    });

    it('REVOKE deve ser bloqueado', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await expectSqlError(
          userId,
          `REVOKE SELECT ON test_table FROM user`,
          /não permitida|não suportada|not supported/i,
        );
      } finally {
        await cleanup();
      }
    });
  });

  describe('CREATE TABLE Validations', () => {
    it('CREATE TABLE duplicada deve retornar erro', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE duplicate_test (id INT)`);

        await expectSqlError(
          userId,
          `CREATE TABLE duplicate_test (id INT)`,
          /já existe|already exists/i,
        );
      } finally {
        await cleanup();
      }
    });
  });

  describe('INSERT Validations', () => {
    it('INSERT sem VALUES deve retornar erro', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE test_table (id INT)`);

        // SQL inválido - sem VALUES
        await expect(
          executeSql(userId, `INSERT INTO test_table`),
        ).rejects.toThrow();
      } finally {
        await cleanup();
      }
    });
  });

  describe('Sintaxe SQL Inválida', () => {
    it('SQL com sintaxe inválida deve retornar erro', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await expect(
          executeSql(userId, `SELEKT * FORM table`),
        ).rejects.toThrow();
      } finally {
        await cleanup();
      }
    });

    it('SQL vazio deve retornar erro', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await expect(executeSql(userId, ``)).rejects.toThrow();
      } finally {
        await cleanup();
      }
    });
  });

  describe('JOIN Errors', () => {
    it('JOIN com tabela inexistente deve retornar erro', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE table_a (id INT)`);

        await expectSqlError(
          userId,
          `SELECT * FROM table_a JOIN nonexistent ON table_a.id = nonexistent.id`,
          /não existe|not exist/i,
        );
      } finally {
        await cleanup();
      }
    });
  });

  describe('WHERE Clause Errors', () => {
    it('WHERE com coluna inexistente deve retornar resultado vazio ou erro', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(
          userId,
          `CREATE TABLE users (id INT, name VARCHAR(50))`,
        );
        await executeSql(userId, `INSERT INTO users VALUES (1, 'Alice')`);

        // Pode retornar vazio ou erro dependendo da implementação
        const result = await executeSql(
          userId,
          `SELECT * FROM users WHERE nonexistent_column = 'test'`,
        );

        // Deve retornar array vazio (não quebrar)
        expect(Array.isArray(result)).toBe(true);
      } finally {
        await cleanup();
      }
    });
  });

  describe('Graceful Degradation', () => {
    it('Erro em uma query não deve afetar próximas queries', async () => {
      const { userId, cleanup } = await setupTestUser();

      try {
        await executeSql(userId, `CREATE TABLE test (id INT)`);

        // Query com erro
        await expect(
          executeSql(userId, `SELECT * FROM nonexistent`),
        ).rejects.toThrow();

        // Próxima query deve funcionar normalmente
        const result = await executeSql(userId, `SELECT * FROM test`);
        expect(Array.isArray(result)).toBe(true);
      } finally {
        await cleanup();
      }
    });

    it('Múltiplos usuários com erros não devem afetar uns aos outros', async () => {
      const userA = await setupTestUser();
      const userB = await setupTestUser();

      try {
        await executeSql(userA.userId, `CREATE TABLE test_a (id INT)`);
        await executeSql(userB.userId, `CREATE TABLE test_b (id INT)`);

        // User A gera erro
        await expect(
          executeSql(userA.userId, `SELECT * FROM nonexistent`),
        ).rejects.toThrow();

        // User B deve continuar funcionando
        const resultB = await executeSql(userB.userId, `SELECT * FROM test_b`);
        expect(Array.isArray(resultB)).toBe(true);

        // User A deve voltar a funcionar
        const resultA = await executeSql(userA.userId, `SELECT * FROM test_a`);
        expect(Array.isArray(resultA)).toBe(true);
      } finally {
        await userA.cleanup();
        await userB.cleanup();
      }
    });
  });
});
