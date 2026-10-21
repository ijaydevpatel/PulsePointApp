#!/usr/bin/env node
/*
 * D03 - turns the raw PP-LATENCY lines collected from Logcat into a summary
 * and a CSV, so the timing figure in the report is reproducible instead of
 * remembered.
 *
 * Reads  docs/latency-raw.txt
 * Writes docs/latency-benchmark.csv and docs/latency-benchmark.json
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const raw = path.join(root, 'docs', 'latency-raw.txt');

if (!fs.existsSync(raw)) {
  console.error('docs/latency-raw.txt not found. Run collect-latency.bat first.');
  process.exit(2);
}

// Logcat prefixes each line with its own metadata, so match anywhere on it.
const LINE = /PP-LATENCY\s+(GET|POST)\s+(\S+)\s+(\d+)/;

const rows = [];
for (const line of fs.readFileSync(raw, 'utf8').split(/\r?\n/)) {
  const m = LINE.exec(line);
  if (m) rows.push({ method: m[1], route: m[2], ms: parseInt(m[3], 10) });
}

if (!rows.length) {
  console.error('No PP-LATENCY lines found. Did you use the app while recording?');
  process.exit(3);
}

/*
 * The client aborts any request at 30 s (DEFAULT_TIMEOUT_MS, and
 * ANALYSIS_TIMEOUT_MS for analyse). A recorded duration longer than that
 * cannot be a round trip, because the request would already have been
 * cancelled. It means the app was backgrounded mid-call and JS timers were
 * frozen, so the clock kept running while nothing was in flight.
 *
 * Those samples are excluded from the statistics and counted separately, so
 * the exclusion is visible rather than silent.
 */
const CLIENT_TIMEOUT_MS = 30000;

function percentile(sorted, p) {
  const i = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(i, 0), sorted.length - 1)];
}

function stats(list) {
  const s = [...list].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return {
    n: s.length,
    min_ms: s[0],
    median_ms: percentile(s, 50),
    p95_ms: percentile(s, 95),
    max_ms: s[s.length - 1],
    mean_ms: Math.round(mean),
  };
}

const measured = rows.filter((r) => r.ms <= CLIENT_TIMEOUT_MS);
const suspended = rows.filter((r) => r.ms > CLIENT_TIMEOUT_MS);

if (!measured.length) {
  console.error(`All ${rows.length} samples exceed the ${CLIENT_TIMEOUT_MS} ms client`);
  console.error('timeout, so none of them are real round trips. Record again and');
  console.error('keep the app in the foreground the whole time.');
  process.exit(4);
}

const byRoute = {};
for (const r of measured) {
  const key = `${r.method} ${r.route}`;
  (byRoute[key] = byRoute[key] || []).push(r.ms);
}

const summary = {
  collected: new Date().toISOString(),
  total_calls: rows.length,
  measured_calls: measured.length,
  excluded_app_suspended: suspended.length,
  exclusion_rule: `samples over ${CLIENT_TIMEOUT_MS} ms, the client abort timeout, cannot be round trips`,
  overall: stats(measured.map((r) => r.ms)),
  by_route: Object.fromEntries(
    Object.entries(byRoute).map(([k, v]) => [k, stats(v)]),
  ),
};

const pad = (s, n) => String(s).padEnd(n);
console.log('');
console.log(pad('Route', 34), pad('n', 5), pad('min', 7), pad('median', 8), pad('p95', 8), 'max');
for (const [k, v] of Object.entries(summary.by_route)) {
  console.log(pad(k, 34), pad(v.n, 5), pad(v.min_ms, 7), pad(v.median_ms, 8), pad(v.p95_ms, 8), v.max_ms);
}
const o = summary.overall;
console.log('');
console.log(pad('ALL ROUTES', 34), pad(o.n, 5), pad(o.min_ms, 7), pad(o.median_ms, 8), pad(o.p95_ms, 8), o.max_ms);
console.log('');
if (suspended.length) {
  console.log(`Excluded ${suspended.length} sample(s) over ${CLIENT_TIMEOUT_MS} ms.`);
  console.log('The client aborts at that point, so a longer reading means the app');
  console.log('was backgrounded and JS timers froze. Not a round trip.');
}
const thin = Object.entries(summary.by_route).filter(([, v]) => v.n < 5);
if (thin.length) {
  console.log('');
  console.log('Too few samples to support a p95 (needs 5 or more):');
  for (const [k, v] of thin) console.log(`  ${k}  n=${v.n}`);
}
console.log('');
console.log('QR1 asks for a result within 500 ms at the 95th percentile.');
console.log(o.p95_ms <= 500
  ? `  Overall p95 is ${o.p95_ms} ms, inside QR1.`
  : `  Overall p95 is ${o.p95_ms} ms, outside QR1. This is the hosted round trip, not local scoring.`);

fs.writeFileSync(
  path.join(root, 'docs', 'latency-benchmark.csv'),
  'method,route,elapsed_ms\n' + rows.map((r) => `${r.method},${r.route},${r.ms}`).join('\n') + '\n',
  'utf8',
);
fs.writeFileSync(
  path.join(root, 'docs', 'latency-benchmark.json'),
  JSON.stringify(summary, null, 2) + '\n',
  'utf8',
);

console.log('');
console.log('Wrote docs/latency-benchmark.csv');
console.log('Wrote docs/latency-benchmark.json');
