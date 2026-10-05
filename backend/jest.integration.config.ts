import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.int-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  testTimeout: 30000,
  setupFiles: ['<rootDir>/test/jest.setup.ts'],
  // All integration spec files share one real Postgres database, and each
  // truncates every table in afterEach — running files in parallel workers
  // lets one file's cleanup wipe rows a concurrently-running file still needs.
  maxWorkers: 1,
  // Covers everything that talks to Prisma/HTTP (controllers, services, guards),
  // exercised here against a real database rather than mocked in unit tests.
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/**/dto/*.ts',
    '!src/**/*.spec.ts',
    '!src/expenses/split.util.ts',
    '!src/balances/balances.util.ts',
    '!src/import/csv-import.util.ts',
  ],
  coverageDirectory: 'coverage/integration',
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
  },
};

export default config;
