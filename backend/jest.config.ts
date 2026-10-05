import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // This config only runs true unit tests (pure functions, zero I/O, zero mocking).
  // Everything else — controllers, services, guards, DTOs — talks to Prisma/HTTP and
  // is covered instead by the integration suite (jest.integration.config.ts) against a
  // real Postgres database, per the project's "mock data, not functions" testing rule.
  collectCoverageFrom: [
    'expenses/split.util.ts',
    'balances/balances.util.ts',
    'import/csv-import.util.ts',
  ],
  coverageDirectory: '../coverage/unit',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      statements: 95,
      branches: 90,
      functions: 95,
      lines: 95,
    },
  },
};

export default config;
