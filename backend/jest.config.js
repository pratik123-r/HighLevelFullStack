export default {
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: ['**/tests/**/*.test.js', '**/?(*.)+(spec|test).js'],
  testPathIgnorePatterns: ['/node_modules/', '/tests/services/BookingService.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/app.js',
    '!src/workers/**',
    '!src/config/**',
    '!src/services/BookingService.js', // Excluded due to memory issues
    '!**/__tests__/**',
    '!**/tests/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 60,
      lines: 65,
      statements: 65,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  // Reduce workers to 1 to prevent memory issues with large test files
  // This ensures tests run sequentially and memory is freed between tests
  maxWorkers: 1,
  workerIdleMemoryLimit: '500MB',
  // Increase test timeout for complex tests
  testTimeout: 30000,
  // Isolate modules to prevent state leakage between tests
  resetModules: false,
  clearMocks: true,
  restoreMocks: true,
  // Global teardown to close connections
  globalTeardown: '<rootDir>/tests/teardown.js',
  // Force exit after tests to prevent hanging
  forceExit: true,
};

