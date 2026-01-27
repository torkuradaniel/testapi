import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['evals/suites/**/*.eval.js'],
    setupFiles: ['evals/setup.js'],
    testTimeout: 120000, // 2 min for live API calls
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['app/api/**/*.js', 'lib/**/*.js'],
    },
    // Sequence for live tests to avoid rate limits
    sequence: {
      concurrent: false,
    },
  },
});
