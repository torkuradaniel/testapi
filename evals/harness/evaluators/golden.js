/**
 * Golden Output Evaluator
 * Compares AI-generated tests against known-good "golden" outputs
 */

/**
 * Calculate similarity between two test objects
 * @param {Object} generated - AI-generated test
 * @param {Object} golden - Golden reference test
 * @returns {{ score: number, matches: string[], mismatches: string[] }}
 */
export function compareTest(generated, golden) {
  const matches = [];
  const mismatches = [];

  // Compare method
  if (generated.request?.method === golden.request?.method) {
    matches.push('method');
  } else {
    mismatches.push(`method: got "${generated.request?.method}", expected "${golden.request?.method}"`);
  }

  // Compare path
  if (generated.request?.path === golden.request?.path) {
    matches.push('path');
  } else {
    mismatches.push(`path: got "${generated.request?.path}", expected "${golden.request?.path}"`);
  }

  // Compare priority
  if (generated.priority === golden.priority) {
    matches.push('priority');
  } else {
    mismatches.push(`priority: got "${generated.priority}", expected "${golden.priority}"`);
  }

  // Compare user_requested flag
  if (generated.user_requested === golden.user_requested) {
    matches.push('user_requested');
  } else {
    mismatches.push(`user_requested: got ${generated.user_requested}, expected ${golden.user_requested}`);
  }

  // Compare tags (check for overlap)
  const genTags = new Set(generated.tags || []);
  const goldenTags = new Set(golden.tags || []);
  const commonTags = [...genTags].filter((t) => goldenTags.has(t));
  const tagOverlap = goldenTags.size > 0 ? commonTags.length / goldenTags.size : 0;

  if (tagOverlap >= 0.5) {
    matches.push('tags');
  } else {
    mismatches.push(`tags: ${Math.round(tagOverlap * 100)}% overlap`);
  }

  // Compare body structure (keys present)
  const genBodyKeys = Object.keys(generated.request?.body || {});
  const goldenBodyKeys = Object.keys(golden.request?.body || {});
  const bodyKeysMatch = goldenBodyKeys.every((k) => genBodyKeys.includes(k));

  if (bodyKeysMatch) {
    matches.push('body_structure');
  } else {
    const missing = goldenBodyKeys.filter((k) => !genBodyKeys.includes(k));
    mismatches.push(`body_structure: missing keys [${missing.join(', ')}]`);
  }

  const totalChecks = matches.length + mismatches.length;
  const score = totalChecks > 0 ? matches.length / totalChecks : 0;

  return { score, matches, mismatches };
}

/**
 * Find the best matching golden test for a generated test
 * @param {Object} generated - AI-generated test
 * @param {Array} goldenTests - Array of golden reference tests
 * @returns {{ bestMatch: Object|null, score: number, comparison: Object }}
 */
export function findBestMatch(generated, goldenTests) {
  let bestMatch = null;
  let bestScore = 0;
  let bestComparison = null;

  for (const golden of goldenTests) {
    const comparison = compareTest(generated, golden);
    if (comparison.score > bestScore) {
      bestScore = comparison.score;
      bestMatch = golden;
      bestComparison = comparison;
    }
  }

  return { bestMatch, score: bestScore, comparison: bestComparison };
}

/**
 * Compare a full test suite against golden outputs
 * @param {Array} generatedTests - AI-generated tests
 * @param {Array} goldenTests - Golden reference tests
 * @returns {Object} Comparison report
 */
export function compareTestSuite(generatedTests, goldenTests) {
  const results = {
    totalGenerated: generatedTests.length,
    totalGolden: goldenTests.length,
    matches: [],
    averageScore: 0,
    coverageReport: {
      goldenCovered: 0,
      goldenMissed: [],
    },
  };

  // Track which golden tests have been matched
  const matchedGoldenIndices = new Set();

  // For each generated test, find best golden match
  for (const generated of generatedTests) {
    const { bestMatch, score, comparison } = findBestMatch(generated, goldenTests);

    if (bestMatch) {
      const goldenIndex = goldenTests.indexOf(bestMatch);
      matchedGoldenIndices.add(goldenIndex);

      results.matches.push({
        generated: generated.name,
        golden: bestMatch.name,
        score,
        matches: comparison.matches,
        mismatches: comparison.mismatches,
      });
    }
  }

  // Calculate average score
  if (results.matches.length > 0) {
    results.averageScore =
      results.matches.reduce((sum, m) => sum + m.score, 0) / results.matches.length;
  }

  // Find unmatched golden tests
  results.coverageReport.goldenCovered = matchedGoldenIndices.size;
  results.coverageReport.goldenMissed = goldenTests
    .filter((_, i) => !matchedGoldenIndices.has(i))
    .map((t) => t.name);

  return results;
}

/**
 * Check if generated tests cover specific golden test categories
 * @param {Array} generatedTests - AI-generated tests
 * @param {Array} goldenTests - Golden reference tests
 * @returns {{ covered: string[], missing: string[], coveragePercent: number }}
 */
export function checkCategoryCoverage(generatedTests, goldenTests) {
  // Extract categories from golden tests (based on tags)
  const goldenCategories = new Map();
  for (const golden of goldenTests) {
    for (const tag of golden.tags || []) {
      if (!goldenCategories.has(tag)) {
        goldenCategories.set(tag, []);
      }
      goldenCategories.get(tag).push(golden.name);
    }
  }

  // Check which categories are covered by generated tests
  const generatedTags = new Set(generatedTests.flatMap((t) => t.tags || []));

  const covered = [];
  const missing = [];

  for (const [category] of goldenCategories) {
    if (generatedTags.has(category)) {
      covered.push(category);
    } else {
      missing.push(category);
    }
  }

  const coveragePercent =
    goldenCategories.size > 0 ? (covered.length / goldenCategories.size) * 100 : 100;

  return { covered, missing, coveragePercent };
}

/**
 * Generate a human-readable comparison summary
 * @param {Object} comparison - Result from compareTestSuite
 * @returns {string}
 */
export function getComparisonSummary(comparison) {
  const lines = [
    `Generated: ${comparison.totalGenerated} tests`,
    `Golden: ${comparison.totalGolden} tests`,
    `Average similarity: ${(comparison.averageScore * 100).toFixed(1)}%`,
    `Golden coverage: ${comparison.coverageReport.goldenCovered}/${comparison.totalGolden}`,
  ];

  if (comparison.coverageReport.goldenMissed.length > 0) {
    lines.push(`Missing golden tests: ${comparison.coverageReport.goldenMissed.join(', ')}`);
  }

  return lines.join('\n');
}
