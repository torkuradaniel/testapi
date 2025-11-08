"use client";

import React, { useEffect, useState } from 'react';
import ApiRequestBuilder from '../components/ApiRequestBuilder';
import TestComposer from '../components/TestComposer';
import QueueView from '../components/QueueView';
import ResultsInspector from '../components/ResultsInspector';

export default function Page() {
  const [requestConfig, setRequestConfig] = useState({
    method: 'POST',
    baseUrl: 'https://api-exchange-now-sandbox.vertofx.com',
    path: '/fx/rate',
    headers: { 'Content-Type': 'application/json' },
    body: {
      "paymentMode": "immediate",
      "currencyFrom": {
        "currencyName": "NGN"
      },
      "currencyTo": {
        "currencyName": "USD"
      }
    }
  });
  const [tests, setTests] = useState([]);
  const [results, setResults] = useState([]);

  const addGeneratedTests = (generated) => {
    console.log('[App] addGeneratedTests called — incoming:', generated.length, 'tests');
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
      const relayPayload = {
        method: test.request?.method || 'GET',
        baseUrl: requestConfig.baseUrl || '',
        path: test.request?.path || '/',
        headers: test.request?.headers || {},
        body: test.request?.body,
      };
      const resp = await fetch('/api/relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(relayPayload),
      });
      const data = await resp.json();
      console.log('[App] relay returned for', test.name, 'status=', data?.status, 'url=', data?.url);
      const updated = { ...log, finishedAt: new Date().toISOString(), response: data };
      setResults(prev => [updated, ...prev]);
    } catch (err) {
      console.error('[App] relay error for', test.name, err);
      const updated = { ...log, finishedAt: new Date().toISOString(), response: { error: String(err) } };
      setResults(prev => [updated, ...prev]);
    }
  };

  const handleRunSuite = async () => {
    console.log('[App] Run Suite triggered — tests in queue:', tests.length);
    const priority = tests.filter(t => t.user_requested).concat(tests.filter(t => !t.user_requested));
    console.log('[App] run order length', priority.length);
    for (const t of priority) {
      if (t.run_mode === 'manual') {
        console.log('[App] skipping manual test', t.name);
        continue;
      }
      console.log('[App] running test', t.name);
      // eslint-disable-next-line no-await-in-loop
      await handleRunTest(t);
    }
    console.log('[App] Run Suite completed');
  };

  const handleReplay = async (requestObj) => {
    console.log('[App] replaying request', requestObj.path || '(no path)');
    try {
      const relayPayload = {
        method: requestObj?.method || 'GET',
        baseUrl: requestConfig.baseUrl || '',
        path: requestObj?.path || '/',
        headers: requestObj?.headers || {},
        body: requestObj?.body,
      };
      const resp = await fetch('/api/relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(relayPayload),
      });
      const data = await resp.json();
      console.log('[App] replay response status=', data?.status);
      const replayLog = { testName: 'replay', startedAt: new Date().toISOString(), request: requestObj, finishedAt: new Date().toISOString(), response: data };
      setResults(prev => [replayLog, ...prev]);
    } catch (err) {
      const replayLog = { testName: 'replay', startedAt: new Date().toISOString(), request: requestObj, finishedAt: new Date().toISOString(), response: { error: String(err) } };
      setResults(prev => [replayLog, ...prev]);
    }
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>Test your API</h1>
        <p>Enter your API request details below and test your API to ensure your API is working as expected and securely</p>
      </header>

      <ApiRequestBuilder value={requestConfig} onRequestChange={setRequestConfig} />

      <section className="composer-section">
        <TestComposer requestConfig={requestConfig} onGenerate={addGeneratedTests} />
      </section>

      <main className="grid-two-col">
        <section className="queue">
          <QueueView tests={tests} onRun={handleRunTest} onUpdateTests={setTests} onRunSuite={handleRunSuite} />
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
