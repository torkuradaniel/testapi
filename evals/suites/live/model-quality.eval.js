/**
 * Live Model Quality Evals
 * Tests real OpenAI API responses for quality and correctness
 *
 * Run with: OPENAI_API_KEY=your-key npm run eval:live
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateTestsLive } from '../../harness/liveClient.js';
import { validateTests } from '../../harness/evaluators/structure.js';
import { analyzeCoverage, calculateCoverageScore } from '../../harness/evaluators/coverage.js';
import { evaluateIntentAlignment } from '../../harness/evaluators/intent.js';
import {
  compareTestSuite,
  checkCategoryCoverage,
  getComparisonSummary,
} from '../../harness/evaluators/golden.js';
import { generateModelReport, generateJsonReport } from '../../harness/reporter.js';
import paymentFixture from '../../fixtures/pointers/payment.json';
import userCrudFixture from '../../fixtures/pointers/user-crud.json';
import goldenOutput from '../../fixtures/golden-outputs/payment-tests.json';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPORTS_DIR = join(__dirname, '../../reports');

// Skip if no API key
const API_KEY = process.env.OPENAI_API_KEY;
const shouldSkip = !API_KEY || API_KEY === 'test-api-key-for-evals';

// Model to test (can be overridden via env var)
const MODEL = process.env.EVAL_MODEL || 'gpt-5.1';

describe.skipIf(shouldSkip)(`Live Model Quality Evals (${MODEL})`, () => {
  let paymentTests;
  let userTests;
  let paymentResult;
  let userResult;

  beforeAll(async () => {
    console.log(`\n  Testing model: ${MODEL}\n`);

    // Generate tests for payment fixture
    paymentResult = await generateTestsLive({
      pointer: paymentFixture.pointer,
      requestConfig: paymentFixture.requestConfig,
      count: paymentFixture.count,
      model: MODEL,
      apiKey: API_KEY,
    });
    paymentTests = paymentResult.tests;
    console.log(`  Payment tests generated: ${paymentTests.length} (${paymentResult.latencyMs}ms)`);

    // Generate tests for user CRUD fixture
    userResult = await generateTestsLive({
      pointer: userCrudFixture.pointer,
      requestConfig: userCrudFixture.requestConfig,
      count: userCrudFixture.count,
      model: MODEL,
      apiKey: API_KEY,
    });
    userTests = userResult.tests;
    console.log(`  User CRUD tests generated: ${userTests.length} (${userResult.latencyMs}ms)\n`);
  }, 360000); // 3 min timeout for API calls

  afterAll(() => {
    // Generate CSV report after all tests complete
    if (paymentTests && paymentTests.length > 0) {
      const coverage = analyzeCoverage(paymentTests);
      const coverageScore = calculateCoverageScore(coverage);
      const intentEval = evaluateIntentAlignment(paymentFixture.pointer, paymentTests);
      const goldenComparison = compareTestSuite(paymentTests, goldenOutput.tests);
      const categoryCoverage = checkCategoryCoverage(paymentTests, goldenOutput.tests);

      const reportPath = generateModelReport({
        model: MODEL,
        tests: paymentTests,
        scores: {
          structureValid: validateTests(paymentTests).valid,
          coverageScore: coverageScore.score,
          intentScore: intentEval.userRequestedTests.alignmentScore * 100,
          goldenScore: goldenComparison.averageScore * 100,
          goldenCoverage: categoryCoverage.coveragePercent,
        },
        metrics: {
          latencyMs: paymentResult.latencyMs,
          totalTokens: paymentResult.usage?.total_tokens || 0,
          promptTokens: paymentResult.usage?.prompt_tokens,
          completionTokens: paymentResult.usage?.completion_tokens,
        },
        reportsDir: REPORTS_DIR,
      });

      console.log(`\n  CSV Report generated: ${reportPath}\n`);

      const jsonReportPath = generateJsonReport(
        {
          model: MODEL,
          generatedAt: new Date().toISOString(),
          suites: [
            {
              name: 'payment',
              pointer: paymentFixture.pointer,
              requestConfig: paymentFixture.requestConfig,
              requestedCount: paymentFixture.count,
              tests: paymentTests,
              metrics: {
                latencyMs: paymentResult?.latencyMs,
                usage: paymentResult?.usage || {},
              },
            },
            {
              name: 'user-crud',
              pointer: userCrudFixture.pointer,
              requestConfig: userCrudFixture.requestConfig,
              requestedCount: userCrudFixture.count,
              tests: userTests || [],
              metrics: {
                latencyMs: userResult?.latencyMs,
                usage: userResult?.usage || {},
              },
            },
          ],
        },
        `openai-tests-${MODEL}`,
        REPORTS_DIR
      );

      console.log(`\n  JSON Tests Report generated: ${jsonReportPath}\n`);
    }
  });

  describe('structure-correctness', () => {
    it('all generated tests have valid structure', () => {
      const result = validateTests(paymentTests);
      expect(result.valid, `Errors: ${result.errors.join('; ')}`).toBe(true);
    });

    it('generates the requested number of tests', () => {
      // Allow slight variance (±2) for live API responses
      expect(paymentTests.length).toBeGreaterThanOrEqual(paymentFixture.count - 0);
      expect(paymentTests.length).toBeLessThanOrEqual(paymentFixture.count + 0);
      expect(userTests.length).toBeGreaterThanOrEqual(userCrudFixture.count - 0);
      expect(userTests.length).toBeLessThanOrEqual(userCrudFixture.count + 0);
    });

    it('tests have unique names', () => {
      const names = paymentTests.map((t) => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });

  describe('intent-alignment', () => {
    it('first 3 tests address user pointer', () => {
      const evaluation = evaluateIntentAlignment(paymentFixture.pointer, paymentTests);
      expect(evaluation.userRequestedTests.meetsThreshold).toBe(true);
    });

    it('first 3 tests have user_requested flag', () => {
      const firstThree = paymentTests.slice(0, 3);
      const flaggedCount = firstThree.filter((t) => t.user_requested === true).length;
      expect(flaggedCount).toBeGreaterThanOrEqual(2); // Allow some flexibility
    });

    it('user CRUD pointer is addressed', () => {
      const evaluation = evaluateIntentAlignment(userCrudFixture.pointer, userTests);
      expect(evaluation.userRequestedTests.alignmentScore).toBeGreaterThan(0.3);
    });
  });

  describe('edge-case-coverage', () => {
    it('includes boundary value tests', () => {
      const coverage = analyzeCoverage(paymentTests);
      expect(coverage.boundaryNumbers.count).toBeGreaterThanOrEqual(1);
    });

    it('includes empty value tests', () => {
      const coverage = analyzeCoverage(paymentTests);
      expect(coverage.emptyValues.count).toBeGreaterThanOrEqual(1);
    });

    it('includes security tests', () => {
      const coverage = analyzeCoverage(paymentTests);
      expect(coverage.injectionTests.count).toBeGreaterThanOrEqual(1);
    });

    it('achieves reasonable coverage score', () => {
      const coverage = analyzeCoverage(paymentTests);
      const { score } = calculateCoverageScore(coverage);
      expect(score).toBeGreaterThanOrEqual(30); // 30% minimum
    });
  });

  describe('response-quality', () => {
    it('test names are descriptive (min 10 chars)', () => {
      for (const test of paymentTests) {
        expect(test.name.length).toBeGreaterThanOrEqual(10);
      }
    });

    it('tests have meaningful tags', () => {
      for (const test of paymentTests) {
        expect(test.tags).toBeDefined();
        expect(Array.isArray(test.tags)).toBe(true);
        expect(test.tags.length).toBeGreaterThan(0);
      }
    });

    it('tests have valid priority values', () => {
      const validPriorities = ['high', 'medium', 'low'];
      for (const test of paymentTests) {
        expect(validPriorities).toContain(test.priority);
      }
    });

    it('tests have valid run_mode values', () => {
      const validModes = ['auto', 'manual'];
      for (const test of paymentTests) {
        expect(validModes).toContain(test.run_mode);
      }
    });
  });

  describe('golden-comparison', () => {
    it('achieves minimum similarity score against golden output', () => {
      const comparison = compareTestSuite(paymentTests, goldenOutput.tests);
      expect(
        comparison.averageScore,
        getComparisonSummary(comparison)
      ).toBeGreaterThanOrEqual(0.5); // 50% minimum for live (more lenient)
    });

    it('covers majority of golden test categories', () => {
      const { coveragePercent, missing } = checkCategoryCoverage(
        paymentTests,
        goldenOutput.tests
      );
      expect(
        coveragePercent,
        `Missing categories: ${missing.join(', ')}`
      ).toBeGreaterThanOrEqual(50); // 50% category coverage for live (more lenient)
    });

    it('matches at least some golden tests', () => {
      const comparison = compareTestSuite(paymentTests, goldenOutput.tests);
      const coverageRatio =
        comparison.coverageReport.goldenCovered / comparison.totalGolden;
      expect(
        coverageRatio,
        `Only covered ${comparison.coverageReport.goldenCovered}/${comparison.totalGolden} golden tests`
      ).toBeGreaterThanOrEqual(0.5); // Cover at least 50% of golden tests
    });
  });

  describe('api-metrics', () => {
    it('response latency is reasonable', () => {
      // Should complete within 30 seconds
      expect(paymentResult.latencyMs).toBeLessThan(30000);
    });

    it('token usage is tracked', () => {
      expect(paymentResult.usage).toBeDefined();
      expect(paymentResult.usage.total_tokens).toBeGreaterThan(0);
    });
  });
});
