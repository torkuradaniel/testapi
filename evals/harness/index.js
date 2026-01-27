/**
 * Evals Harness - Main Entry Point
 * Exports all evaluators and utilities for test evaluation
 */

// Evaluators
export * from './evaluators/structure.js';
export * from './evaluators/coverage.js';
export * from './evaluators/intent.js';
export * from './evaluators/golden.js';

// Reporter
export * from './reporter.js';

// Mocks
export { mockOpenAI, getMockResponse } from './mocks/openai.js';

// Live client
export {
  generateTestsLive,
  compareModels,
  createClient,
  SUPPORTED_MODELS,
} from './liveClient.js';

// Re-export config
export { config } from '../config.js';
