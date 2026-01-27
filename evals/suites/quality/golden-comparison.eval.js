/**
 * Golden Output Comparison Evals
 * Compares AI-generated tests against known-good golden outputs
 */

import { describe, it, expect } from 'vitest';
import {
  compareTest,
  compareTestSuite,
  checkCategoryCoverage,
  getComparisonSummary,
} from '../../harness/evaluators/golden.js';
import { getMockResponse } from '../../harness/mocks/openai.js';
import paymentFixture from '../../fixtures/pointers/payment.json';
import goldenOutput from '../../fixtures/golden-outputs/payment-tests.json';

describe('Golden Output Comparison Evals', () => {
  // Generate tests using the same pointer as golden
  const mockResponse = getMockResponse(
    paymentFixture.pointer,
    paymentFixture.requestConfig,
    paymentFixture.count
  );
  const generatedTests = mockResponse.tests;
  const goldenTests = goldenOutput.tests;

  describe('individual-test-comparison', () => {
    it('generated tests have similar structure to golden tests', () => {
      // Compare first generated test to first golden test
      const comparison = compareTest(generatedTests[0], goldenTests[0]);

      // Should match on at least method and path
      expect(comparison.matches).toContain('method');
      expect(comparison.matches).toContain('path');
    });

    it('user_requested flags align between generated and golden', () => {
      // First 3 should have user_requested = true in both
      for (let i = 0; i < 3; i++) {
        expect(generatedTests[i].user_requested).toBe(true);
        expect(goldenTests[i].user_requested).toBe(true);
      }
    });
  });

  describe('suite-level-comparison', () => {
    it('generated suite covers golden test categories', () => {
      const { covered, missing, coveragePercent } = checkCategoryCoverage(
        generatedTests,
        goldenTests
      );

      // Should cover at least 50% of golden categories
      expect(
        coveragePercent,
        `Missing categories: ${missing.join(', ')}`
      ).toBeGreaterThanOrEqual(50);
    });

    it('achieves minimum similarity score against golden', () => {
      const comparison = compareTestSuite(generatedTests, goldenTests);

      // Average similarity should be at least 40%
      expect(
        comparison.averageScore,
        getComparisonSummary(comparison)
      ).toBeGreaterThanOrEqual(0.4);
    });

    it('covers majority of golden tests', () => {
      const comparison = compareTestSuite(generatedTests, goldenTests);

      // Should match at least 50% of golden tests
      const coverageRatio =
        comparison.coverageReport.goldenCovered / comparison.totalGolden;

      expect(
        coverageRatio,
        `Only covered ${comparison.coverageReport.goldenCovered}/${comparison.totalGolden} golden tests`
      ).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('category-coverage', () => {
    it('covers security-related golden tests', () => {
      const securityGolden = goldenTests.filter((t) =>
        t.tags.some((tag) => ['security', 'injection', 'sql', 'xss'].includes(tag))
      );

      const securityGenerated = generatedTests.filter((t) =>
        t.tags.some((tag) => ['security', 'injection', 'sql', 'xss'].includes(tag))
      );

      expect(securityGenerated.length).toBeGreaterThanOrEqual(
        Math.min(securityGolden.length, 1)
      );
    });

    it('covers boundary-related golden tests', () => {
      const boundaryGolden = goldenTests.filter((t) =>
        t.tags.some((tag) => ['boundary', 'edge-case'].includes(tag))
      );

      const boundaryGenerated = generatedTests.filter((t) =>
        t.tags.some((tag) => ['boundary', 'edge-case'].includes(tag))
      );

      expect(boundaryGenerated.length).toBeGreaterThanOrEqual(
        Math.min(boundaryGolden.length, 1)
      );
    });

    it('covers validation-related golden tests', () => {
      const validationGolden = goldenTests.filter((t) =>
        t.tags.some((tag) => ['validation', 'missing-field', 'extra-field'].includes(tag))
      );

      const validationGenerated = generatedTests.filter((t) =>
        t.tags.some((tag) => ['validation', 'missing-field', 'extra-field'].includes(tag))
      );

      expect(validationGenerated.length).toBeGreaterThanOrEqual(
        Math.min(validationGolden.length, 1)
      );
    });
  });

  describe('comparison-report', () => {
    it('generates readable comparison summary', () => {
      const comparison = compareTestSuite(generatedTests, goldenTests);
      const summary = getComparisonSummary(comparison);

      expect(summary).toContain('Generated:');
      expect(summary).toContain('Golden:');
      expect(summary).toContain('Average similarity:');
    });
  });
});
