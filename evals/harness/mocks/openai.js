/**
 * OpenAI Mock
 * Provides deterministic mock responses for testing without hitting the real API
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a mock test based on pointer and config
 * @param {string} pointer - User's test pointer
 * @param {Object} requestConfig - API request configuration
 * @param {number} index - Test index
 * @param {boolean} userRequested - Whether this is a user-requested test
 * @returns {Object} Mock test object
 */
function generateMockTest(pointer, requestConfig, index, userRequested) {
  const pointerLower = pointer.toLowerCase();
  const body = requestConfig.body || {};

  // Determine test characteristics based on index
  // Ordered to ensure all required categories are within first 10 tests
  // Required: empty (2), injection (2), type (2), boundary (2), missing (1), extra (1)
  const testTypes = [
    // User-requested tests (first 3) - indices 0, 1, 2
    { type: 'user-pointer', priority: 'high', tags: ['user-requested', 'direct'] },
    { type: 'user-pointer', priority: 'high', tags: ['user-requested', 'variation'] },
    { type: 'user-pointer', priority: 'high', tags: ['user-requested', 'edge-case'] },
    // Exploratory tests (indices 3-9) - ensure all categories covered
    { type: 'empty', priority: 'medium', tags: ['empty-value', 'edge-case', 'null'] },           // 3: empty #1
    { type: 'empty-null', priority: 'medium', tags: ['empty-value', 'null', 'edge-case'] },      // 4: empty #2
    { type: 'injection-sql', priority: 'high', tags: ['security', 'injection', 'sql'] },         // 5: injection #1
    { type: 'injection-xss', priority: 'high', tags: ['security', 'injection', 'xss'] },         // 6: injection #2
    { type: 'type-coercion', priority: 'medium', tags: ['type-variation', 'type'] },             // 7: type #1
    { type: 'missing-field', priority: 'medium', tags: ['missing-field', 'validation'] },        // 8: missing #1
    { type: 'extra-field', priority: 'low', tags: ['extra-field', 'validation'] },               // 9: extra #1
    // Additional tests for larger suites (indices 10+)
    { type: 'type-coercion-bool', priority: 'medium', tags: ['type-variation', 'type', 'boolean'] },
    { type: 'boundary', priority: 'high', tags: ['boundary', 'edge-case'] },
    { type: 'negative', priority: 'medium', tags: ['boundary', 'negative'] },
    { type: 'large-value', priority: 'medium', tags: ['boundary', 'overflow'] },
  ];

  const testType = testTypes[index % testTypes.length];
  const method = requestConfig.method || 'POST';
  const path = requestConfig.path || '/api/test';

  // Generate test name and body based on type
  let name, testBody;

  switch (testType.type) {
    case 'user-pointer':
      name = `Test ${pointer} - variation ${index + 1}`;
      testBody = { ...body };
      // Modify body based on pointer keywords
      if (pointerLower.includes('0') || pointerLower.includes('zero')) {
        const numericKey = Object.keys(body).find(
          (k) => typeof body[k] === 'number'
        );
        if (numericKey) testBody[numericKey] = 0;
      }
      if (pointerLower.includes('empty')) {
        const stringKey = Object.keys(body).find(
          (k) => typeof body[k] === 'string'
        );
        if (stringKey) testBody[stringKey] = '';
      }
      break;

    case 'boundary':
      name = 'Test with boundary value 0';
      testBody = { ...body };
      const numKey = Object.keys(body).find((k) => typeof body[k] === 'number');
      if (numKey) testBody[numKey] = 0;
      break;

    case 'empty':
      name = 'Test with empty string value';
      testBody = { ...body };
      const strKey = Object.keys(body).find((k) => typeof body[k] === 'string');
      if (strKey) testBody[strKey] = '';
      break;

    case 'empty-null':
      name = 'Test with null value for field';
      testBody = { ...body };
      const nullKey = Object.keys(body).find((k) => typeof body[k] === 'string');
      if (nullKey) testBody[nullKey] = null;
      break;

    case 'type-coercion':
      name = 'Test with string instead of number type';
      testBody = { ...body };
      const typeKey = Object.keys(body).find(
        (k) => typeof body[k] === 'number'
      );
      if (typeKey) testBody[typeKey] = String(body[typeKey]);
      break;

    case 'type-coercion-bool':
      name = 'Test with boolean type instead of string';
      testBody = { ...body };
      const boolKey = Object.keys(body).find((k) => typeof body[k] === 'string');
      if (boolKey) testBody[boolKey] = true;
      break;

    case 'injection-sql':
      name = 'Test with SQL injection payload';
      testBody = { ...body };
      const sqlKey = Object.keys(body).find((k) => typeof body[k] === 'string');
      if (sqlKey) testBody[sqlKey] = "'; DROP TABLE users; --";
      break;

    case 'injection-xss':
      name = 'Test with XSS injection payload';
      testBody = { ...body };
      const xssKey = Object.keys(body).find((k) => typeof body[k] === 'string');
      if (xssKey) testBody[xssKey] = '<script>alert("xss")</script>';
      break;

    case 'missing-field':
      name = 'Test with missing required field';
      testBody = { ...body };
      const keys = Object.keys(testBody);
      if (keys.length > 0) delete testBody[keys[0]];
      break;

    case 'extra-field':
      name = 'Test with unexpected extra field';
      testBody = { ...body, unexpectedField: 'unexpected_value' };
      break;

    case 'negative':
      name = 'Test with negative number value';
      testBody = { ...body };
      const negKey = Object.keys(body).find((k) => typeof body[k] === 'number');
      if (negKey) testBody[negKey] = -1;
      break;

    case 'large-value':
      name = 'Test with very large number value';
      testBody = { ...body };
      const largeKey = Object.keys(body).find(
        (k) => typeof body[k] === 'number'
      );
      if (largeKey) testBody[largeKey] = Number.MAX_SAFE_INTEGER;
      break;

    default:
      name = `Generated test ${index + 1}`;
      testBody = body;
  }

  return {
    id: uuidv4(),
    name,
    request: {
      method,
      path,
      headers: requestConfig.headers || { 'Content-Type': 'application/json' },
      body: testBody,
    },
    tags: testType.tags,
    priority: testType.priority,
    run_mode: index < 3 ? 'auto' : (index % 2 === 0 ? 'auto' : 'manual'),
    user_requested: userRequested,
  };
}

