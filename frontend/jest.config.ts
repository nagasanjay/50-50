import type { Config } from 'jest';

const config: Config = {
  rootDir: '.',
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'lib/**/*.ts',
    'components/**/*.tsx',
    '!components/ui/**',
    '!**/*.d.ts',
    // next/headers only works inside a request-scoped Next.js render; there's no
    // meaningful unit test for a one-line passthrough without mocking next/headers
    // itself (mocking the function under test, not data — against this project's rule).
    '!lib/server-auth.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 75,
      functions: 85,
      lines: 85,
    },
  },
};

export default config;
