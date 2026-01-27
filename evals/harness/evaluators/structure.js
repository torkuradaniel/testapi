/**
 * Structure Evaluator
 * Validates test objects against expected schema
 * Uses manual validation for better control and compatibility
 */

import { config } from '../../config.js';

/**
 * Validate a single test object
 * @param {Object} test - Test object to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTest(test) {
  const errors = [];

  // Check required fields
  if (!test.id || typeof test.id !== 'string') {
    errors.push('id: must be a non-empty string');
  } else {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(test.id)) {
      errors.push('id: must be a valid UUID');
    }
  }

  if (!test.name || typeof test.name !== 'string' || test.name.length < 1) {
    errors.push('name: must be a non-empty string');
  }

  if (!test.request || typeof test.request !== 'object') {
    errors.push('request: must be an object');
  } else {
    if (!config.structure.validMethods.includes(test.request.method)) {
      errors.push(`request.method: must be one of ${config.structure.validMethods.join(', ')}`);
    }
    if (!test.request.path || typeof test.request.path !== 'string' || test.request.path.length < 1) {
      errors.push('request.path: must be a non-empty string');
    }
    if (test.request.headers !== undefined && typeof test.request.headers !== 'object') {
      errors.push('request.headers: must be an object if provided');
    }
  }

  if (!Array.isArray(test.tags)) {
    errors.push('tags: must be an array');
  } else if (!test.tags.every((t) => typeof t === 'string')) {
    errors.push('tags: all elements must be strings');
  }

  if (!config.structure.validPriorities.includes(test.priority)) {
    errors.push(`priority: must be one of ${config.structure.validPriorities.join(', ')}`);
  }

  if (!config.structure.validRunModes.includes(test.run_mode)) {
    errors.push(`run_mode: must be one of ${config.structure.validRunModes.join(', ')}`);
  }

  if (test.user_requested !== undefined && typeof test.user_requested !== 'boolean') {
    errors.push('user_requested: must be a boolean if provided');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate an array of tests
 * @param {Array} tests - Array of test objects
 * @returns {{ valid: boolean, errors: string[], validCount: number, invalidCount: number }}
 */
export function validateTests(tests) {
  const results = tests.map((test, index) => ({
    index,
    ...validateTest(test),
  }));

  const invalidTests = results.filter((r) => !r.valid);

  return {
    valid: invalidTests.length === 0,
    errors: invalidTests.flatMap((t) =>
      t.errors.map((e) => `Test ${t.index}: ${e}`)
    ),
    validCount: results.filter((r) => r.valid).length,
    invalidCount: invalidTests.length,
  };
}

/**
 * Check if test has all required fields
 * @param {Object} test - Test object
 * @returns {{ hasAllFields: boolean, missingFields: string[] }}
 */
export function checkRequiredFields(test) {
  const missingFields = config.structure.requiredFields.filter(
    (field) => !(field in test)
  );
  return {
    hasAllFields: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Validate HTTP method
 * @param {string} method - HTTP method
 * @returns {boolean}
 */
export function isValidMethod(method) {
  return config.structure.validMethods.includes(method);
}

/**
 * Validate request path format
 * @param {string} path - Request path
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validatePath(path) {
  if (!path || typeof path !== 'string') {
    return { valid: false, reason: 'Path must be a non-empty string' };
  }
  if (!path.startsWith('/')) {
    return { valid: false, reason: 'Path must start with /' };
  }
  // Check for valid path characters
  const validPathRegex = /^\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%{}]*$/;
  if (!validPathRegex.test(path)) {
    return { valid: false, reason: 'Path contains invalid characters' };
  }
  return { valid: true };
}

/**
 * Validate headers object
 * @param {Object} headers - Headers object
 * @returns {{ valid: boolean, invalidHeaders: string[] }}
 */
export function validateHeaders(headers) {
  if (!headers || typeof headers !== 'object') {
    return { valid: true, invalidHeaders: [] }; // Headers are optional
  }

  const invalidHeaders = Object.entries(headers)
    .filter(([, value]) => typeof value !== 'string')
    .map(([key]) => key);

  return {
    valid: invalidHeaders.length === 0,
    invalidHeaders,
  };
}

/**
 * Validate that body is serializable to JSON
 * @param {any} body - Request body
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateBody(body) {
  if (body === undefined || body === null) {
    return { valid: true };
  }

  try {
    JSON.stringify(body);
    return { valid: true };
  } catch (e) {
    return { valid: false, reason: 'Body is not JSON serializable' };
  }
}

// Schema exports removed - using manual validation instead of Zod
