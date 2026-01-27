/**
 * Evals Setup File
 * Runs before all eval suites to configure global state and mocks
 */

import { beforeAll, afterAll, vi } from 'vitest';

// Mock environment variables for testing
beforeAll(() => {
  process.env.OPENAI_API_KEY = '';
});

afterAll(() => {
  vi.restoreAllMocks();
});
