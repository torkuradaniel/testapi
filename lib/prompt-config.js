export const testGenerationPromptConfig = {
  systemPrompt:
    'You are an expert API testing assistant. You generate comprehensive test cases in valid JSON format only. Never include markdown formatting or explanations, only return a JSON object with a "tests" array.',
  buildUserPrompt(pointer, requestConfig, count) {
    return `You are an API testing expert. Generate ${count} test variations based on the following:

Natural Language Test Pointer: "${pointer}"

API Request Configuration:
- Method: ${requestConfig.method}
- Path: ${requestConfig.path}
- Headers: ${JSON.stringify(requestConfig.headers, null, 2)}
- Body: ${JSON.stringify(requestConfig.body, null, 2)}

Generate ${count} test cases that:
1. The first 3 tests MUST directly satisfy the user's pointer: "${pointer}"
2. Include edge cases, boundary conditions, type variations, missing fields, malformed data, no validation
3. Test for common vulnerabilities (injection, overflow, etc.)
4. Each test should have a descriptive name

Return a JSON object with a "tests" array containing test objects with this exact structure:
{
  "tests": [
    {
      "name": "descriptive-test-name",
      "request": {
        "method": "${requestConfig.method}",
        "path": "${requestConfig.path}",
        "headers": {...},
        "body": {...}
      },
      "tags": ["tag1", "tag2"],
      "user_requested": true/false,
      "run_mode": "auto" or "manual",
      "priority": "high", "medium", or "low"
    }
  ]
}

IMPORTANT:
- The first 3 tests must have "user_requested": true and directly test "${pointer}"
- Remaining tests should have "user_requested": false
- For tests that intentionally use invalid JSON, set request.body to a STRING containing the invalid JSON (do NOT return it as an object) and set request.headers["Content-Type"] = "text/plain" for that test.
- For tests with valid JSON object bodies, ensure request.headers["Content-Type"] = "application/json".
- Always return ONLY a valid JSON object with a "tests" array (no markdown or explanations)`;
  },
};

export default testGenerationPromptConfig;
