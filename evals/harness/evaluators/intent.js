/**
 * Intent Evaluator
 * Checks if generated tests align with user's natural language pointer
 */

import { config } from '../../config.js';

/**
 * Extract keywords from a natural language pointer
 * @param {string} pointer - User's natural language test pointer
 * @returns {string[]} Array of extracted keywords
 */
export function extractKeywords(pointer) {
  if (!pointer || typeof pointer !== 'string') return [];

  // Common stop words to filter out
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of',
    'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
    'during', 'before', 'after', 'above', 'below', 'between', 'under',
    'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where',
    'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
    'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while',
    'ensure', 'test', 'tests', 'testing', 'check', 'verify', 'make', 'sure',
    'that', 'what', 'this', 'it', 'its',
  ]);

  // Extract words, convert to lowercase, filter stop words
  const words = pointer
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !stopWords.has(word));

  return [...new Set(words)];
}

/**
 * Calculate keyword match score between pointer and test
 * @param {string[]} keywords - Keywords from pointer
 * @param {Object} test - Test object
 * @returns {{ score: number, matchedKeywords: string[], unmatchedKeywords: string[] }}
 */
export function calculateKeywordMatch(keywords, test) {
  if (!keywords.length) {
    return { score: 1, matchedKeywords: [], unmatchedKeywords: [] };
  }

  const testText = [
    test.name,
    ...(test.tags || []),
    JSON.stringify(test.request.body || {}),
  ]
    .join(' ')
    .toLowerCase();

  const matchedKeywords = keywords.filter((kw) => testText.includes(kw));
  const unmatchedKeywords = keywords.filter((kw) => !testText.includes(kw));

  return {
    score: matchedKeywords.length / keywords.length,
    matchedKeywords,
    unmatchedKeywords,
  };
}

/**
 * Check if first N tests are marked as user_requested
 * @param {Array} tests - Array of test objects
 * @param {number} expectedCount - Expected number of user_requested tests
 * @returns {{ valid: boolean, actual: number, expected: number, details: string[] }}
 */
export function checkUserRequestedFlags(tests, expectedCount = config.intent.userRequestedCount) {
  const userRequestedTests = tests.slice(0, expectedCount);
  const results = userRequestedTests.map((test, index) => ({
    index,
    name: test.name,
    hasFlag: test.user_requested === true,
  }));

  const flaggedCount = results.filter((r) => r.hasFlag).length;

  return {
    valid: flaggedCount === expectedCount,
    actual: flaggedCount,
    expected: expectedCount,
    details: results
      .filter((r) => !r.hasFlag)
      .map((r) => `Test ${r.index} "${r.name}" missing user_requested flag`),
  };
}

/**
 * Evaluate overall intent alignment
 * @param {string} pointer - User's natural language pointer
 * @param {Array} tests - Array of generated tests
 * @returns {Object} Intent alignment evaluation result
 */
export function evaluateIntentAlignment(pointer, tests) {
  const keywords = extractKeywords(pointer);
  const userRequestedCount = config.intent.userRequestedCount;

  // Check first N tests for keyword alignment
  const firstTests = tests.slice(0, userRequestedCount);
  const keywordMatches = firstTests.map((test) =>
    calculateKeywordMatch(keywords, test)
  );

  // Calculate average alignment score for first N tests
  const avgAlignmentScore =
    keywordMatches.reduce((sum, m) => sum + m.score, 0) / keywordMatches.length;

  // Check user_requested flags
  const flagCheck = checkUserRequestedFlags(tests, userRequestedCount);

  // Check that remaining tests explore beyond the pointer
  const remainingTests = tests.slice(userRequestedCount);
  const remainingKeywordMatches = remainingTests.map((test) =>
    calculateKeywordMatch(keywords, test)
  );
  const avgRemainingScore =
    remainingKeywordMatches.length > 0
      ? remainingKeywordMatches.reduce((sum, m) => sum + m.score, 0) /
        remainingKeywordMatches.length
      : 0;

  // Remaining tests should be exploratory (lower keyword match is okay)
  const exploratoryCheck = {
    valid: true, // Exploratory tests don't need to match keywords
    score: avgRemainingScore,
    testsCount: remainingTests.length,
  };

  return {
    keywords,
    userRequestedTests: {
      count: userRequestedCount,
      alignmentScore: avgAlignmentScore,
      meetsThreshold: avgAlignmentScore >= config.intent.minKeywordMatchScore,
      details: keywordMatches,
    },
    flagCheck,
    exploratoryTests: exploratoryCheck,
    overallValid:
      flagCheck.valid &&
      avgAlignmentScore >= config.intent.minKeywordMatchScore,
  };
}

/**
 * Get a summary of intent alignment
 * @param {Object} evaluation - Result from evaluateIntentAlignment
 * @returns {string} Human-readable summary
 */
export function getIntentSummary(evaluation) {
  const lines = [
    `Keywords extracted: ${evaluation.keywords.join(', ') || 'none'}`,
    `User-requested tests alignment: ${(evaluation.userRequestedTests.alignmentScore * 100).toFixed(1)}%`,
    `User-requested flags: ${evaluation.flagCheck.actual}/${evaluation.flagCheck.expected}`,
    `Exploratory tests: ${evaluation.exploratoryTests.testsCount}`,
    `Overall valid: ${evaluation.overallValid ? 'YES' : 'NO'}`,
  ];

  if (evaluation.flagCheck.details.length > 0) {
    lines.push(`Issues: ${evaluation.flagCheck.details.join('; ')}`);
  }

  return lines.join('\n');
}
