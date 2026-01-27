import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { testGenerationPromptConfig } from '../../../lib/prompt-config.js';

let openai;
function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

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

    const prompt = testGenerationPromptConfig.buildUserPrompt(
      pointer,
      requestConfig,
      count
    );

    console.log('[API] Calling OpenAI with prompt for pointer:', pointer);

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: testGenerationPromptConfig.systemPrompt
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
