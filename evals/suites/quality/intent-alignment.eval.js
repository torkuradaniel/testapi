/**
 * Intent Alignment Evals
 * Evaluates whether generated tests align with user's natural language pointer
 */

import { describe, it, expect } from 'vitest';
import {
  extractKeywords,
  calculateKeywordMatch,
  checkUserRequestedFlags,
  evaluateIntentAlignment,
} from '../../harness/evaluators/intent.js';
import { getMockResponse } from '../../harness/mocks/openai.js';
import { config } from '../../config.js';
import paymentFixture from '../../fixtures/pointers/payment.json';
import userCrudFixture from '../../fixtures/pointers/user-crud.json';

describe('Intent Alignment Evals', () => {
  const paymentTests = getMockResponse(
    paymentFixture.pointer,
    paymentFixture.requestConfig,
    paymentFixture.count
  ).tests;

  const userTests = getMockResponse(
    userCrudFixture.pointer,
    userCrudFixture.requestConfig,
    userCrudFixture.count
  ).tests;

  describe('keyword-extraction', () => {
    it('extracts meaningful keywords from pointer', () => {
      const keywords = extractKeywords(paymentFixture.pointer);
      expect(keywords.length).toBeGreaterThan(0);
      // Should extract 'amount' from "ensure to test when amount is 0"
      expect(keywords).toContain('amount');
    });

    it('filters out stop words', () => {
      const keywords = extractKeywords('ensure to test when the amount is 0');
      expect(keywords).not.toContain('ensure');
      expect(keywords).not.toContain('to');
      expect(keywords).not.toContain('when');
      expect(keywords).not.toContain('the');
      expect(keywords).not.toContain('is');
    });

    it('handles empty or null input', () => {
      expect(extractKeywords('')).toEqual([]);
      expect(extractKeywords(null)).toEqual([]);
      expect(extractKeywords(undefined)).toEqual([]);
    });
  });

  describe('first-three-match-pointer', () => {
    it('first 3 tests directly address user pointer', () => {
      const evaluation = evaluateIntentAlignment(paymentFixture.pointer, paymentTests);

      expect(
        evaluation.userRequestedTests.meetsThreshold,
        `Alignment score: ${(evaluation.userRequestedTests.alignmentScore * 100).toFixed(1)}%`
      ).toBe(true);
    });

    it('first tests have higher keyword match than later tests', () => {
      const keywords = extractKeywords(paymentFixture.pointer);
      const firstThreeScore = paymentTests
        .slice(0, 3)
        .reduce((sum, test) => sum + calculateKeywordMatch(keywords, test).score, 0) / 3;

      // First 3 should align with pointer
      expect(firstThreeScore).toBeGreaterThanOrEqual(config.intent.minKeywordMatchScore);
    });
  });

  describe('pointer-keywords-in-tests', () => {
    it('user keywords appear in test names or tags', () => {
      const keywords = extractKeywords(paymentFixture.pointer);
      const firstThree = paymentTests.slice(0, 3);

      let matchCount = 0;
      for (const test of firstThree) {
        const match = calculateKeywordMatch(keywords, test);
        if (match.matchedKeywords.length > 0) {
          matchCount++;
        }
      }

      // At least 2 of first 3 should match keywords
      expect(matchCount).toBeGreaterThanOrEqual(2);
    });

    it('reports unmatched keywords', () => {
      const keywords = ['nonexistent', 'random', 'keywords'];
      const match = calculateKeywordMatch(keywords, paymentTests[0]);

      expect(match.unmatchedKeywords.length).toBe(3);
    });
  });

  describe('user-requested-flag-set', () => {
    it('first 3 tests have user_requested: true', () => {
      const flagCheck = checkUserRequestedFlags(paymentTests);

      expect(
        flagCheck.valid,
        `Issues: ${flagCheck.details.join('; ')}`
      ).toBe(true);
      expect(flagCheck.actual).toBe(config.intent.userRequestedCount);
    });

    it('tests beyond first 3 do not have user_requested flag', () => {
      const laterTests = paymentTests.slice(3);
      const userRequestedLater = laterTests.filter((t) => t.user_requested === true);

      expect(userRequestedLater.length).toBe(0);
    });
  });

  describe('remaining-are-exploratory', () => {
    it('tests after first 3 explore beyond pointer', () => {
      const evaluation = evaluateIntentAlignment(paymentFixture.pointer, paymentTests);

      expect(evaluation.exploratoryTests.testsCount).toBe(paymentTests.length - 3);
      expect(evaluation.exploratoryTests.valid).toBe(true);
    });

    it('exploratory tests cover different categories', () => {
      const exploratoryTests = paymentTests.slice(3);
      const tags = exploratoryTests.flatMap((t) => t.tags);
      const uniqueTags = new Set(tags);

      // Should have diverse tags in exploratory tests
      expect(uniqueTags.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('overall-intent-alignment', () => {
    it('payment pointer produces aligned tests', () => {
      const evaluation = evaluateIntentAlignment(paymentFixture.pointer, paymentTests);
      expect(evaluation.overallValid).toBe(true);
    });

    it('user CRUD pointer produces aligned tests', () => {
      const evaluation = evaluateIntentAlignment(userCrudFixture.pointer, userTests);
      expect(evaluation.overallValid).toBe(true);
    });
  });

  describe('alignment-scoring', () => {
    it('perfect match gives score of 1', () => {
      const keywords = ['test', 'payment'];
      const testWithAllKeywords = {
        name: 'Test payment scenario',
        tags: ['test', 'payment'],
        request: { body: {} },
      };

      const match = calculateKeywordMatch(keywords, testWithAllKeywords);
      expect(match.score).toBe(1);
    });

    it('no match gives score of 0', () => {
      const keywords = ['completely', 'different'];
      const testWithNoKeywords = {
        name: 'unrelated test',
        tags: ['other'],
        request: { body: {} },
      };

      const match = calculateKeywordMatch(keywords, testWithNoKeywords);
      expect(match.score).toBe(0);
    });

    it('partial match gives intermediate score', () => {
      const keywords = ['test', 'payment', 'amount'];
      const testWithSomeKeywords = {
        name: 'Test something else',
        tags: ['test'],
        request: { body: {} },
      };

      const match = calculateKeywordMatch(keywords, testWithSomeKeywords);
      expect(match.score).toBeGreaterThan(0);
      expect(match.score).toBeLessThan(1);
    });
  });
});
