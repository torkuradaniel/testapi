/**
 * Structure Correctness Evals
 * Validates that generated tests have correct structure and required fields
 */

import { describe, it, expect } from 'vitest';
import {
  validateTest,
  validateTests,
  checkRequiredFields,
  isValidMethod,
  validatePath,
  validateHeaders,
  validateBody,
} from '../../harness/evaluators/structure.js';
import { getMockResponse } from '../../harness/mocks/openai.js';
import paymentFixture from '../../fixtures/pointers/payment.json';
import goldenOutput from '../../fixtures/golden-outputs/payment-tests.json';

describe('Structure Correctness Evals', () => {
  // Generate mock tests for evaluation
  const mockResponse = getMockResponse(
    paymentFixture.pointer,
    paymentFixture.requestConfig,
    paymentFixture.count
  );
  const generatedTests = mockResponse.tests;

  describe('test-has-required-fields', () => {
    it('every test has id, name, request, tags, priority, run_mode', () => {
      for (const test of generatedTests) {
        const { hasAllFields, missingFields } = checkRequiredFields(test);
        expect(hasAllFields, `Missing fields: ${missingFields.join(', ')}`).toBe(true);
      }
    });

    it('validates against golden output structure', () => {
      for (const test of goldenOutput.tests) {
        const { hasAllFields, missingFields } = checkRequiredFields(test);
        expect(hasAllFields, `Golden test missing: ${missingFields.join(', ')}`).toBe(true);
      }
    });
  });

  describe('request-has-valid-method', () => {
    it('HTTP method is GET/POST/PUT/PATCH/DELETE', () => {
      for (const test of generatedTests) {
        expect(isValidMethod(test.request.method)).toBe(true);
      }
    });

    it('rejects invalid HTTP methods', () => {
      expect(isValidMethod('INVALID')).toBe(false);
      expect(isValidMethod('OPTIONS')).toBe(false);
      expect(isValidMethod('')).toBe(false);
    });
  });

  describe('request-has-valid-path', () => {
    it('path starts with / and is well-formed', () => {
      for (const test of generatedTests) {
        const result = validatePath(test.request.path);
        expect(result.valid, result.reason).toBe(true);
      }
    });

    it('rejects invalid paths', () => {
      expect(validatePath('invalid').valid).toBe(false);
      expect(validatePath('').valid).toBe(false);
      expect(validatePath(null).valid).toBe(false);
    });

    it('accepts paths with parameters', () => {
      expect(validatePath('/users/:id').valid).toBe(true);
      expect(validatePath('/api/v1/items/{itemId}').valid).toBe(true);
      expect(validatePath('/search?q=test').valid).toBe(true);
    });
  });

  describe('headers-are-valid', () => {
    it('headers object has string key-value pairs', () => {
      for (const test of generatedTests) {
        if (test.request.headers) {
          const result = validateHeaders(test.request.headers);
          expect(
            result.valid,
            `Invalid headers: ${result.invalidHeaders.join(', ')}`
          ).toBe(true);
        }
      }
    });

    it('rejects non-string header values', () => {
      const invalidHeaders = { 'Content-Type': 123 };
      const result = validateHeaders(invalidHeaders);
      expect(result.valid).toBe(false);
      expect(result.invalidHeaders).toContain('Content-Type');
    });
  });

  describe('body-is-valid-json', () => {
    it('body (if present) is JSON serializable', () => {
      for (const test of generatedTests) {
        if (test.request.body !== undefined) {
          const result = validateBody(test.request.body);
          expect(result.valid, result.reason).toBe(true);
        }
      }
    });

    it('handles various body types', () => {
      expect(validateBody({ key: 'value' }).valid).toBe(true);
      expect(validateBody([1, 2, 3]).valid).toBe(true);
      expect(validateBody('string').valid).toBe(true);
      expect(validateBody(null).valid).toBe(true);
      expect(validateBody(undefined).valid).toBe(true);
    });
  });

  describe('priority-is-valid', () => {
    it('priority is high/medium/low', () => {
      const validPriorities = ['high', 'medium', 'low'];
      for (const test of generatedTests) {
        expect(validPriorities).toContain(test.priority);
      }
    });
  });

  describe('run-mode-is-valid', () => {
    it('run_mode is auto/manual', () => {
      const validModes = ['auto', 'manual'];
      for (const test of generatedTests) {
        expect(validModes).toContain(test.run_mode);
      }
    });
  });

  describe('full-schema-validation', () => {
    it('all generated tests pass full schema validation', () => {
      const result = validateTests(generatedTests);
      expect(result.valid, `Errors: ${result.errors.join('; ')}`).toBe(true);
      expect(result.validCount).toBe(generatedTests.length);
      expect(result.invalidCount).toBe(0);
    });

    it('golden output passes full schema validation', () => {
      const result = validateTests(goldenOutput.tests);
      expect(result.valid, `Errors: ${result.errors.join('; ')}`).toBe(true);
    });
  });

  describe('id-uniqueness', () => {
    it('all test IDs are unique', () => {
      const ids = generatedTests.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('IDs are valid UUIDs', () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (const test of generatedTests) {
        expect(test.id).toMatch(uuidRegex);
      }
    });
  });
});
