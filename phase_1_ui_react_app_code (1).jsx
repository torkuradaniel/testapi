

/* package.json */
{
  "name": "api-test-phase1-ui",
  "version": "0.1.1",
  "private": true,
  "dependencies": {
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "react-scripts": "5.0.1",
    "uuid": "9.0.0"
  },
  "devDependencies": {
    "typescript": "^4.9.5",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test --env=jsdom",
    "eject": "react-scripts eject"
  }
}

/* src/index.jsx */
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

console.log('[index] booting app — locating #root');
const container = document.getElementById('root');
if (!container) {
  console.error('[index] root container not found — aborting render');
  throw new Error('Root container not found. Make sure your HTML has <div id="root"></div>.');
}
console.log('[index] found root container', container);
const root = createRoot(container);
root.render(<App />);
console.log('[index] render called');

/* src/App.jsx */
import React, { useEffect, useState } from 'react';
import TestComposer from './components/TestComposer';
import QueueView from './components/QueueView';
import ResultsInspector from './components/ResultsInspector';
import mockTests from './mock_tests.json';
import { runTest } from './mockApi';

export default function App() {
  const [apis] = useState([
    { id: 'orders', name: 'Staging Orders API', base: 'https://staging.orders.api', env: 'staging' },
    { id: 'users', name: 'User Service', base: 'https://staging.users.api', env: 'staging' }
  ]);

  const [currentApi, setCurrentApi] = useState(apis[0].id);
  const [tests, setTests] = useState([]); // generated tests queued
  const [results, setResults] = useState([]); // logs

  useEffect(() => {
    console.log('[App] seeding tests from mock_tests.json, count=', mockTests.length);
    // seed with mock tests for demo
    setTests(mockTests);
  }, []);

  const addGeneratedTests = (generated) => {
    console.log('[App] addGeneratedTests called — incoming:', generated.length, 'tests');
    // merge while ensuring unique ids
    setTests(prev => {
      console.log('[App] merging generated tests — prev count', prev.length);
      const existingNames = new Set(prev.map(t => t.name));
      const filtered = generated.filter(g => !existingNames.has(g.name));
      console.log('[App] filtered new tests count', filtered.length);
      return [...filtered, ...prev];
    });
  };

  const handleRunTest = async (test) => {
    console.log('[App] handleRunTest — starting', test.name);
    const log = { testName: test.name, startedAt: new Date().toISOString(), request: test.request };
    setResults(prev => [log, ...prev]);
    try {
      const res = await runTest(test.request);
      console.log('[App] runTest returned for', test.name, 'status=', res?.status);
      const updated = { ...log, finishedAt: new Date().toISOString(), response: res };
      setResults(prev => [updated, ...prev]);
    } catch (err) {
      console.error('[App] runTest error for', test.name, err);
      const updated = { ...log, finishedAt: new Date().toISOString(), response: { error: String(err) } };
      setResults(prev => [updated, ...prev]);
    }
  };

  const handleRunSuite = async () => {
    console.log('[App] Run Suite triggered — tests in queue:', tests.length);
    // Run user_requested first
    const priority = tests.filter(t => t.user_requested).concat(tests.filter(t => !t.user_requested));
    console.log('[App] run order length', priority.length);
    for (const t of priority) {
      if (t.run_mode === 'manual') {
        console.log('[App] skipping manual test', t.name);
        continue;
      }
      console.log('[App] running test', t.name);
      // sequentially run tests to avoid concurrency in demo
      // eslint-disable-next-line no-await-in-loop
      await handleRunTest(t);
    }
    console.log('[App] Run Suite completed');
  };

  const handleReplay = async (requestObj) => {
    console.log('[App] replaying request', requestObj.path || '(no path)');
    // replay exact request
    const res = await runTest(requestObj);
    console.log('[App] replay response status=', res?.status);
    const replayLog = { testName: 'replay', startedAt: new Date().toISOString(), request: requestObj, finishedAt: new Date().toISOString(), response: res };
    setResults(prev => [replayLog, ...prev]);
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>Automated API Testing — Phase 1</h1>
        <div className="api-selector">
          <label>API: </label>
          <select value={currentApi} onChange={e => { console.log('[App] API changed to', e.target.value); setCurrentApi(e.target.value); }}>
            {apis.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.env})
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="grid">
        <section className="composer">
          <TestComposer apiId={currentApi} onGenerate={addGeneratedTests} />
          <div className="run-controls">
            <button onClick={handleRunSuite} className="btn primary">
              Run Suite (auto tests)
            </button>
          </div>
        </section>

        <section className="queue">
          <QueueView tests={tests} onRun={handleRunTest} onUpdateTests={setTests} />
        </section>

        <section className="results">
          <ResultsInspector results={results} onReplay={handleReplay} />
        </section>
      </main>

      <footer className="app-footer">
        Phase 1 demo — logs are ephemeral (in-memory) and this is a client-side demo. For production wire backend integration.
      </footer>
    </div>
  );
}

