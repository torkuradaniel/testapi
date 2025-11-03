"use client";

import React from 'react';

function maskHeaders(headers) {
  const out = { ...headers };
  if (out && out.Authorization) out.Authorization = '***masked***';
  return out;
}

export default function ResultsInspector({ results, onReplay }) {
  const latest = results && results.length > 0 ? results[0] : null;

  const renderResponse = (resp) => {
    if (!resp) return 'Pending...';
    // If using relay shape { status, headers, body, url, ok }
    if (resp && Object.prototype.hasOwnProperty.call(resp, 'body')) {
      const body = resp.body;
      if (typeof body === 'string') return body;
      try { return JSON.stringify(body, null, 2); } catch { return String(body); }
    }
    // Fallback
    try { return JSON.stringify(resp, null, 2); } catch { return String(resp); }
  };

  return (
    <div className="results-card">
      <h2>Results / Failures</h2>
      <div className="results-list">
        {!latest && <div className="muted">No runs yet. Click Run on a test to see the live result.</div>}
        {latest && (
          <div className="result-row" key={0}>
            <div className="result-header">
              <div className="result-title">{latest.testName} — {latest.response?.status ? `status ${latest.response.status}` : latest.response?.error || 'pending'}</div>
              <div className="result-ts">{new Date(latest.startedAt).toLocaleString()}</div>
            </div>
            <div className="result-body">
              <div>
                <strong>Request:</strong>
              </div>
              <pre className="mono">{JSON.stringify({ ...latest.request, headers: maskHeaders(latest.request && latest.request.headers) }, null, 2)}</pre>
              <div>
                <strong>Response:</strong>
              </div>
              <pre className="mono">{renderResponse(latest.response)}</pre>
              <div className="result-actions">
                <button className="btn small" onClick={() => { console.log('[ResultsInspector] Replay clicked for', latest.testName); onReplay(latest.request); }}>
                  Replay
                </button>
                <button className="btn small" onClick={() => console.log('[ResultsInspector] Create GitHub Issue clicked for', latest.testName)}>Create GitHub Issue</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
