/**
 * Live OpenAI Client for Evals
 * Calls the real OpenAI API to test different models
 */

import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { testGenerationPromptConfig } from '../../lib/prompt-config.js';

// Supported models for evaluation
export const SUPPORTED_MODELS = [
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
  'o1-mini',
  'o1-preview',
];

/**
 * Create an OpenAI client
 * @param {string} apiKey - OpenAI API key (defaults to env var)
 * @returns {OpenAI}
 */
export function createClient(apiKey) {
  return new OpenAI({
    apiKey: apiKey || process.env.OPENAI_API_KEY,
  });
}


/**
 * Normalize test headers based on body type
 * @param {Object} test - Test object
 * @returns {Object} Normalized test
 */
function normalizeTest(test) {
  const req = test.request || {};
  const headers = { ...(req.headers || {}) };

  if (typeof req.body === 'string') {
    const ct = headers['Content-Type'] || headers['content-type'];
    if (!ct || String(ct).toLowerCase().includes('json')) {
      headers['Content-Type'] = 'text/plain';
    }
  } else if (req.body && typeof req.body === 'object') {
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  return {
    ...test,
    id: test.id || uuidv4(),
    request: {
      ...req,
      headers,
    },
  };
}

/**
 * Generate tests using a live OpenAI model
 * @param {Object} options - Generation options
 * @param {string} options.pointer - Natural language test pointer
 * @param {Object} options.requestConfig - API request configuration
 * @param {number} options.count - Number of tests to generate
 * @param {string} options.model - Model to use (default: gpt-4o-mini)
 * @param {string} options.apiKey - OpenAI API key (optional)
 * @param {number} options.temperature - Temperature (default: 0.7)
 * @returns {Promise<{ tests: Array, count: number, model: string, usage: Object, latencyMs: number }>}
 */
export async function generateTestsLive({
  pointer,
  requestConfig,
  count = 20,
  model = 'gpt-5.2',
  apiKey,
  temperature = 0.7,
}) {
  const client = createClient(apiKey);
  const startTime = Date.now();

  // Build params - o1 models don't support system messages or temperature
  const isO1Model = model.startsWith('o1-');

  const userPrompt = testGenerationPromptConfig.buildUserPrompt(
    pointer,
    requestConfig,
    count
  );
  const systemPrompt = testGenerationPromptConfig.systemPrompt;

  const messages = isO1Model
    ? [
        {
          role: 'user',
          content: `${systemPrompt}\n\n${userPrompt}`,
        },
      ]
    : [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

  const completionParams = {
    model,
    messages,
  };

  // Add temperature only for non-o1 models
  if (!isO1Model) {
    completionParams.temperature = temperature;
    completionParams.response_format = { type: 'json_object' };
  }

  const completion = await client.chat.completions.create(completionParams);
  const latencyMs = Date.now() - startTime;

  const responseText = completion.choices[0].message.content;

  // Parse JSON response
  let parsedResponse;
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
    parsedResponse = JSON.parse(jsonStr);
  } catch (parseError) {
    throw new Error(`Failed to parse model response as JSON: ${parseError.message}\nResponse: ${responseText}`);
  }

  if (!parsedResponse || !Array.isArray(parsedResponse.tests)) {
    throw new Error(`Model response missing tests array: ${JSON.stringify(parsedResponse)}`);
  }

  // Normalize and add IDs
  const tests = parsedResponse.tests.map(normalizeTest);

  return {
    tests,
    count: tests.length,
    model,
    usage: completion.usage,
    latencyMs,
  };
}

/**
 * Compare test generation across multiple models
 * @param {Object} options - Comparison options
 * @param {string} options.pointer - Natural language test pointer
 * @param {Object} options.requestConfig - API request configuration
 * @param {number} options.count - Number of tests per model
 * @param {string[]} options.models - Models to compare
 * @param {string} options.apiKey - OpenAI API key
 * @returns {Promise<Object>} Comparison results
 */
export async function compareModels({
  pointer,
  requestConfig,
  count = 10,
  models = ['gpt-4o-mini', 'gpt-4o'],
  apiKey,
}) {
  const results = {};

  for (const model of models) {
    try {
      const result = await generateTestsLive({
        pointer,
        requestConfig,
        count,
        model,
        apiKey,
      });
      results[model] = {
        success: true,
        ...result,
      };
    } catch (error) {
      results[model] = {
        success: false,
        error: error.message,
      };
    }
  }

  return results;
}

export default {
  generateTestsLive,
  compareModels,
  createClient,
  SUPPORTED_MODELS,
};
