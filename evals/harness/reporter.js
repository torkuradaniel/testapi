/**
 * Eval Reporter
 * Generates CSV and JSON reports from eval results
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Generate a timestamp string for filenames
 * @returns {string} Timestamp in format YYYY-MM-DD_HH-MM-SS
 */
export function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * Ensure the reports directory exists
 * @param {string} reportsDir - Path to reports directory
 */
function ensureReportsDir(reportsDir) {
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }
}

/**
 * Generate CSV report for a single model eval
 * @param {Object} options - Report options
 * @param {string} options.model - Model name
 * @param {Array} options.tests - Generated tests
 * @param {Object} options.scores - Evaluation scores
 * @param {Object} options.metrics - API metrics (latency, tokens)
 * @param {string} options.reportsDir - Directory to save reports
 * @returns {string} Path to generated CSV file
 */
export function generateModelReport({ model, tests, scores, metrics, reportsDir }) {
  ensureReportsDir(reportsDir);

  const timestamp = getTimestamp();
  const filename = `eval-${model}-${timestamp}.csv`;
  const filepath = join(reportsDir, filename);

  // Build CSV content
  const lines = [];

  // Header section
  lines.push('# Eval Report');
  lines.push(`Model,${model}`);
  lines.push(`Timestamp,${new Date().toISOString()}`);
  lines.push(`Tests Generated,${tests.length}`);
  lines.push('');

  // Scores section
  lines.push('# Scores');
  lines.push('Metric,Value,Threshold,Status');
  lines.push(`Structure Valid,${scores.structureValid},true,${scores.structureValid ? 'PASS' : 'FAIL'}`);
  lines.push(`Coverage Score,${scores.coverageScore.toFixed(1)}%,30%,${scores.coverageScore >= 30 ? 'PASS' : 'FAIL'}`);
  lines.push(`Intent Score,${scores.intentScore.toFixed(1)}%,50%,${scores.intentScore >= 50 ? 'PASS' : 'FAIL'}`);
  lines.push(`Golden Similarity,${scores.goldenScore.toFixed(1)}%,30%,${scores.goldenScore >= 30 ? 'PASS' : 'FAIL'}`);
  lines.push(`Golden Category Coverage,${scores.goldenCoverage.toFixed(1)}%,30%,${scores.goldenCoverage >= 30 ? 'PASS' : 'FAIL'}`);
  lines.push('');

  // Metrics section
  lines.push('# API Metrics');
  lines.push('Metric,Value');
  lines.push(`Latency (ms),${metrics.latencyMs}`);
  lines.push(`Total Tokens,${metrics.totalTokens}`);
  lines.push(`Prompt Tokens,${metrics.promptTokens || 'N/A'}`);
  lines.push(`Completion Tokens,${metrics.completionTokens || 'N/A'}`);
  lines.push('');

  // Tests section
  lines.push('# Generated Tests');
  lines.push('ID,Name,Priority,Run Mode,User Requested,Tags');
  for (const test of tests) {
    const tags = (test.tags || []).join(';');
    lines.push(`${test.id},"${test.name}",${test.priority},${test.run_mode},${test.user_requested || false},"${tags}"`);
  }

  writeFileSync(filepath, lines.join('\n'));
  return filepath;
}

/**
 * Generate CSV report for model comparison
 * @param {Object} options - Report options
 * @param {Object} options.modelScores - Scores for each model
 * @param {string} options.pointer - The pointer used for testing
 * @param {string} options.reportsDir - Directory to save reports
 * @returns {string} Path to generated CSV file
 */
export function generateComparisonReport({ modelScores, pointer, reportsDir }) {
  ensureReportsDir(reportsDir);

  const timestamp = getTimestamp();
  const filename = `eval-comparison-${timestamp}.csv`;
  const filepath = join(reportsDir, filename);

  const lines = [];

  // Header section
  lines.push('# Model Comparison Report');
  lines.push(`Timestamp,${new Date().toISOString()}`);
  lines.push(`Pointer,"${pointer}"`);
  lines.push('');

  // Summary table
  lines.push('# Model Scores');
  lines.push('Model,Tests,Structure Valid,Coverage %,Intent %,Golden %,Golden Cat %,Latency (ms),Tokens,Overall %,Status');

  const models = Object.entries(modelScores)
    .filter(([, s]) => !s.error)
    .map(([model, scores]) => ({
      model,
      ...scores,
      overallScore: (scores.coverageScore + scores.intentScore + scores.goldenScore) / 3,
    }))
    .sort((a, b) => b.overallScore - a.overallScore);

  for (const m of models) {
    const status = m.structureValid && m.coverageScore >= 20 && m.intentScore >= 30 ? 'PASS' : 'FAIL';
    lines.push(
      `${m.model},${m.testCount},${m.structureValid},${m.coverageScore.toFixed(1)},${m.intentScore.toFixed(1)},${m.goldenScore.toFixed(1)},${m.goldenCoverage.toFixed(1)},${m.latencyMs},${m.tokensUsed},${m.overallScore.toFixed(1)},${status}`
    );
  }

  // Add failed models
  const failedModels = Object.entries(modelScores).filter(([, s]) => s.error);
  for (const [model, scores] of failedModels) {
    lines.push(`${model},0,false,0,0,0,0,0,0,0,FAIL - ${scores.error}`);
  }

  lines.push('');

  // Rankings
  lines.push('# Rankings');
  lines.push('');
  lines.push('By Overall Score');
  lines.push('Rank,Model,Score');
  models.forEach((m, i) => {
    lines.push(`${i + 1},${m.model},${m.overallScore.toFixed(1)}%`);
  });

  lines.push('');
  lines.push('By Latency');
  lines.push('Rank,Model,Latency (ms)');
  const byLatency = [...models].sort((a, b) => a.latencyMs - b.latencyMs);
  byLatency.forEach((m, i) => {
    lines.push(`${i + 1},${m.model},${m.latencyMs}`);
  });

  lines.push('');
  lines.push('By Token Efficiency');
  lines.push('Rank,Model,Tokens');
  const byTokens = [...models].sort((a, b) => a.tokensUsed - b.tokensUsed);
  byTokens.forEach((m, i) => {
    lines.push(`${i + 1},${m.model},${m.tokensUsed}`);
  });

  writeFileSync(filepath, lines.join('\n'));
  return filepath;
}

/**
 * Generate JSON report (for programmatic access)
 * @param {Object} data - Report data
 * @param {string} filename - Filename without extension
 * @param {string} reportsDir - Directory to save reports
 * @returns {string} Path to generated JSON file
 */
export function generateJsonReport(data, filename, reportsDir) {
  ensureReportsDir(reportsDir);

  const timestamp = getTimestamp();
  const fullFilename = `${filename}-${timestamp}.json`;
  const filepath = join(reportsDir, fullFilename);

  writeFileSync(filepath, JSON.stringify(data, null, 2));
  return filepath;
}
