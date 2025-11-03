"use client";

import React, { useState } from 'react';

export default function TestComposer({ requestConfig, onGenerate }) {
  const [nl, setNl] = useState('');
  const [num, setNum] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    const pointer = nl.trim() || 'ensure to test when amount is 0';
    console.log('[TestComposer] generate clicked — pointer:', pointer);
    
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-tests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pointer,
          requestConfig,
          count: num
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate tests');
      }

      const data = await response.json();
      console.log('[TestComposer] received tests from API:', data.tests.length);
      
      onGenerate(data.tests);
      setNl('');
    } catch (err) {
      console.error('[TestComposer] error generating tests:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="composer-card">
      <h2>Test Composer (Natural Language)</h2>
      <p>
        Enter a natural-language pointer (e.g., "ensure to test when amount is 0"). The demo will generate variations and mark pointer tests as
        user_requested.
      </p>
      <textarea 
        value={nl} 
        onChange={e => setNl(e.target.value)} 
        placeholder="Type your test pointer here..." 
        rows={6}
        disabled={loading}
      />
      {error && (
        <div className="error-message">
          Error: {error}
        </div>
      )}
      <div className="composer-actions">
        <div className="count-control">
          {/* <label>Test Count</label> */}
          <input 
            type="number" 
            value={num} 
            min={4} 
            max={50} 
            onChange={e => setNum(Number(e.target.value))}
            disabled={loading}
          />
        </div>
        <button className="btn primary" onClick={handleGenerate} disabled={loading}>
          {loading ? 'Generating...' : 'Generate tests'}
        </button>
      </div>
    </div>
  );
}
