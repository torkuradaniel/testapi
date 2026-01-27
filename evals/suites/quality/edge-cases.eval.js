/**
 * Edge Cases Evals
 * Evaluates coverage of edge cases in generated tests
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeCoverage,
  calculateCoverageScore,
} from '../../harness/evaluators/coverage.js';
import { getMockResponse } from '../../harness/mocks/openai.js';
import { config } from '../../config.js';
import paymentFixture from '../../fixtures/pointers/payment.json';
import edgeCasesFixture from '../../fixtures/pointers/edge-cases.json';

describe('Edge Cases Coverage Evals', () => {
  const paymentTests = getMockResponse(
    paymentFixture.pointer,
    paymentFixture.requestConfig,
    paymentFixture.count
  ).tests;

  const edgeCaseTests = getMockResponse(
    edgeCasesFixture.pointer,
    edgeCasesFixture.requestConfig,
    edgeCasesFixture.count
  ).tests;

  describe('includes-boundary-values', () => {
    it('tests include 0, negative, and large values', () => {
      const coverage = analyzeCoverage(paymentTests);
      expect(
        coverage.boundaryNumbers.count,
        `Found boundary tests: ${coverage.boundaryNumbers.found.join(', ')}`
      ).toBeGreaterThanOrEqual(config.coverage.minBoundaryTests);
    });

    it('boundary tests target numeric fields', () => {
      const boundaryIndicators = ['0', 'zero', '-1', 'negative', 'max', 'large', 'boundary'];
      const boundaryTests = paymentTests.filter((test) => {
        const testStr = JSON.stringify(test).toLowerCase();
        return boundaryIndicators.some((indicator) => testStr.includes(indicator));
      });

      expect(boundaryTests.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('includes-empty-values', () => {
    it('tests include empty strings, arrays, objects, or null', () => {
      const coverage = analyzeCoverage(paymentTests);
      expect(
        coverage.emptyValues.count,
        `Found empty value tests: ${coverage.emptyValues.found.join(', ')}`
      ).toBeGreaterThanOrEqual(config.coverage.minEmptyValueTests);
    });
  });

  describe('includes-type-variations', () => {
    it('tests include type coercion scenarios', () => {
      const coverage = analyzeCoverage(paymentTests);
      expect(
        coverage.typeVariations.count,
        `Found type variation tests: ${coverage.typeVariations.found.join(', ')}`
      ).toBeGreaterThanOrEqual(config.coverage.minTypeVariationTests);
    });

    it('includes string-to-number or boolean variations', () => {
      const typeIndicators = ['string', 'type', 'coercion', 'number', 'boolean'];
      const typeTests = paymentTests.filter((test) => {
        const nameLower = test.name.toLowerCase();
        return typeIndicators.some((indicator) => nameLower.includes(indicator));
      });

      // Should have at least one type variation test
      expect(typeTests.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('includes-missing-field-tests', () => {
    it('tests include missing required fields', () => {
      const coverage = analyzeCoverage(paymentTests);
      expect(
        coverage.missingFields.count,
        `Found missing field tests: ${coverage.missingFields.found.join(', ')}`
      ).toBeGreaterThanOrEqual(config.coverage.minMissingFieldTests);
    });

    it('actually omits fields from the body', () => {
      const originalKeys = Object.keys(paymentFixture.requestConfig.body);
      const missingFieldTests = paymentTests.filter((test) => {
        if (!test.request.body || typeof test.request.body !== 'object') return false;
        const testKeys = Object.keys(test.request.body);
        return testKeys.length < originalKeys.length;
      });

      expect(missingFieldTests.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('includes-extra-field-tests', () => {
    it('tests include unexpected extra fields', () => {
      const coverage = analyzeCoverage(paymentTests);
      expect(
        coverage.extraFields.count,
        `Found extra field tests: ${coverage.extraFields.found.join(', ')}`
      ).toBeGreaterThanOrEqual(1);
    });

    it('adds fields not in original body', () => {
      const originalKeys = new Set(Object.keys(paymentFixture.requestConfig.body));
      const extraFieldTests = paymentTests.filter((test) => {
        if (!test.request.body || typeof test.request.body !== 'object') return false;
        const testKeys = Object.keys(test.request.body);
        return testKeys.some((key) => !originalKeys.has(key));
      });

      expect(extraFieldTests.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('overall-coverage-score', () => {
    it('achieves minimum coverage score', () => {
      const coverage = analyzeCoverage(paymentTests);
      const { score, gaps } = calculateCoverageScore(coverage);

      // Require at least 50% coverage score
      expect(
        score,
        `Coverage gaps: ${gaps.join('; ')}`
      ).toBeGreaterThanOrEqual(50);
    });

    it('edge case focused tests achieve higher coverage', () => {
      const coverage = analyzeCoverage(edgeCaseTests);
      const { score } = calculateCoverageScore(coverage);

      // Edge case tests should have good coverage
      expect(score).toBeGreaterThanOrEqual(40);
    });
  });

  describe('coverage-report-details', () => {
    it('coverage report includes found test names', () => {
      const coverage = analyzeCoverage(paymentTests);

      // At least one category should have found tests
      const categoriesWithTests = Object.values(coverage).filter(
        (cat) => cat.found.length > 0
      );

      expect(categoriesWithTests.length).toBeGreaterThan(0);
    });

    it('coverage gaps are identifiable', () => {
      const coverage = analyzeCoverage(paymentTests);
      const { gaps } = calculateCoverageScore(coverage);

      // Gaps should be strings describing what's missing
      for (const gap of gaps) {
        expect(typeof gap).toBe('string');
        expect(gap).toContain(':');
      }
    });
  });
});
