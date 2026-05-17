module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  // TODO(Task 4): Remove this flag after the first spec file is added in Task 4.
  // Tests are added incrementally; without it, npm test exits 1 on zero files
  // and blocks the scaffolding stage.
  passWithNoTests: true,
  moduleDirectories: ['node_modules', 'src'],
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/tests/mocks/obsidian.ts',
  },
  // src/ does not exist yet — coverage collection is a no-op until Task 3+.
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/view/**'],
};
