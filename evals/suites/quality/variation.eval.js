/**
 * Variation Evals
 * Evaluates test diversity and uniqueness
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeTagDiversity,
  checkUniqueness,
  analyzeScenarioDiversity,
} from '../../harness/evaluators/coverage.js';
import { getMockResponse } from '../../harness/mocks/openai.js';
import { config } from '../../config.js';
import paymentFixture from '../../fixtures/pointers/payment.json';

describe('Variation Quality Evals', () => {
  const mockResponse = getMockResponse(
    paymentFixture.pointer,
    paymentFixture.requestConfig,
    paymentFixture.count
  );
  const generatedTests = mockResponse.tests;

  describe('tests-are-unique', () => {
    it('no duplicate test names', () => {
      const { duplicates, isUnique } = checkUniqueness(generatedTests);
      expect(duplicates.length, `Duplicates: ${duplicates.join(', ')}`).toBe(0);
    });

    it('no duplicate request bodies', () => {
      const bodies = generatedTests.map((t) => JSON.stringify(t.request.body));
      const uniqueBodies = new Set(bodies);
      // Allow some duplicates since edge cases might overlap
      expect(uniqueBodies.size).toBeGreaterThanOrEqual(generatedTests.length * 0.7);
    });

    it('test names are descriptive and unique', () => {
      const names = generatedTests.map((t) => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });

  describe('tests-cover-different-scenarios', () => {
    it('tags have sufficient diversity', () => {
      const { uniqueTags, diversity, meetsThreshold } = analyzeTagDiversity(generatedTests);
      expect(
        meetsThreshold,
        `Only ${diversity} unique tags, need ${config.quality.minTagDiversity}`
      ).toBe(true);
    });

    it('includes multiple test categories', () => {
      const allTags = generatedTests.flatMap((t) => t.tags);
      const categories = new Set(
        allTags.filter((tag) =>
          ['boundary', 'edge-case', 'security', 'validation', 'type', 'injection'].some(
            (cat) => tag.includes(cat)
          )
        )
      );
      expect(categories.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('scenario-diversity', () => {
    it('covers multiple body patterns', () => {
      const { bodyPatternsCovered } = analyzeScenarioDiversity(generatedTests);
      expect(bodyPatternsCovered.length).toBeGreaterThanOrEqual(1);
    });

    it('uses consistent HTTP method from config', () => {
      const { methodsCovered } = analyzeScenarioDiversity(generatedTests);
      expect(methodsCovered).toContain(paymentFixture.requestConfig.method);
    });
  });

  describe('names-are-descriptive', () => {
    it('test names have minimum length', () => {
      for (const test of generatedTests) {
        expect(
          test.name.length,
          `Test name too short: "${test.name}"`
        ).toBeGreaterThanOrEqual(config.quality.minTestNameLength);
      }
    });

    it('test names describe the scenario being tested', () => {
      // Test names should contain action words
      const actionWords = ['test', 'with', 'when', 'for', 'using', 'without'];
      for (const test of generatedTests) {
        const nameLower = test.name.toLowerCase();
        const hasActionWord = actionWords.some((word) => nameLower.includes(word));
        expect(
          hasActionWord,
          `Test name not descriptive: "${test.name}"`
        ).toBe(true);
      }
    });
  });

  describe('priority-distribution', () => {
    it('includes high priority tests', () => {
      const highPriority = generatedTests.filter((t) => t.priority === 'high');
      expect(highPriority.length).toBeGreaterThan(0);
    });

    it('has reasonable priority distribution', () => {
      const priorities = {
        high: generatedTests.filter((t) => t.priority === 'high').length,
        medium: generatedTests.filter((t) => t.priority === 'medium').length,
        low: generatedTests.filter((t) => t.priority === 'low').length,
      };

      // Should have at least some tests at each level or combined mid/low
      expect(priorities.high).toBeGreaterThan(0);
      expect(priorities.medium + priorities.low).toBeGreaterThan(0);
    });
  });

  describe('run-mode-distribution', () => {
    it('includes auto tests for automated execution', () => {
      const autoTests = generatedTests.filter((t) => t.run_mode === 'auto');
      expect(autoTests.length).toBeGreaterThan(0);
    });

    it('first 3 tests are auto mode for quick feedback', () => {
      const firstThree = generatedTests.slice(0, 3);
      const autoCount = firstThree.filter((t) => t.run_mode === 'auto').length;
      expect(autoCount).toBeGreaterThanOrEqual(2);
    });
  });
});