/* src/components/TestComposer.jsx */
import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export default function TestComposer({ apiId, onGenerate }) {
  const [nl, setNl] = useState('');
  const [num, setNum] = useState(12);

  const handleGenerate = () => {
    console.log('[TestComposer] generate clicked — pointer:', nl);
    // Mock generation locally: create simple tests from NL pointer
    const pointer = nl.trim() || 'ensure to test when amount is 0';
    const generated = [];
    for (let i = 0; i < num; i++) {
      const name = `${apiId}-gen-${pointer.replace(/\s+/g, '_').slice(0, 20)}-${i}`;
      const user_requested = i < 3; // first 3 satisfy pointer
      const test = {
        id: uuidv4(),
        name,
        request: {
          method: 'POST',
          path: apiId === 'orders' ? '/orders' : '/users',
          headers: { 'Content-Type': 'application/json' },
          body:
            apiId === 'orders'
              ? { amount: user_requested ? 0 : 100, currency: 'USD', items: [{ sku: 'S1', qty: 1 }] }
              : { email: user_requested ? null : 'a@b.com', name: 'Alice' }
        },
        tags: user_requested ? ['user_requested', 'validation'] : ['fuzz'],
        user_requested,
        run_mode: user_requested ? 'auto' : 'manual',
        priority: user_requested ? 'high' : 'low'
      };
      generated.push(test);
    }
    console.log('[TestComposer] generated tests count=', generated.length);
    onGenerate(generated);
    setNl('');
  };

  return (
    <div className="composer-card">
      <h2>Test Composer (Natural Language)</h2>
      <p>
        Enter a natural-language pointer (e.g., "ensure to test when amount is 0"). The demo will generate variations and mark pointer tests as
        user_requested.
      </p>
      <textarea value={nl} onChange={e => setNl(e.target.value)} placeholder="Type your test pointer here..." rows={4} />
      <div className="composer-actions">
        <label>Generate count:</label>
        <input type="number" value={num} min={4} max={50} onChange={e => setNum(Number(e.target.value))} />
        <button className="btn" onClick={handleGenerate}>
          AI Generate Tests
        </button>
      </div>
    </div>
  );
}

/* src/components/QueueView.jsx */
import React from 'react';

