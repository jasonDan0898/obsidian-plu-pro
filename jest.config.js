module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  // Allow the test suite to pass when no test files exist yet.
  // Tests are added incrementally in later tasks; failing here would block CI.
  passWithNoTests: true,
  moduleDirectories: ['node_modules', 'src'],
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/tests/mocks/obsidian.ts',
  },
  // src/ does not exist yet — coverage collection is a no-op until Task 3+.
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/view/**'],
};
