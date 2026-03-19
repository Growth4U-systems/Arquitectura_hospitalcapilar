/**
 * GHL Webhook — receives pipeline stage changes and forwards to PostHog.
 *
 * Configure in GHL: Automation → Webhook action when opportunity stage changes.
 * URL: https://diagnostico.hospitalcapilar.com/.netlify/functions/ghl-webhook
 *
 * Expected payload (from GHL workflow):
 * {
 *   "type": "opportunity_stage_changed",
 *   "contact_email": "...",
 *   "contact_name": "...",
 *   "stage": "Attended" | "No-Show" | "Won" | "Lost",
 *   "opportunity_id": "...",
 *   "pipeline_id": "..."
 * }
 */
const { getLeadSourceByEmail } = require('./lib/firebase-admin');

const POSTHOG_HOST = 'https://eu.i.posthog.com';

// Map GHL stages to PostHog events
const STAGE_EVENT_MAP = {
  'attended':  'appointment_attended',
  'no-show':   'appointment_no_show',
  'won':       'patient_converted',
  'lost':      'patient_lost',
};

function trackServerEvent(eventName, properties = {}, distinctId = null) {
  const posthogKey = process.env.VITE_POSTHOG_KEY;
  if (!posthogKey) return;

  const payload = {
    api_key: posthogKey,
    event: eventName,
    properties: {
      ...properties,
      distinct_id: distinctId || 'server-anonymous',
      $lib: 'server-netlify',
      timestamp: new Date().toISOString(),
    },
  };

  fetch(`${POSTHOG_HOST}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(err => console.log('[PostHog] Server capture failed:', err.message));
}

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { contact_email, contact_name, stage, opportunity_id } = body;

    if (!stage) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'stage required' }) };
    }

    const stageLower = stage.toLowerCase();
    const eventName = STAGE_EVENT_MAP[stageLower];

    if (!eventName) {
      console.log('[GHL Webhook] Unknown stage:', stage);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ skipped: true, reason: 'unknown_stage' }) };
    }

    // Enrich with lead attribution from Firestore
    const leadSource = await getLeadSourceByEmail(contact_email);

    trackServerEvent(eventName, {
      contact_name: contact_name || '',
      opportunity_id: opportunity_id || '',
      stage,
      ...leadSource,
    }, contact_email);

    console.log(`[GHL Webhook] ${eventName} tracked for ${contact_email}`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, event: eventName }),
    };
  } catch (err) {
    console.log('[GHL Webhook] Error:', err.message);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};