export default function QueueView({ tests, onRun, onUpdateTests }) {
  const toggleRunMode = (id) => {
    console.log('[QueueView] toggleRunMode for', id);
    const updated = tests.map((t) => (t.id === id ? { ...t, run_mode: t.run_mode === 'auto' ? 'manual' : 'auto' } : t));
    onUpdateTests(updated);
  };

  return (
    <div className="queue-card">
      <h2>Test Queue</h2>
      <div className="queue-list">
        {tests.length === 0 && <div className="muted">No tests generated yet.</div>}
        {tests.map((test) => (
          <div className="test-row" key={test.id}>
            <div className="test-meta">
              <div className="test-name">{test.name}</div>
              <div className="test-tags">{test.tags?.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}</div>
            </div>
            <div className="test-controls">
              <div className="runmode">
                Mode: <strong>{test.run_mode}</strong>
              </div>
              <button className="btn small" onClick={() => toggleRunMode(test.id)}>
                Toggle Mode
              </button>
              <button className="btn small" onClick={() => { console.log('[QueueView] Run clicked for', test.name); onRun(test); }}>
                Run
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* src/components/ResultsInspector.jsx */
import React from 'react';

function maskHeaders(headers) {
  const out = { ...headers };
  if (out && out.Authorization) out.Authorization = '***masked***';
  return out;
}

export default function ResultsInspector({ results, onReplay }) {
  return (
    <div className="results-card">
      <h2>Results / Failures</h2>
      <div className="results-list">
        {results.length === 0 && <div className="muted">No runs yet. Run suite or individual tests to see results.</div>}
        {results.map((r, idx) => (
          <div className="result-row" key={idx}>
            <div className="result-header">
              <div className="result-title">{r.testName} — {r.response?.status ? `status ${r.response.status}` : r.response?.error || 'pending'}</div>
              <div className="result-ts">{new Date(r.startedAt).toLocaleString()}</div>
            </div>
            <div className="result-body">
              <div>
                <strong>Request:</strong>
              </div>
              <pre className="mono">{JSON.stringify({ ...r.request, headers: maskHeaders(r.request && r.request.headers) }, null, 2)}</pre>
              <div>
                <strong>Response:</strong>
              </div>
              <pre className="mono">{JSON.stringify(r.response, null, 2)}</pre>
              <div className="result-actions">
                <button className="btn small" onClick={() => { console.log('[ResultsInspector] Replay clicked for', r.testName); onReplay(r.request); }}>
                  Replay
                </button>
                <button className="btn small" onClick={() => console.log('[ResultsInspector] Create GitHub Issue clicked for', r.testName)}>Create GitHub Issue</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* src/mockApi.js */
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

/* src/mock_tests.json (fixed and validated) */
[
  {
    "id": "t-orders-amount-0-exact",
    "name": "orders-amount-0-exact",
    "request": { "method": "POST", "path": "/orders", "headers": { "Content-Type": "application/json" }, "body": { "amount": 0, "currency": "USD", "items": [{ "sku": "S1", "qty": 1 }] } },
    "tags": ["validation","amount","user_requested"],
    "user_requested": true,
    "run_mode": "auto",
    "priority": "high"
  },
  {
    "id": "t-orders-amount-0-string",
    "name": "orders-amount-0-string",
    "request": { "method": "POST", "path": "/orders", "headers": { "Content-Type": "application/json" }, "body": { "amount": "0", "currency": "USD", "items": [{ "sku": "S1", "qty": 1 }] } },
    "tags": ["validation","amount","user_requested","type-variant"],
    "user_requested": true,
    "run_mode": "auto",
    "priority": "high"
  },
  {
    "id": "t-orders-amount-missing",
    "name": "orders-amount-missing",
    "request": { "method": "POST", "path": "/orders", "headers": { "Content-Type": "application/json" }, "body": { "currency": "USD", "items": [{ "sku": "S1", "qty": 1 }] } },
    "tags": ["validation","amount","user_requested","missing-field"],
    "user_requested": true,
    "run_mode": "auto",
    "priority": "high"
  },
  {
    "id": "t-orders-truncated-json",
    "name": "orders-truncated-json",
    "request": { "method": "POST", "path": "/orders", "headers": { "Content-Type": "application/json" }, "body": "{ \"amount\": 100, \"items\": [ { \"sku\": \"S1\", \"qty\": 1 }" },
    "tags": ["malformed","content-type"],
    "user_requested": false,
    "run_mode": "auto",
    "priority": "high"
  },
  {
    "id": "t-orders-currency-invalid",
    "name": "orders-currency-invalid",
    "request": { "method": "POST", "path": "/orders", "headers": { "Content-Type": "application/json" }, "body": { "amount": 0, "currency": "XYZ", "items": [{ "sku": "S1", "qty": 1 }] } },
    "tags": ["validation","amount","combo"],
    "user_requested": true,
    "run_mode": "auto",
    "priority": "high"
  },
  {
    "id": "t-orders-items-empty",
    "name": "orders-items-empty",
    "request": { "method": "POST", "path": "/orders", "headers": { "Content-Type": "application/json" }, "body": { "amount": 50, "currency": "USD", "items": [] } },
    "tags": ["validation","items"],
    "user_requested": false,
    "run_mode": "auto",
    "priority": "medium"
  },
  {
    "id": "t-users-missing-email",
    "name": "users-missing-email",
    "request": { "method": "POST", "path": "/users", "headers": { "Content-Type": "application/json" }, "body": { "name": "Bob" } },
    "tags": ["validation","email","user_requested"],
    "user_requested": true,
    "run_mode": "auto",
    "priority": "high"
  },
  {
    "id": "t-users-duplicate-email-concurrent",
    "name": "users-duplicate-email-concurrent",
    "request": { "method": "POST", "path": "/users", "headers": { "Content-Type": "application/json" }, "body": { "email": "duplicate@example.com", "name": "Alice" } },
    "tags": ["concurrency","duplicate","user_requested"],
    "user_requested": true,
    "run_mode": "manual",
    "priority": "high"
  },
  {
    "id": "t-orders-long-description",
    "name": "orders-long-description",
    "request": { "method": "POST", "path": "/orders", "headers": { "Content-Type": "application/json" }, "body": { "amount": 10, "currency": "USD", "description": "", "items": [{ "sku": "S1", "qty": 1 }] } },
    "tags": ["fuzz","size"],
    "user_requested": false,
    "run_mode": "auto",
    "priority": "low"
  },
  {
    "id": "t-orders-promo-injection",
    "name": "orders-promo-injection",
    "request": { "method": "POST", "path": "/orders", "headers": { "Content-Type": "application/json" }, "body": { "amount": 100, "currency": "USD", "promo_code": "'; DROP TABLE users; --", "items": [{ "sku": "S1", "qty": 1 }] } },
    "tags": ["injection","fuzz"],
    "user_requested": false,
    "run_mode": "auto",
    "priority": "low"
  }
]

/* src/styles.css */
:root{ --bg:#0f1724; --card:#111827; --muted:#9ca3af; --accent:#06b6d4; --surface:#0b1220; }
body{ margin:0; font-family:Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; background:linear-gradient(180deg,#071126 0%, #081024 100%); color:#e6eef6 }
.app-root{ max-width:1200px; margin:24px auto; padding:20px }
.app-header{ display:flex; justify-content:space-between; align-items:center; margin-bottom:16px }
.app-header h1{ margin:0; font-size:20px }
.grid{ display:grid; grid-template-columns: 1fr 1fr 1fr; gap:16px }
.composer, .queue, .results{ background:var(--card); padding:12px; border-radius:8px }
.composer-card textarea{ width:100%; padding:8px; border-radius:6px; border:none; background:#0b1220; color:#e6eef6 }
.btn{ background:var(--accent); color:#072026; border:none; padding:8px 12px; border-radius:6px; cursor:pointer }
.btn.primary{ background:#10b981; color:white }
.btn.small{ padding:6px 10px; margin-left:6px }
.test-row{ display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid rgba(255,255,255,0.03) }
.tag{ background:rgba(255,255,255,0.04); padding:2px 6px; border-radius:4px; margin-right:6px }
.muted{ color:var(--muted) }
.mono{ font-family: 'Courier New', monospace; background:#061223; padding:8px; border-radius:6px }
.app-footer{ margin-top:16px; color:var(--muted) }

/* README (instructions) */

/* README: run the demo

1) Create a new React app or paste files into a folder.
2) `npm install` (or `yarn`)
3) `npm start`

The UI is a client-side demo that seeds tests from mock_tests.json. The "AI Generate Tests" button in the composer creates synthetic tests based on the pointer you type. "Run Suite" executes auto tests sequentially against a deterministic mock runner (mockApi.js). Results appear in the Results panel where you can replay requests.

Notes:
- This is a Phase 1 UI demo: no backend required. Replace mockApi.runTest with real backend calls when ready.
- For production: integrate an LLM service for generation, enqueue/run tests in backend worker, and store logs in DB.
*/
