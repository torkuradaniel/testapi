import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const payload = await req.json();
    const { method = 'GET', baseUrl = '', path = '/', headers = {}, body } = payload || {};

    if (!path) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 });
    }

    const url = `${(baseUrl || '').replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;

    // Prepare fetch options
    const init = {
      method,
      headers: headers || {},
    };

    // Only attach body for methods that support it
    const methodUpper = String(method || 'GET').toUpperCase();
    const canHaveBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(methodUpper);

    if (canHaveBody && body !== undefined && body !== null) {
      if (typeof body === 'string') {
        init.body = body; // raw string (e.g., invalid JSON)
      } else {
        init.body = JSON.stringify(body);
        if (!init.headers['Content-Type'] && !init.headers['content-type']) {
          init.headers['Content-Type'] = 'application/json';
        }
      }
    }

    // Execute the real HTTP request server-side
    const resp = await fetch(url, init);

    // Try to parse JSON, fallback to text
    const contentType = resp.headers.get('content-type') || '';
    let respBody;
    try {
      if (contentType.includes('application/json')) {
        respBody = await resp.json();
      } else {
        respBody = await resp.text();
      }
    } catch (e) {
      respBody = await resp.text().catch(() => '');
    }

    // Return a normalized response shape
    return NextResponse.json({
      status: resp.status,
      headers: {
        'content-type': contentType,
      },
      body: respBody,
      url,
      ok: resp.ok,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Relay request failed', message: err.message }, { status: 500 });
  }
}
