/**
 * Coverage Evaluator
 * Analyzes test suites for edge case coverage and diversity
 */

import { config } from '../../config.js';

/**
 * Analyze edge case coverage in generated tests
 * @param {Array} tests - Array of test objects
 * @returns {Object} Coverage report with categories and gaps
 */
export function analyzeCoverage(tests) {
  const coverage = {
    emptyValues: { found: [], count: 0, required: config.coverage.minEmptyValueTests },
    boundaryNumbers: { found: [], count: 0, required: config.coverage.minBoundaryTests },
    typeVariations: { found: [], count: 0, required: config.coverage.minTypeVariationTests },
    injectionTests: { found: [], count: 0, required: config.coverage.minInjectionTests },
    missingFields: { found: [], count: 0, required: config.coverage.minMissingFieldTests },
    extraFields: { found: [], count: 0, required: 1 },
  };

  for (const test of tests) {
    const testStr = JSON.stringify(test).toLowerCase();
    const testName = test.name.toLowerCase();
    const tags = test.tags.map((t) => t.toLowerCase());

    // Check for empty value tests
    if (
      testStr.includes('empty') ||
      testStr.includes('null') ||
      testStr.includes('undefined') ||
      testStr.includes('""') ||
      testStr.includes('[]') ||
      testStr.includes('{}') ||
      tags.some((t) => t.includes('empty') || t.includes('null'))
    ) {
      coverage.emptyValues.found.push(test.name);
      coverage.emptyValues.count++;
    }

    // Check for boundary number tests
    if (
      testName.includes('zero') ||
      testName.includes('0') ||
      testName.includes('negative') ||
      testName.includes('-1') ||
      testName.includes('max') ||
      testName.includes('min') ||
      testName.includes('boundary') ||
      testName.includes('limit') ||
      tags.some((t) => t.includes('boundary') || t.includes('edge'))
    ) {
      coverage.boundaryNumbers.found.push(test.name);
      coverage.boundaryNumbers.count++;
    }

    // Check for type variation tests
    if (
      testName.includes('type') ||
      testName.includes('string') ||
      testName.includes('number') ||
      testName.includes('boolean') ||
      testName.includes('array') ||
      testName.includes('object') ||
      tags.some((t) => t.includes('type'))
    ) {
      coverage.typeVariations.found.push(test.name);
      coverage.typeVariations.count++;
    }

    // Check for injection tests
    if (
      testName.includes('injection') ||
      testName.includes('sql') ||
      testName.includes('xss') ||
      testName.includes('command') ||
      testName.includes('script') ||
      tags.some((t) => t.includes('security') || t.includes('injection'))
    ) {
      coverage.injectionTests.found.push(test.name);
      coverage.injectionTests.count++;
    }

    // Check for missing field tests
    if (
      testName.includes('missing') ||
      testName.includes('omit') ||
      testName.includes('without') ||
      testName.includes('absent') ||
      tags.some((t) => t.includes('missing') || t.includes('required'))
    ) {
      coverage.missingFields.found.push(test.name);
      coverage.missingFields.count++;
    }

    // Check for extra field tests
    if (
      testName.includes('extra') ||
      testName.includes('additional') ||
      testName.includes('unknown') ||
      testName.includes('unexpected') ||
      tags.some((t) => t.includes('extra'))
    ) {
      coverage.extraFields.found.push(test.name);
      coverage.extraFields.count++;
    }
  }

  return coverage;
}

/**
 * Calculate coverage score
 * @param {Object} coverage - Coverage report from analyzeCoverage
 * @returns {{ score: number, passed: number, total: number, gaps: string[] }}
 */
export function calculateCoverageScore(coverage) {
  const categories = Object.keys(coverage);
  let passed = 0;
  const gaps = [];

  for (const category of categories) {
    const cat = coverage[category];
    if (cat.count >= cat.required) {
      passed++;
    } else {
      gaps.push(
        `${category}: found ${cat.count}, required ${cat.required}`
      );
    }
  }

  return {
    score: (passed / categories.length) * 100,
    passed,
    total: categories.length,
    gaps,
  };
}

/**
 * Analyze tag diversity in tests
 * @param {Array} tests - Array of test objects
 * @returns {{ uniqueTags: string[], diversity: number, meetsThreshold: boolean }}
 */
export function analyzeTagDiversity(tests) {
  const allTags = tests.flatMap((t) => t.tags || []);
  const uniqueTags = [...new Set(allTags)];

  return {
    uniqueTags,
    diversity: uniqueTags.length,
    meetsThreshold: uniqueTags.length >= config.quality.minTagDiversity,
  };
}

/**
 * Check if tests cover different scenarios (no duplicates)
 * @param {Array} tests - Array of test objects
 * @returns {{ uniqueCount: number, totalCount: number, duplicates: string[], isUnique: boolean }}
 */
export function checkUniqueness(tests) {
  const names = tests.map((t) => t.name);
  const bodies = tests.map((t) => JSON.stringify(t.request.body));

  const uniqueNames = new Set(names);
  const uniqueBodies = new Set(bodies);

  const duplicateNames = names.filter(
    (name, index) => names.indexOf(name) !== index
  );

  return {
    uniqueCount: uniqueNames.size,
    totalCount: tests.length,
    duplicates: [...new Set(duplicateNames)],
    isUnique: uniqueNames.size === tests.length && uniqueBodies.size === tests.length,
  };
}

/**
 * Analyze scenario diversity beyond just names
 * @param {Array} tests - Array of test objects
 * @returns {Object} Scenario analysis
 */
export function analyzeScenarioDiversity(tests) {
  const scenarios = {
    methods: new Set(),
    statusTargets: new Set(),
    bodyPatterns: new Set(),
    headerVariations: new Set(),
  };

  for (const test of tests) {
    scenarios.methods.add(test.request.method);

    // Analyze body patterns
    const body = test.request.body;
    if (body) {
      const bodyStr = JSON.stringify(body);
      if (bodyStr.includes('null')) scenarios.bodyPatterns.add('null-values');
      if (bodyStr.includes('""')) scenarios.bodyPatterns.add('empty-strings');
      if (bodyStr.includes('[]')) scenarios.bodyPatterns.add('empty-arrays');
      if (bodyStr.includes('{}')) scenarios.bodyPatterns.add('empty-objects');
      if (/\d{10,}/.test(bodyStr)) scenarios.bodyPatterns.add('large-numbers');
      if (/-\d+/.test(bodyStr)) scenarios.bodyPatterns.add('negative-numbers');
    }

    // Analyze header variations
    const headers = test.request.headers;
    if (headers) {
      Object.keys(headers).forEach((h) =>
        scenarios.headerVariations.add(h.toLowerCase())
      );
    }
  }

  return {
    methodsCovered: [...scenarios.methods],
    bodyPatternsCovered: [...scenarios.bodyPatterns],
    headerVariationsCovered: [...scenarios.headerVariations],
    totalDiversityScore:
      scenarios.methods.size +
      scenarios.bodyPatterns.size +
      scenarios.headerVariations.size,
  };
}
