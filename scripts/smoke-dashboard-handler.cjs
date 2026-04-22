#!/usr/bin/env node
// Smoke-test the dashboard-data handler end-to-end.
// The repo is ESM (package.json type=module) so require() doesn't see the
// CommonJS exports.handler — we wrap the source ourselves.

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.join(__dirname, '..', 'netlify', 'functions', 'dashboard-data.js'),
  'utf8'
);
const moduleRef = { exports: {} };
const factory = new Function('exports', 'module', 'require', 'fetch', 'process', src);
factory(moduleRef.exports, moduleRef, require, global.fetch, process);

const handler = moduleRef.exports.handler;
if (typeof handler !== 'function') {
  console.error('handler not exported');
  process.exit(1);
}

(async () => {
  const secret = process.env.DASHBOARD_SECRET || 'hc-dashboard-2026';
  const res = await handler({
    queryStringParameters: { key: secret, days: '30' },
  });
  if (res.statusCode !== 200) {
    console.error('status', res.statusCode, res.body?.substring(0, 500));
    process.exit(1);
  }
  const data = JSON.parse(res.body);
  console.log('top-level keys:', Object.keys(data).sort());
  console.log('\n─── executive_header ───');
  console.log(JSON.stringify(data.executive_header, null, 2).substring(0, 2000));
  console.log('\n─── master rows count:', (data.by_funnel_dimensions || []).length);
  const sample = (data.by_funnel_dimensions || []).slice(0, 3);
  console.log('first 3 rows:', JSON.stringify(sample, null, 2));
  console.log('\n─── quiz_dropoff first 5:');
  console.log((data.quiz_dropoff || []).slice(0, 5));
  console.log('\n─── ad_spend_by_campaign count:', (data.ad_spend_by_campaign || []).length);
})().catch(e => { console.error(e.message); process.exit(1); });
