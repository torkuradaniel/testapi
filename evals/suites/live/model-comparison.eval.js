/**
 * Model Comparison Evals
 * Compare test generation quality across different OpenAI models
 *
 * Run with: OPENAI_API_KEY=your-key npm run eval:compare
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { compareModels } from '../../harness/liveClient.js';
import { validateTests } from '../../harness/evaluators/structure.js';
import { analyzeCoverage, calculateCoverageScore } from '../../harness/evaluators/coverage.js';
import { evaluateIntentAlignment } from '../../harness/evaluators/intent.js';
import { compareTestSuite, checkCategoryCoverage } from '../../harness/evaluators/golden.js';
import { generateComparisonReport, generateJsonReport } from '../../harness/reporter.js';
import paymentFixture from '../../fixtures/pointers/payment.json';
import goldenOutput from '../../fixtures/golden-outputs/payment-tests.json';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPORTS_DIR = join(__dirname, '../../reports');

// Skip if no API key
const API_KEY = process.env.OPENAI_API_KEY;
const shouldSkip = !API_KEY || API_KEY === 'test-api-key-for-evals';

// Models to compare (can be overridden via env var)
const MODELS_TO_COMPARE = process.env.EVAL_MODELS
  ? process.env.EVAL_MODELS.split(',')
  : ['gpt-4o-mini', 'gpt-4o'];

describe.skipIf(shouldSkip)('Model Comparison Evals', () => {
  let comparisonResults;
  const modelScores = {};

  beforeAll(async () => {
    console.log(`\n  Comparing models: ${MODELS_TO_COMPARE.join(', ')}\n`);

    comparisonResults = await compareModels({
      pointer: paymentFixture.pointer,
      requestConfig: paymentFixture.requestConfig,
      count: paymentFixture.count,
      models: MODELS_TO_COMPARE,
      apiKey: API_KEY,
    });

    // Calculate scores for each model
    for (const [model, result] of Object.entries(comparisonResults)) {
      if (result.success) {
        const structureResult = validateTests(result.tests);
        const coverage = analyzeCoverage(result.tests);
        const coverageScore = calculateCoverageScore(coverage);
        const intentEval = evaluateIntentAlignment(paymentFixture.pointer, result.tests);
        const goldenComparison = compareTestSuite(result.tests, goldenOutput.tests);
        const categoryCoverage = checkCategoryCoverage(result.tests, goldenOutput.tests);

        modelScores[model] = {
          structureValid: structureResult.valid,
          structureErrors: structureResult.invalidCount,
          coverageScore: coverageScore.score,
          intentScore: intentEval.userRequestedTests.alignmentScore * 100,
          goldenScore: goldenComparison.averageScore * 100,
          goldenCoverage: categoryCoverage.coveragePercent,
          latencyMs: result.latencyMs,
          tokensUsed: result.usage?.total_tokens || 0,
          testCount: result.tests.length,
        };

        console.log(`  ${model}:`);
        console.log(`    - Tests: ${result.tests.length}`);
        console.log(`    - Structure valid: ${structureResult.valid}`);
        console.log(`    - Coverage score: ${coverageScore.score.toFixed(1)}%`);
        console.log(`    - Intent score: ${(intentEval.userRequestedTests.alignmentScore * 100).toFixed(1)}%`);
        console.log(`    - Golden similarity: ${(goldenComparison.averageScore * 100).toFixed(1)}%`);
        console.log(`    - Golden category coverage: ${categoryCoverage.coveragePercent.toFixed(1)}%`);
        console.log(`    - Latency: ${result.latencyMs}ms`);
        console.log(`    - Tokens: ${result.usage?.total_tokens || 'N/A'}\n`);
      } else {
        console.log(`  ${model}: FAILED - ${result.error}\n`);
        modelScores[model] = { error: result.error };
      }
    }
  }, 120000); // 2 min timeout for multiple API calls

  afterAll(() => {
    // Generate CSV comparison report after all tests complete
    if (Object.keys(modelScores).length > 0) {
      const reportPath = generateComparisonReport({
        modelScores,
        pointer: paymentFixture.pointer,
        reportsDir: REPORTS_DIR,
      });

      console.log(`\n  CSV Comparison Report generated: ${reportPath}\n`);

      if (comparisonResults && Object.keys(comparisonResults).length > 0) {
        const jsonReportPath = generateJsonReport(
          {
            pointer: paymentFixture.pointer,
            requestConfig: paymentFixture.requestConfig,
            requestedCount: paymentFixture.count,
            generatedAt: new Date().toISOString(),
            models: Object.fromEntries(
              Object.entries(comparisonResults).map(([model, result]) => [
                model,
                {
                  success: result.success,
                  error: result.error,
                  tests: result.tests || [],
                  metrics: {
                    latencyMs: result.latencyMs,
                    usage: result.usage || {},
                  },
                },
              ])
            ),
          },
          'openai-tests-comparison',
          REPORTS_DIR
        );

        console.log(`\n  JSON Tests Report generated: ${jsonReportPath}\n`);
      }
    }
  });

  describe('all-models-generate-valid-output', () => {
    it.each(MODELS_TO_COMPARE)('%s generates valid test structure', (model) => {
      const result = comparisonResults[model];
      expect(result.success, result.error).toBe(true);

      if (result.success) {
        const structureResult = validateTests(result.tests);
        expect(structureResult.valid, `Errors: ${structureResult.errors.join('; ')}`).toBe(true);
      }
    });

    it.each(MODELS_TO_COMPARE)('%s generates requested count', (model) => {
      const result = comparisonResults[model];
      if (result.success) {
        expect(result.tests.length).toBe(paymentFixture.count);
      }
    });
  });

  describe('quality-comparison', () => {
    it('all models achieve minimum coverage score', () => {
      for (const [model, scores] of Object.entries(modelScores)) {
        if (!scores.error) {
          expect(scores.coverageScore, `${model} coverage too low`).toBeGreaterThanOrEqual(20);
        }
      }
    });

    it('all models address user intent', () => {
      for (const [model, scores] of Object.entries(modelScores)) {
        if (!scores.error) {
          expect(scores.intentScore, `${model} intent score too low`).toBeGreaterThan(30);
        }
      }
    });

    it('all models achieve minimum golden similarity', () => {
      for (const [model, scores] of Object.entries(modelScores)) {
        if (!scores.error) {
          expect(scores.goldenScore, `${model} golden similarity too low`).toBeGreaterThanOrEqual(20);
        }
      }
    });

    it('all models cover golden test categories', () => {
      for (const [model, scores] of Object.entries(modelScores)) {
        if (!scores.error) {
          expect(scores.goldenCoverage, `${model} golden category coverage too low`).toBeGreaterThanOrEqual(30);
        }
      }
    });
  });

  describe('performance-comparison', () => {
    it('all models respond within timeout', () => {
      for (const [model, scores] of Object.entries(modelScores)) {
        if (!scores.error) {
          expect(scores.latencyMs, `${model} too slow`).toBeLessThan(60000);
        }
      }
    });
  });

  describe('comparison-summary', () => {
    it('generates comparison report', () => {
      console.log('\n  === COMPARISON SUMMARY ===\n');

      const successfulModels = Object.entries(modelScores)
        .filter(([, s]) => !s.error)
        .map(([model, scores]) => ({
          model,
          ...scores,
          overallScore: (scores.coverageScore + scores.intentScore + scores.goldenScore) / 3,
        }))
        .sort((a, b) => b.overallScore - a.overallScore);

      if (successfulModels.length > 0) {
        console.log('  Ranking by overall score (coverage + intent + golden):');
        successfulModels.forEach((m, i) => {
          console.log(`    ${i + 1}. ${m.model}: ${m.overallScore.toFixed(1)}% (coverage: ${m.coverageScore.toFixed(1)}%, intent: ${m.intentScore.toFixed(1)}%, golden: ${m.goldenScore.toFixed(1)}%)`);
        });

        console.log('\n  Ranking by golden similarity:');
        const byGolden = [...successfulModels].sort((a, b) => b.goldenScore - a.goldenScore);
        byGolden.forEach((m, i) => {
          console.log(`    ${i + 1}. ${m.model}: ${m.goldenScore.toFixed(1)}% similarity, ${m.goldenCoverage.toFixed(1)}% category coverage`);
        });

        console.log('\n  Ranking by latency:');
        const byLatency = [...successfulModels].sort((a, b) => a.latencyMs - b.latencyMs);
        byLatency.forEach((m, i) => {
          console.log(`    ${i + 1}. ${m.model}: ${m.latencyMs}ms`);
        });

        console.log('\n  Ranking by token efficiency:');
        const byTokens = [...successfulModels].sort((a, b) => a.tokensUsed - b.tokensUsed);
        byTokens.forEach((m, i) => {
          console.log(`    ${i + 1}. ${m.model}: ${m.tokensUsed} tokens`);
        });
      }

      console.log('');
      expect(successfulModels.length).toBeGreaterThan(0);
    });
  });
});
