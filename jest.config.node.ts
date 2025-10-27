import type { Config } from 'jest';

// Configuração Jest para testes de integração (Node.js environment)
const config: Config = {
  displayName: 'integration',
  testEnvironment: 'node',
  coverageProvider: 'v8',

  // Pattern para testes de integração
  testMatch: [
    '**/tests/integration/**/__tests__/**/*.test.ts', // Todos os testes de integração
    '!**/tests/integration/**/__tests__/**/*.stress.test.ts', // Excluir stress tests por padrão
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

  // Setup files - cada setup será carregado apenas para seus próprios testes
  // Nota: Não podemos usar setupFilesAfterEnv condicional diretamente no Jest
  // então usamos a verificação de path dentro de cada setup
  setupFilesAfterEnv: [
    '<rootDir>/tests/integration/setup.ts',
    // '<rootDir>/tests/integration/nodes/webhook-node/setup.ts',
    // '<rootDir>/tests/integration/workflow/setup.ts',
  ],

  testTimeout: 60000,

  // Cobertura
  collectCoverageFrom: ['src/services/**/*.ts', '!src/services/**/*.types.ts'],

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
