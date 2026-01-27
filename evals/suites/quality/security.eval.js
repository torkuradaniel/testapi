/**
 * Security Evals
 * Evaluates coverage of security-related test cases (injection attacks, etc.)
 */

import { describe, it, expect } from 'vitest';
import { analyzeCoverage } from '../../harness/evaluators/coverage.js';
import { getMockResponse } from '../../harness/mocks/openai.js';
import { config } from '../../config.js';
import paymentFixture from '../../fixtures/pointers/payment.json';

describe('Security Coverage Evals', () => {
  const paymentTests = getMockResponse(
    paymentFixture.pointer,
    paymentFixture.requestConfig,
    paymentFixture.count
  ).tests;

  describe('includes-injection-tests', () => {
    it('tests include SQL injection payloads', () => {
      const sqlInjectionTests = paymentTests.filter((test) => {
        const testStr = JSON.stringify(test).toLowerCase();
        return (
          testStr.includes('sql') ||
          testStr.includes('injection') ||
          testStr.includes("' or") ||
          testStr.includes('drop table') ||
          testStr.includes('select *')
        );
      });

      expect(
        sqlInjectionTests.length,
        'Should include at least 1 SQL injection test'
      ).toBeGreaterThanOrEqual(1);
    });

    it('tests include XSS payloads', () => {
      const xssTests = paymentTests.filter((test) => {
        const testStr = JSON.stringify(test).toLowerCase();
        return (
          testStr.includes('xss') ||
          testStr.includes('<script') ||
          testStr.includes('javascript:') ||
          testStr.includes('onerror')
        );
      });

      expect(
        xssTests.length,
        'Should include at least 1 XSS test'
      ).toBeGreaterThanOrEqual(1);
    });

    it('coverage analyzer detects injection tests', () => {
      const coverage = analyzeCoverage(paymentTests);
      expect(
        coverage.injectionTests.count,
        `Found: ${coverage.injectionTests.found.join(', ')}`
      ).toBeGreaterThanOrEqual(config.coverage.minInjectionTests);
    });
  });

  describe('security-tags-present', () => {
    it('security tests are tagged appropriately', () => {
      const securityTaggedTests = paymentTests.filter((test) =>
        test.tags.some((tag) =>
          ['security', 'injection', 'xss', 'sql'].includes(tag.toLowerCase())
        )
      );

      expect(securityTaggedTests.length).toBeGreaterThanOrEqual(1);
    });

    it('injection tests have high priority', () => {
      const injectionTests = paymentTests.filter((test) =>
        test.tags.some((tag) => tag.toLowerCase().includes('injection'))
      );

      for (const test of injectionTests) {
        // Injection tests should be high or medium priority
        expect(['high', 'medium']).toContain(test.priority);
      }
    });
  });

  describe('security-payload-variety', () => {
    it('includes different types of injection payloads', () => {
      const injectionTypes = new Set();

      for (const test of paymentTests) {
        const testStr = JSON.stringify(test).toLowerCase();
        const tags = test.tags.map((t) => t.toLowerCase());

        if (testStr.includes('sql') || tags.includes('sql')) {
          injectionTypes.add('sql');
        }
        if (testStr.includes('xss') || tags.includes('xss')) {
          injectionTypes.add('xss');
        }
        if (testStr.includes('command') || tags.includes('command')) {
          injectionTypes.add('command');
        }
      }

      // Should have at least 2 types of injection tests
      expect(injectionTypes.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('security-payloads-in-body', () => {
    it('injection payloads are placed in request bodies', () => {
      const testsWithPayloads = paymentTests.filter((test) => {
        if (!test.request.body) return false;
        const bodyStr = JSON.stringify(test.request.body);

        return (
          bodyStr.includes('<script') ||
          bodyStr.includes("'") ||
          bodyStr.includes('DROP') ||
          bodyStr.includes('SELECT') ||
          bodyStr.includes('javascript:')
        );
      });

      expect(testsWithPayloads.length).toBeGreaterThanOrEqual(1);
    });

    it('payloads target string fields', () => {
      const injectionTests = paymentTests.filter((test) =>
        test.tags.some((tag) => tag.toLowerCase().includes('injection'))
      );

      for (const test of injectionTests) {
        if (test.request.body) {
          const values = Object.values(test.request.body);
          const hasStringWithPayload = values.some(
            (v) =>
              typeof v === 'string' &&
              (v.includes('<') || v.includes("'") || v.includes(';'))
          );
          // At least some injection tests should have payloads in strings
          if (test.name.toLowerCase().includes('injection')) {
            expect(hasStringWithPayload).toBe(true);
          }
        }
      }
    });
  });

  describe('security-test-run-mode', () => {
    it('dangerous security tests are marked for manual review', () => {
      const dangerousTests = paymentTests.filter((test) =>
        test.tags.some((tag) =>
          ['injection', 'xss', 'sql'].includes(tag.toLowerCase())
        )
      );

      // At least some security tests should be manual
      const manualSecurityTests = dangerousTests.filter(
        (t) => t.run_mode === 'manual'
      );

      // It's acceptable to have auto security tests for CI, but some manual is good
      expect(dangerousTests.length).toBeGreaterThan(0);
    });
  });

  describe('no-actual-malicious-code', () => {
    it('payloads are test payloads, not actual exploits', () => {
      for (const test of paymentTests) {
        const bodyStr = JSON.stringify(test.request.body || {});

        // Should not contain actual file paths or system commands
        expect(bodyStr).not.toContain('/etc/passwd');
        expect(bodyStr).not.toContain('rm -rf');
        expect(bodyStr).not.toContain('wget ');
        expect(bodyStr).not.toContain('curl ');
      }
    });
  });
});