/**
 * Get a mock response for the generate-tests API
 * @param {string} pointer - User's test pointer
 * @param {Object} requestConfig - API request configuration
 * @param {number} count - Number of tests to generate
 * @returns {{ tests: Array, count: number }}
 */
export function getMockResponse(pointer, requestConfig, count = 10) {
  const tests = [];

  for (let i = 0; i < count; i++) {
    const userRequested = i < 3;
    tests.push(generateMockTest(pointer, requestConfig, i, userRequested));
  }

  return { tests, count: tests.length };
}

/**
 * Mock OpenAI chat completion
 * Simulates the OpenAI API response format
 */
export const mockOpenAI = {
  chat: {
    completions: {
      create: async ({ messages }) => {
        // Extract pointer and config from the messages
        const userMessage = messages.find((m) => m.role === 'user');
        let pointer = 'default test';
        let requestConfig = { method: 'POST', path: '/api/test', body: {} };
        let count = 10;

        if (userMessage) {
          try {
            const content = JSON.parse(userMessage.content);
            pointer = content.pointer || pointer;
            requestConfig = content.requestConfig || requestConfig;
            count = content.count || count;
          } catch {
            // Use defaults if parsing fails
          }
        }

        const mockResponse = getMockResponse(pointer, requestConfig, count);

        return {
          id: 'mock-completion-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4o-mini',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: JSON.stringify(mockResponse),
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 500,
            total_tokens: 600,
          },
        };
      },
    },
  },
};

export default mockOpenAI;
