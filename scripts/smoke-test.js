#!/usr/bin/env node

/**
 * Pre-Launch Smoke Test
 *
 * Runs a comprehensive check of all critical paths before go-live.
 * Execute: node scripts/smoke-test.js [BASE_URL]
 *
 * Default: https://diagnostico.hospitalcapilar.com
 * Local:   node scripts/smoke-test.js http://localhost:8888
 */

const BASE_URL = process.argv[2] || 'https://diagnostico.hospitalcapilar.com';
const TIMEOUT_MS = 15000;

const results = [];
let passed = 0;
let failed = 0;
let warned = 0;

// ─── Helpers ─────────────────────────────────────────────

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function test(name, fn) {
  try {
    const result = await fn();
    if (result.warn) {
      warned++;
      results.push({ name, status: '⚠️  WARN', detail: result.warn });
      console.log(`⚠️  WARN  ${name}: ${result.warn}`);
    } else {
      passed++;
      results.push({ name, status: '✅ PASS', detail: result.detail || '' });
      console.log(`✅ PASS  ${name}${result.detail ? ' — ' + result.detail : ''}`);
    }
  } catch (err) {
    failed++;
    const msg = err.name === 'AbortError' ? `Timeout (${TIMEOUT_MS}ms)` : err.message;
    results.push({ name, status: '❌ FAIL', detail: msg });
    console.log(`❌ FAIL  ${name}: ${msg}`);
  }
}

// ─── Page Load Tests ─────────────────────────────────────

async function testPageLoads(path, expectedText) {
  const res = await fetchWithTimeout(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  if (expectedText && !html.includes(expectedText)) {
    throw new Error(`Missing expected text: "${expectedText}"`);
  }
  return { detail: `${res.status} OK (${(html.length / 1024).toFixed(0)}KB)` };
}

// ─── API Tests ───────────────────────────────────────────

async function testHealthCheck() {
  const res = await fetchWithTimeout(`${BASE_URL}/.netlify/functions/health-check`);
  const data = await res.json();

  const failures = Object.entries(data.checks)
    .filter(([_, v]) => v.status === 'error')
    .map(([k]) => k);

  if (failures.length > 0) {
    throw new Error(`Services down: ${failures.join(', ')}`);
  }

  const skipped = Object.entries(data.checks)
    .filter(([_, v]) => v.status === 'skip')
    .map(([k]) => k);

  if (skipped.length > 0) {
    return { warn: `Skipped (no API keys): ${skipped.join(', ')}` };
  }

  return { detail: `All ${Object.keys(data.checks).length} services healthy` };
}

async function testGHLProxy() {
  // Test with OPTIONS (CORS preflight) — doesn't create a lead
  const res = await fetchWithTimeout(`${BASE_URL}/.netlify/functions/ghl-proxy`, {
    method: 'OPTIONS',
  });
  if (res.status !== 204) throw new Error(`Expected 204, got ${res.status}`);
  return { detail: 'CORS preflight OK' };
}

async function testStripeCheckout() {
  // Test with OPTIONS (CORS preflight)
  const res = await fetchWithTimeout(`${BASE_URL}/.netlify/functions/stripe-checkout`, {
    method: 'OPTIONS',
  });
  if (res.status !== 204) throw new Error(`Expected 204, got ${res.status}`);
  return { detail: 'CORS preflight OK' };
}

async function testKoiboxProxy() {
  // Test with invalid action — should return 400, not 500
  const res = await fetchWithTimeout(`${BASE_URL}/.netlify/functions/koibox-proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'smoke_test' }),
  });
  if (res.status === 500) throw new Error('Server error — function may be misconfigured');
  if (res.status === 400) return { detail: 'Function reachable, validation working' };
  return { detail: `Status ${res.status}` };
}

async function testStaticAssets() {
  const res = await fetchWithTimeout(`${BASE_URL}/logo-hc.svg`);
  if (!res.ok) throw new Error(`Logo not found: ${res.status}`);
  return { detail: 'logo-hc.svg accessible' };
}

async function testPostHogProxy() {
  const res = await fetchWithTimeout(`${BASE_URL}/ingest/decide/?v=3`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: 'smoke_test', distinct_id: 'test' }),
  });
  // PostHog proxy should forward and return something, not 404
  if (res.status === 404) throw new Error('PostHog proxy not configured — /ingest/ returns 404');
  return { detail: `PostHog proxy responding (${res.status})` };
}

// ─── Run All Tests ───────────────────────────────────────

async function main() {
  console.log(`\n🔍 Smoke Test — ${BASE_URL}\n${'─'.repeat(60)}\n`);

  // 1. Pages
  console.log('📄 Pages\n');
  await test('Home page (/)', () => testPageLoads('/', 'Hospital Capilar'));
  await test('Nicho: el-espejo', () => testPageLoads('/el-espejo', 'Hospital Capilar'));
  await test('Nicho: es-normal', () => testPageLoads('/es-normal', 'Hospital Capilar'));
  await test('Quiz rápido: que-me-pasa', () => testPageLoads('/rapido/que-me-pasa', 'Hospital Capilar'));
  await test('Form directo: el-espejo', () => testPageLoads('/form/el-espejo', 'Hospital Capilar'));
  await test('Agendar page', () => testPageLoads('/agendar', 'Hospital Capilar'));

  // 2. APIs
  console.log('\n🔌 API Endpoints\n');
  await test('Health Check', testHealthCheck);
  await test('GHL Proxy (CORS)', testGHLProxy);
  await test('Stripe Checkout (CORS)', testStripeCheckout);
  await test('Koibox Proxy (validation)', testKoiboxProxy);

  // 3. Assets & Infra
  console.log('\n🏗️  Infrastructure\n');
  await test('Static assets (logo)', testStaticAssets);
  await test('PostHog reverse proxy', testPostHogProxy);

  // Summary
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${warned} warnings\n`);

  if (failed > 0) {
    console.log('❌ SMOKE TEST FAILED — Do NOT deploy until all failures are resolved.\n');
    process.exit(1);
  } else if (warned > 0) {
    console.log('⚠️  SMOKE TEST PASSED WITH WARNINGS — Review before deploying.\n');
    process.exit(0);
  } else {
    console.log('✅ ALL CHECKS PASSED — Ready for launch! 🚀\n');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('\n💥 Smoke test crashed:', err.message);
  process.exit(1);
});
