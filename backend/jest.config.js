export default {
  testEnvironment: 'node',
  testMatch: ['**/src/tests/**/*.test.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/middlewares/**/*.js',
    'src/services/**/*.js',
  ],
  coverageThreshold: {
    global: {
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
  },
};
