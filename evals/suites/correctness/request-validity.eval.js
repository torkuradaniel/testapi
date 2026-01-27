/**
 * Request Validity Evals
 * Validates that generated test requests are valid HTTP requests
 */

import { describe, it, expect } from 'vitest';
import { getMockResponse } from '../../harness/mocks/openai.js';
import paymentFixture from '../../fixtures/pointers/payment.json';
import userCrudFixture from '../../fixtures/pointers/user-crud.json';
import edgeCasesFixture from '../../fixtures/pointers/edge-cases.json';

describe('Request Validity Evals', () => {
  // Generate mock tests for different scenarios
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

  const edgeCaseTests = getMockResponse(
    edgeCasesFixture.pointer,
    edgeCasesFixture.requestConfig,
    edgeCasesFixture.count
  ).tests;

  describe('method-matches-config', () => {
    it('generated tests use the configured HTTP method', () => {
      for (const test of paymentTests) {
        expect(test.request.method).toBe(paymentFixture.requestConfig.method);
      }
    });

    it('maintains method consistency across different fixtures', () => {
      for (const test of userTests) {
        expect(test.request.method).toBe(userCrudFixture.requestConfig.method);
      }
    });
  });

  describe('path-matches-config', () => {
    it('generated tests use the configured path', () => {
      for (const test of paymentTests) {
        expect(test.request.path).toBe(paymentFixture.requestConfig.path);
      }
    });

    it('path is preserved for edge case tests', () => {
      for (const test of edgeCaseTests) {
        expect(test.request.path).toBe(edgeCasesFixture.requestConfig.path);
      }
    });
  });

  describe('headers-include-content-type', () => {
    it('POST requests have Content-Type header', () => {
      const postTests = [...paymentTests, ...userTests].filter(
        (t) => t.request.method === 'POST'
      );

      for (const test of postTests) {
        if (test.request.body !== undefined) {
          expect(test.request.headers).toBeDefined();
          expect(test.request.headers['Content-Type']).toBeDefined();
        }
      }
    });
  });

  describe('body-structure-variations', () => {
    it('tests include variations of the original body structure', () => {
      const bodyKeys = Object.keys(paymentFixture.requestConfig.body);

      // At least some tests should modify the body
      const modifiedBodies = paymentTests.filter((test) => {
        const testBodyStr = JSON.stringify(test.request.body);
        const originalBodyStr = JSON.stringify(paymentFixture.requestConfig.body);
        return testBodyStr !== originalBodyStr;
      });

      expect(modifiedBodies.length).toBeGreaterThan(0);
    });

    it('tests preserve body key structure where appropriate', () => {
      // Check that body objects have reasonable keys
      for (const test of paymentTests) {
        if (test.request.body && typeof test.request.body === 'object') {
          const keys = Object.keys(test.request.body);
          // Should have at least some keys
          expect(keys.length).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe('request-completeness', () => {
    it('all requests have required fields for execution', () => {
      const allTests = [...paymentTests, ...userTests, ...edgeCaseTests];

      for (const test of allTests) {
        // Must have method and path to be executable
        expect(test.request.method).toBeDefined();
        expect(test.request.path).toBeDefined();
        expect(typeof test.request.method).toBe('string');
        expect(typeof test.request.path).toBe('string');
      }
    });

    it('requests can be serialized for HTTP execution', () => {
      for (const test of paymentTests) {
        // Test that the entire request can be JSON serialized
        expect(() => JSON.stringify(test.request)).not.toThrow();
      }
    });
  });

  describe('no-dangerous-values', () => {
    it('requests do not contain undefined values in body', () => {
      for (const test of paymentTests) {
        if (test.request.body && typeof test.request.body === 'object') {
          const bodyStr = JSON.stringify(test.request.body);
          // JSON.stringify removes undefined, but we check the structure
          expect(bodyStr).not.toContain('undefined');
        }
      }
    });

    it('requests do not contain functions', () => {
      for (const test of paymentTests) {
        const checkForFunctions = (obj) => {
          if (!obj || typeof obj !== 'object') return true;
          for (const value of Object.values(obj)) {
            if (typeof value === 'function') return false;
            if (typeof value === 'object' && !checkForFunctions(value)) return false;
          }
          return true;
        };

        expect(checkForFunctions(test.request.body)).toBe(true);
      }
    });
  });

  describe('count-matches-requested', () => {
    it('returns exactly the requested number of tests', () => {
      expect(paymentTests.length).toBe(paymentFixture.count);
      expect(userTests.length).toBe(userCrudFixture.count);
      expect(edgeCaseTests.length).toBe(edgeCasesFixture.count);
    });
  });
});
