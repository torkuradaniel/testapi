"use client";

import React from 'react';

export default function QueueView({ tests, onRun, onUpdateTests, onRunSuite }) {
  const toggleRunMode = (id) => {
    console.log('[QueueView] toggleRunMode for', id);
    const updated = tests.map((t) => (t.id === id ? { ...t, run_mode: t.run_mode === 'auto' ? 'manual' : 'auto' } : t));
    onUpdateTests(updated);
  };

  return (
    <div className="queue-card">
      <div className="queue-header">
        <h2>Test Queue</h2>
        <button className="btn primary" onClick={onRunSuite}>
          Run All Auto Tests
        </button>
      </div>
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
          </div>
        ))}
      </div>
    </div>
  );
}
