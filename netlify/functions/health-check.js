/**
 * Health Check — verifies all external integrations are reachable.
 *
 * GET /.netlify/functions/health-check
 *
 * Returns JSON with status of each integration:
 * - GHL (GoHighLevel CRM)
 * - Koibox (Clinic booking)
 * - Stripe (Payments)
 * - Firebase/Firestore (Database)
 * - PostHog (Analytics)
 * - Resend (Email)
 *
 * Can be called manually before launch or by a cron monitor.
 */
const { getFirestore } = require('./lib/firebase-admin');
const { sendAlert } = require('./lib/alert');

const TIMEOUT_MS = 8000;

async function checkWithTimeout(name, checkFn) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const result = await checkFn(controller.signal);
    clearTimeout(timer);
    return {
      status: 'ok',
      latency_ms: Date.now() - start,
      ...result,
    };
  } catch (err) {
    return {
      status: 'error',
      latency_ms: Date.now() - start,
      error: err.name === 'AbortError' ? `Timeout (${TIMEOUT_MS}ms)` : err.message,
    };
  }
}

async function checkGHL(signal) {
  const apiKey = process.env.VITE_GHL_API_KEY;
  if (!apiKey) return { status: 'skip', reason: 'VITE_GHL_API_KEY not set' };

  const res = await fetch('https://services.leadconnectorhq.com/contacts/?limit=1&locationId=' + (process.env.VITE_GHL_LOCATION_ID || 'U4SBRYIlQtGBDHLFwEUf'), {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Version': '2021-07-28',
    },
    signal,
  });
  if (!res.ok) throw new Error(`GHL returned ${res.status}`);
  return { contacts_accessible: true };
}

async function checkKoibox(signal) {
  const apiKey = process.env.KOIBOX_API_KEY;
  if (!apiKey) return { status: 'skip', reason: 'KOIBOX_API_KEY not set' };

  const res = await fetch('https://api.koibox.cloud/api/clientes/?limit=1', {
    headers: { 'X-Koibox-Key': apiKey },
    signal,
  });
  if (!res.ok) throw new Error(`Koibox returned ${res.status}`);
  return { clients_accessible: true };
}

async function checkStripe(signal) {
  const stripeKey = process.env.STRIPE_RK_KEY;
  if (!stripeKey) return { status: 'skip', reason: 'STRIPE_RK_KEY not set' };

  const res = await fetch('https://api.stripe.com/v1/balance', {
    headers: { 'Authorization': `Bearer ${stripeKey}` },
    signal,
  });
  if (!res.ok) throw new Error(`Stripe returned ${res.status}`);
  return { balance_accessible: true };
}

async function checkFirestore() {
  const db = getFirestore();
  if (!db) return { status: 'skip', reason: 'FIREBASE_SERVICE_ACCOUNT not set' };

  const snapshot = await db.collection('quiz_leads').limit(1).get();
  return { collection_accessible: true, docs: snapshot.size };
}

async function checkPostHog(signal) {
  const key = process.env.VITE_POSTHOG_KEY;
  if (!key) return { status: 'skip', reason: 'VITE_POSTHOG_KEY not set' };

  const res = await fetch('https://eu.i.posthog.com/decide/?v=3', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: key, distinct_id: 'health-check' }),
    signal,
  });
  if (!res.ok) throw new Error(`PostHog returned ${res.status}`);
  return { decide_accessible: true };
}

async function checkResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { status: 'skip', reason: 'RESEND_API_KEY not set' };

  // Resend doesn't have a lightweight health endpoint, just verify the key format
  return { key_configured: apiKey.startsWith('re_') };
}

async function checkEnvVars() {
  const required = [
    'VITE_GHL_API_KEY',
    'VITE_GHL_LOCATION_ID',
    'STRIPE_RK_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'KOIBOX_API_KEY',
    'VITE_POSTHOG_KEY',
    'RESEND_API_KEY',
    'FIREBASE_SERVICE_ACCOUNT',
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_PROJECT_ID',
  ];

  const missing = required.filter(key => !process.env[key]);
  return {
    status: missing.length === 0 ? 'ok' : 'warning',
    total: required.length,
    configured: required.length - missing.length,
    missing: missing.length > 0 ? missing : undefined,
  };
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  console.log('[HealthCheck] Starting checks...');

  const [ghl, koibox, stripe, firestore, posthog, resend, envVars] = await Promise.all([
    checkWithTimeout('GHL', checkGHL),
    checkWithTimeout('Koibox', checkKoibox),
    checkWithTimeout('Stripe', checkStripe),
    checkWithTimeout('Firestore', checkFirestore),
    checkWithTimeout('PostHog', checkPostHog),
    checkWithTimeout('Resend', checkResend),
    checkEnvVars(),
  ]);

  const results = { ghl, koibox, stripe, firestore, posthog, resend, env_vars: envVars };

  // Calculate overall status
  const checks = [ghl, koibox, stripe, firestore, posthog, resend];
  const failures = checks.filter(c => c.status === 'error');
  const overall = failures.length === 0 ? 'healthy' : failures.length <= 2 ? 'degraded' : 'critical';

  const response = {
    status: overall,
    timestamp: new Date().toISOString(),
    checks: results,
    failures: failures.length,
  };

  console.log('[HealthCheck] Result:', overall, `(${failures.length} failures)`);

  // Send alert if any critical service is down
  if (failures.length > 0) {
    const failedNames = Object.entries(results)
      .filter(([_, v]) => v.status === 'error')
      .map(([k]) => k);

    await sendAlert('health-check', `${failures.length} service(s) down: ${failedNames.join(', ')}`, {
      severity: overall === 'critical' ? 'critical' : 'warning',
      failed_services: failedNames,
      details: Object.fromEntries(
        failedNames.map(name => [name, results[name]])
      ),
    });
  }

  return {
    statusCode: overall === 'critical' ? 503 : 200,
    headers,
    body: JSON.stringify(response, null, 2),
  };
};
