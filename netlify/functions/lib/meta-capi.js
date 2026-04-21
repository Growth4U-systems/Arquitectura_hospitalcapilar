/**
 * Meta Conversions API (CAPI) — server-side event forwarding.
 *
 * Sends conversion events directly from Netlify functions to Meta,
 * bypassing browser pixel restrictions (EU data sharing, ad blockers, iOS).
 *
 * Required env vars:
 *   META_ACCESS_TOKEN  — System User token with ads_management permission (already deployed for sync-ad-spend)
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
 */
const crypto = require('crypto');

const GRAPH_VERSION = 'v21.0';

// HARDCODED: Netlify env vars are saturated in this project (build breaks if we add more).
// Pixel ID is public-ish — fine to commit. Get the value by hitting:
//   /.netlify/functions/debug-meta-pixels?key=hc-dashboard-2026
// then paste the `id` of the diagnostico-related pixel below.
const META_PIXEL_ID = 'PASTE_PIXEL_ID_HERE';

function sha256(value) {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
}

/**
 * Normalize phone to digits-only (Meta expects E.164 without "+").
 *   "+34 612 345 678" → "34612345678"
 */
function normalizePhone(phone) {
  if (!phone) return undefined;
  return String(phone).replace(/\D/g, '');
}

/**
 * Build the Meta `fbc` (Facebook click ID cookie) value from a fbclid.
 *   Format: fb.1.{unix_ms}.{fbclid}
 */
function buildFbc(fbclid, eventTimeMs = Date.now()) {
  if (!fbclid) return undefined;
  return `fb.1.${eventTimeMs}.${fbclid}`;
}

/**
 * Send a conversion event to Meta CAPI.
 * Fire-and-forget by default — does not throw on network/HTTP errors.
 *
 * @param {string} eventName - Standard Meta event: Lead, Schedule, Purchase, CompleteRegistration, etc.
 * @param {object} options
 * @param {string} options.email
 * @param {string} options.phone
 * @param {string} [options.fbclid]
 * @param {string} [options.fbp]               - _fbp cookie (browser pixel ID), if available
 * @param {string} [options.ipAddress]
 * @param {string} [options.userAgent]
 * @param {string} [options.eventSourceUrl]    - URL where the conversion occurred
 * @param {string} [options.eventId]           - Stable unique ID for deduplication with browser pixel
 * @param {object} [options.customData]        - Additional event-specific data (value, currency, content_name, etc.)
 * @param {string} [options.actionSource]      - 'website' | 'system_generated' | 'physical_store' (default 'website')
 * @returns {Promise<{ ok: boolean, status?: number, error?: string, events_received?: number }>}
 */
async function sendMetaEvent(eventName, options = {}) {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const pixelId = META_PIXEL_ID;

  if (!accessToken || !pixelId || pixelId === 'PASTE_PIXEL_ID_HERE') {
    console.log(`[Meta CAPI] Skipped ${eventName}: missing META_ACCESS_TOKEN or META_PIXEL_ID not set`);
    return { ok: false, error: 'missing_config' };
  }

  const {
    email,
    phone,
    fbclid,
    fbp,
    ipAddress,
    userAgent,
    eventSourceUrl,
    eventId,
    customData = {},
    actionSource = 'website',
  } = options;

  const eventTime = Math.floor(Date.now() / 1000);

  const userData = {};
  const emailHash = sha256(email);
  const phoneHash = sha256(normalizePhone(phone));
  if (emailHash) userData.em = [emailHash];
  if (phoneHash) userData.ph = [phoneHash];
  if (fbclid) userData.fbc = buildFbc(fbclid, eventTime * 1000);
  if (fbp) userData.fbp = fbp;
  if (ipAddress) userData.client_ip_address = ipAddress;
  if (userAgent) userData.client_user_agent = userAgent;

  // Meta requires at least one user identifier to match the event
  if (Object.keys(userData).length === 0) {
    console.log(`[Meta CAPI] Skipped ${eventName}: no user identifiers provided`);
    return { ok: false, error: 'no_user_data' };
  }

  const eventData = {
    event_name: eventName,
    event_time: eventTime,
    action_source: actionSource,
    user_data: userData,
    custom_data: customData,
  };
  if (eventSourceUrl) eventData.event_source_url = eventSourceUrl;
  if (eventId) eventData.event_id = eventId;

  const payload = { data: [eventData] };

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.log(`[Meta CAPI] ${eventName} failed (${res.status}):`, JSON.stringify(body).substring(0, 300));
      return { ok: false, status: res.status, error: body.error?.message || 'http_error' };
    }

    console.log(`[Meta CAPI] ${eventName} sent (events_received: ${body.events_received}, fbtrace: ${body.fbtrace_id})`);
    return { ok: true, status: res.status, events_received: body.events_received };
  } catch (err) {
    console.log(`[Meta CAPI] ${eventName} exception:`, err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Extract client IP + user-agent from a Netlify function event object.
 * Netlify provides client IP via x-nf-client-connection-ip header.
 */
function extractClientContext(netlifyEvent) {
  const headers = netlifyEvent?.headers || {};
  return {
    ipAddress: headers['x-nf-client-connection-ip'] || headers['x-forwarded-for']?.split(',')[0]?.trim(),
    userAgent: headers['user-agent'],
  };
}

module.exports = {
  sendMetaEvent,
  extractClientContext,
  buildFbc,
};
