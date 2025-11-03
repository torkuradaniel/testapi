// Simple deterministic mock API runner for demo. Simulates failures for certain inputs.

export async function runTest(request) {
  console.log('[mockApi] runTest called — request.path=', request && request.path, 'request.body=', request && request.body);
  // small artificial delay
  await new Promise((res) => setTimeout(res, 300 + Math.random() * 400));

  const { path, body, headers, method } = request;

  // Simulate rules for /orders
  if (path === '/orders') {
    // truncated JSON detection: body is string and not parseable
    if (typeof body === 'string' && body.trim().endsWith(']') === false) {
      console.warn('[mockApi] truncated JSON detected for path /orders');
      return { status: 400, body: '<html>Bad request</html>', headers: { 'content-type': 'text/html' } };
    }
    // amount-specific rules
    const amount = body && body.amount;
    if (amount === 0) {
      console.log('[mockApi] amount===0 triggered for request');
      // produce an error on some runs
      if (Math.random() > 0.5) {
        console.error('[mockApi] simulating 500 for amount=0');
        return { status: 500, body: { error: 'server error processing zero amount' } };
      }
      console.log('[mockApi] returning 400 for amount=0');
      return { status: 400, body: { error: 'amount must be > 0' } };
    }
    if (body && body.currency === 'XYZ') {
      console.log('[mockApi] invalid currency XYZ');
      return { status: 400, body: { error: 'invalid currency' } };
    }

    // missing items
    if (Array.isArray(body && body.items) && body.items.length === 0) {
      console.log('[mockApi] items empty array — returning 400');
      return { status: 400, body: { error: 'items required' } };
    }

    // otherwise success
    const success = { status: 201, body: { id: 'ord_' + Math.floor(Math.random() * 10000), accepted: true }, headers: { 'content-type': 'application/json' } };
    console.log('[mockApi] success response for /orders', success);
    return success;
  }

  // /users rules
  if (path === '/users') {
    if (!body || !body.email) {
      console.warn('[mockApi] missing email — returning 500 (simulated bug)');
      return { status: 500, body: { error: 'missing email (simulated server bug)' } };
    }
    if (body.email === 'duplicate@example.com') {
      console.log('[mockApi] duplicate email detected');
      return { status: 409, body: { error: 'duplicate' } };
    }
    const userSuccess = { status: 201, body: { id: 'user_' + Math.floor(Math.random() * 10000) } };
    console.log('[mockApi] success response for /users', userSuccess);
    return userSuccess;
  }

  // default
  console.log('[mockApi] default response');
  return { status: 200, body: {} };
}
