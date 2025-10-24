/**
 * Teardown global para testes de workers
 * Fecha conexões apenas no final de TODOS os testes
 */

import { closeDatabaseConnection } from './setup';

afterAll(async () => {
  await closeDatabaseConnection();
});
