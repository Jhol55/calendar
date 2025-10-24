import type { Config } from 'jest';

// Configuração Jest para testes de integração (Node.js environment)
const config: Config = {
  displayName: 'integration',
  testEnvironment: 'node',
  coverageProvider: 'v8',

  // Pattern para testes de integração
  testMatch: [
    '**/__tests__/**/*.integration.test.ts',
    '**/tests/integration/database/**/*.test.ts',
    // '**/tests/integration/workers/**/*.test.ts',
  ],

  // Path mappings
  moduleNameMapper: {
    '^@/services/(.*)$': '<rootDir>/src/services/$1',
    '^@/config/(.*)$': '<rootDir>/src/config/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    '^@/workers/(.*)$': '<rootDir>/src/workers/$1',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
  },

  // TypeScript transform
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/integration/database/setup.ts',
    '<rootDir>/tests/integration/workers/setup.ts',
    '<rootDir>/tests/integration/workers/teardown.ts',
  ],

  // Timeout para testes de integração (30s)
  testTimeout: 30000,

  // Cobertura
  collectCoverageFrom: [
    'src/services/database/**/*.ts',
    '!src/services/database/**/*.types.ts',
  ],

  // Verbose output
  verbose: true,

  // Rodar testes em série para evitar race conditions
  maxWorkers: 1,

  // Forçar saída após testes (evita workers pendurados)
  forceExit: true, // Forçar porque Redis/Bull queues deixam handles abertos

  // Detectar handles abertos (conexões não fechadas)
  detectOpenHandles: false, // Desabilitar porque já sabemos que Redis fica aberto
};

export default config;
