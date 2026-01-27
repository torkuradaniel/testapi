/**
 * Evals Configuration
 * Thresholds and settings for evaluation criteria
 */

export const config = {
  // Structure validation thresholds
  structure: {
    requiredFields: ['id', 'name', 'request', 'tags', 'priority', 'run_mode'],
    requiredRequestFields: ['method', 'path'],
    validMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    validPriorities: ['high', 'medium', 'low'],
    validRunModes: ['auto', 'manual'],
  },

  // Quality thresholds
  quality: {
    minTestNameLength: 10,
    minTagDiversity: 3, // Minimum unique tags across tests
    minUniqueScenarios: 0.8, // 80% of tests should be unique
  },

  // Edge case coverage requirements
  coverage: {
    minBoundaryTests: 2,
    minTypeVariationTests: 2,
    minEmptyValueTests: 2,
    minInjectionTests: 2,
    minMissingFieldTests: 1,
  },

  // Intent alignment thresholds
  intent: {
    userRequestedCount: 3, // First N tests should be user_requested
    minKeywordMatchScore: 0.5, // At least 50% keyword match
  },

  // Security test patterns
  security: {
    sqlInjectionPatterns: [
      "' OR '1'='1",
      "'; DROP TABLE",
      "1; SELECT * FROM",
      "UNION SELECT",
      "' OR 1=1--",
    ],
    xssPatterns: [
      '<script>',
      'javascript:',
      'onerror=',
      '<img src=x onerror',
      '"><script>',
    ],
    commandInjectionPatterns: [
      '; ls',
      '| cat /etc/passwd',
      '$(whoami)',
      '`id`',
      '&& rm -rf',
    ],
  },

  // Edge case test patterns
  edgeCases: {
    emptyValues: ['', '""', '[]', '{}', 'null', 'undefined'],
    boundaryNumbers: ['0', '-1', 'Number.MAX_SAFE_INTEGER', 'Infinity', 'NaN'],
    typeCoercion: ['"123"', '123', 'true', '"true"', 'false', '"false"'],
    specialChars: ['\\u0000', '\\n', '\\t', '\\r', 'emoji', 'unicode'],
  },

  // Live API settings
  live: {
    defaultModel: 'gpt-4o-mini',
    supportedModels: [
      'gpt-4o-mini',
      'gpt-4o',
      'gpt-4-turbo',
      'gpt-3.5-turbo',
      'o1-mini',
      'o1-preview',
    ],
    defaultTemperature: 0.7,
    timeoutMs: 60000,
    // Minimum thresholds for live evals (more lenient than mocked)
    minCoverageScore: 20,
    minIntentScore: 30,
  },
};

export default config;
