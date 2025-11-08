import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request) {
  try {
    const body = await request.json();
    const { pointer, requestConfig, count = 12 } = body;

    if (!pointer || !requestConfig) {
      return NextResponse.json(
        { error: 'Missing required fields: pointer and requestConfig' },
        { status: 400 }
      );
    }

    // Build the prompt for OpenAI
    const prompt = `You are an API testing expert. Generate ${count} test variations based on the following:

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

    console.log('[API] Calling OpenAI with prompt for pointer:', pointer);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert API testing assistant. You generate comprehensive test cases in valid JSON format only. Never include markdown formatting or explanations, only return a JSON object with a "tests" array.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: {
        type: "json_object",
      },
      temperature: 0.7
    });

    const responseText = completion.choices[0].message.content;
    console.log('[API] OpenAI raw response:', responseText);

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[API] Failed to parse OpenAI response:', parseError);
      console.error('[API] Response text:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse OpenAI response as JSON', details: responseText },
        { status: 500 }
      );
    }

    // Validate and extract tests array from the response object
    if (!parsedResponse || !Array.isArray(parsedResponse.tests)) {
      return NextResponse.json(
        { error: 'Model response missing tests array', details: parsedResponse },
        { status: 422 }
      );
    }

    const tests = parsedResponse.tests || [];
    console.log('[API] Successfully parsed', tests.length, 'tests');

    // Normalize headers based on body type to avoid downstream JSON parsing failures
    const normalizedTests = tests.map((t) => {
      const req = t.request || {};
      const headers = { ...(req.headers || {}) };

      if (typeof req.body === 'string') {
        // Raw string body (possibly invalid JSON) -> enforce text/plain unless explicitly non-JSON
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
        ...t,
        request: {
          ...req,
          headers,
        },
      };
    });

    // Add unique IDs to each test
    const testsWithIds = normalizedTests.map((test, index) => ({
      id: `ai-gen-${Date.now()}-${index}`,
      ...test
    }));

    console.log('[API] Successfully generated', testsWithIds.length, 'tests');

    return NextResponse.json({
      tests: testsWithIds,
      count: testsWithIds.length
    });

  } catch (error) {
    console.error('[API] Error generating tests:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate tests', 
        message: error.message,
        details: error.response?.data || error.toString()
      },
      { status: 500 }
    );
  }
}
