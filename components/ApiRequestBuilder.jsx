"use client";

import React, { useEffect, useState } from 'react';

export default function ApiRequestBuilder({ value, onRequestChange }) {
  const [method, setMethod] = useState('POST');
  const [baseUrl, setBaseUrl] = useState('https://api-exchange-now-sandbox.vertofx.com');
  const [path, setPath] = useState('/fx/rate');
  const [pathParams, setPathParams] = useState('');
  const [authType, setAuthType] = useState('Bearer');
  const [authValue, setAuthValue] = useState('');
  const [queryParams, setQueryParams] = useState('');
  const [requestBody, setRequestBody] = useState(JSON.stringify({
  "paymentMode": "immediate",
  "currencyFrom": {
    "currencyName": "NGN"
  },
  "currencyTo": {
    "currencyName": "USD"
  }
}, null, 2));

  // Sync local fields from parent value so updated defaults reflect automatically
  useEffect(() => {
    if (!value) return;
    if (value.method && value.method !== method) setMethod(value.method);
    if (typeof value.baseUrl === 'string' && value.baseUrl !== baseUrl) setBaseUrl(value.baseUrl);
    if (typeof value.path === 'string' && value.path !== path) setPath(value.path);
    // Body can be string (raw) or object (JSON)
    if (Object.prototype.hasOwnProperty.call(value, 'body')) {
      const nextBody = typeof value.body === 'string' ? value.body : JSON.stringify(value.body ?? null, null, 2);
      if (nextBody !== requestBody) setRequestBody(nextBody);
    }
    // Clear per-request helpers on parent change
    if (pathParams !== '') setPathParams('');
    if (queryParams !== '') setQueryParams('');
    // Auth header may be embedded in value.headers; do not auto-overwrite authValue unless needed
  }, [value]);

  const handleUpdate = () => {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (authValue.trim()) {
      headers['Authorization'] = `${authType} ${authValue.trim()}`;
    }

    let parsedBody = null;
    let bodyIsRaw = false;
    try {
      parsedBody = requestBody.trim() ? JSON.parse(requestBody) : null;
      console.log('[ApiRequestBuilder] Parsed body successfully:', parsedBody);
    } catch (e) {
      console.warn('[ApiRequestBuilder] Body is not valid JSON, keeping as raw string.');
      parsedBody = requestBody; // Keep as string if invalid
      bodyIsRaw = true;
    }

    // If body is raw string, prefer text/plain to avoid JSON parsing downstream
    if (bodyIsRaw) {
      headers['Content-Type'] = 'text/plain';
    }

    // Replace path parameters if provided
    let resolvedPath = path;
    if (pathParams.trim()) {
      try {
        const params = JSON.parse(pathParams);
        Object.keys(params).forEach(key => {
          resolvedPath = resolvedPath.replace(`:${key}`, params[key]);
          resolvedPath = resolvedPath.replace(`{${key}}`, params[key]);
        });
      } catch (e) {
        console.error('[ApiRequestBuilder] Invalid JSON in path params:', e);
      }
    }

    const fullPath = queryParams.trim() ? `${resolvedPath}?${queryParams}` : resolvedPath;

    const config = {
      method,
      baseUrl,
      path: fullPath,
      headers,
      body: parsedBody
    };

    console.log('[ApiRequestBuilder] Updated config:', config);
    onRequestChange(config);
  };

  return (
    <div className="api-builder">
      <div className="builder-row">
        <div className="builder-field">
          <label>Method</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>

        <div className="builder-field flex-grow">
          <label>Base URL</label>
          <input 
            type="text" 
            value={baseUrl} 
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com"
          />
        </div>

        <div className="builder-field flex-grow">
          <label>Path (use :param or {'{param}'} for variables)</label>
          <input 
            type="text" 
            value={path} 
            onChange={(e) => setPath(e.target.value)}
            placeholder="/users/:userId/orders/:orderId"
          />
        </div>
      </div>

      <div className="builder-row">
        <div className="builder-field flex-grow">
          <label>Path Parameters (JSON)</label>
          <input 
            type="text" 
            value={pathParams} 
            onChange={(e) => setPathParams(e.target.value)}
            placeholder='{"userId": "123", "orderId": "456"}'
          />
        </div>

        <div className="builder-field flex-grow">
          <label>Query Params</label>
          <input 
            type="text" 
            value={queryParams} 
            onChange={(e) => setQueryParams(e.target.value)}
            placeholder="key1=value1&key2=value2"
          />
        </div>
      </div>

      <div className="builder-row">
        <div className="builder-field">
          <label>Auth Type</label>
          <select value={authType} onChange={(e) => setAuthType(e.target.value)}>
            <option value="Bearer">Bearer</option>
            <option value="Basic">Basic</option>
            <option value="API-Key">API-Key</option>
          </select>
        </div>

        <div className="builder-field flex-grow">
          <label>Auth Value</label>
          <input 
            type="text" 
            value={authValue} 
            onChange={(e) => setAuthValue(e.target.value)}
            placeholder="token or credentials"
          />
        </div>
      </div>

      <div className="builder-row">
        <div className="builder-field full-width">
          <label>Request Body (JSON)</label>
          <textarea 
            value={requestBody} 
            onChange={(e) => setRequestBody(e.target.value)}
            placeholder='{"key": "value"}'
            rows={6}
          />
        </div>
      </div>

      <div className="builder-actions">
        <button className="btn primary" onClick={handleUpdate}>
          Update Request Config
        </button>
      </div>
    </div>
  );
}
