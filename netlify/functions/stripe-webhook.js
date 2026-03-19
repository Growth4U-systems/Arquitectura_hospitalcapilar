const crypto = require('crypto');
const { updateLeadByEmail, getLeadSourceByEmail } = require('./lib/firebase-admin');

const GHL_BASE = 'https://services.leadconnectorhq.com';
const KOIBOX_BASE = 'https://api.koibox.cloud/api';
const POSTHOG_HOST = 'https://eu.i.posthog.com';

// GHL opportunity custom field IDs
const OPP_CF = {
  tratamiento_status: 'Hk81fRW2HaTqlry4I1L0',
  koibox_id:          'x1MAP0Om3rUW3a10ZiUe',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_RK_KEY;
  const ghlKey = process.env.VITE_GHL_API_KEY;

  if (!stripeSecret || !stripeKey) {
    console.log('[Stripe Webhook] Missing environment variables');
    return { statusCode: 500, body: 'Server configuration error' };
  }

  // Verify Stripe webhook signature
  const sig = event.headers['stripe-signature'];
  if (!sig) {
    return { statusCode: 400, body: 'Missing stripe-signature header' };
  }

  try {
    const stripeEvent = verifyWebhookSignature(event.body, sig, stripeSecret);

    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      console.log('[Stripe Webhook] Payment completed:', session.id, 'email:', session.customer_email);

      const contactId = session.metadata?.contactId || session.payment_intent?.metadata?.contactId;

      // Update GHL opportunity payment_status + get koibox_id for Koibox sync
      let koiboxId = null;
      if (contactId && ghlKey) {
        koiboxId = await updateGHLOpportunity(contactId, ghlKey, session.amount_total);
      }

      // Add note to contact in GHL + manage tags
      if (contactId && ghlKey) {
        await addGHLNote(contactId, ghlKey, session);
        await updatePaymentTags(contactId, ghlKey);
      }

      // Sync payment to Koibox (appointment notes + client notes)
      await syncPaymentToKoibox(session.customer_email, koiboxId, session);

      // Update Firestore lead: paymentStatus → paid
      await updateLeadByEmail(session.customer_email, {
        paymentStatus: 'paid',
        paymentAmount: session.amount_total / 100,
        stripeSessionId: session.id,
        paymentDate: new Date().toISOString(),
      });

      // Track in PostHog server-side (enrich with lead attribution)
      const leadSource = await getLeadSourceByEmail(session.customer_email);
      trackServerEvent('payment_completed', {
        amount: session.amount_total / 100,
        currency: session.currency,
        stripe_session_id: session.id,
        ecp: session.metadata?.ecp || '',
        ubicacion: session.metadata?.ubicacion || '',
        ghl_contact_id: contactId || '',
        ...leadSource,
      }, session.customer_email);
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err) {
    console.log('[Stripe Webhook] Error:', err.message);
    return { statusCode: 400, body: `Webhook error: ${err.message}` };
  }
};

/**
 * Verify Stripe webhook signature (without stripe SDK)
 */
function verifyWebhookSignature(payload, sigHeader, secret) {
  const elements = sigHeader.split(',').reduce((acc, part) => {
    const [key, value] = part.split('=');
    acc[key.trim()] = value;
    return acc;
  }, {});

  const timestamp = elements['t'];
  const signature = elements['v1'];

  if (!timestamp || !signature) {
    throw new Error('Invalid signature format');
  }

  // Reject timestamps older than 5 minutes
  const tolerance = 300;
  const now = Math.floor(Date.now() / 1000);
  if (now - parseInt(timestamp) > tolerance) {
    throw new Error('Timestamp outside tolerance');
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  if (expectedSignature !== signature) {
    throw new Error('Signature verification failed');
  }

  return JSON.parse(payload);
}

/**
 * Find and update the opportunity's tratamiento_status to 'paid'.
 * Returns the koibox_id from the opportunity (if a Koibox appointment already exists).
 */
async function updateGHLOpportunity(contactId, apiKey, amountCents) {
  const ghlHeaders = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Version': '2021-07-28',
  };

  const locationId = process.env.VITE_GHL_LOCATION_ID || 'U4SBRYIlQtGBDHLFwEUf';
  const amount = amountCents / 100;

  try {
    // Search for open opportunities for this contact
    const searchRes = await fetch(
      `${GHL_BASE}/opportunities/search?location_id=${locationId}&contact_id=${contactId}&status=open`,
      { headers: ghlHeaders }
    );
    const searchData = await searchRes.json();
    const opportunities = searchData?.opportunities || [];

    if (opportunities.length === 0) {
      console.log('[Stripe Webhook] No open opportunities found for contact:', contactId);
      return null;
    }

    const opp = opportunities[0];

    // GET opportunity details to read koibox_id custom field
    let koiboxId = null;
    try {
      const detailRes = await fetch(`${GHL_BASE}/opportunities/${opp.id}`, { headers: ghlHeaders });
      if (detailRes.ok) {
        const detail = await detailRes.json();
        const cfs = detail?.opportunity?.customFields || [];
        const koiboxField = cfs.find(f => f.id === OPP_CF.koibox_id);
        koiboxId = koiboxField?.value || null;
      }
    } catch (err) {
      console.log('[Stripe Webhook] Failed to read opportunity details:', err.message);
    }

    // Update opportunity with payment status
    const updateRes = await fetch(`${GHL_BASE}/opportunities/${opp.id}`, {
      method: 'PUT',
      headers: ghlHeaders,
      body: JSON.stringify({
        monetaryValue: amount,
        customFields: [
          { id: OPP_CF.tratamiento_status, field_value: 'paid' },
        ],
      }),
    });
    console.log('[Stripe Webhook] Opportunity updated:', opp.id, 'status:', updateRes.status, 'koiboxId:', koiboxId);

    return koiboxId;
  } catch (err) {
    console.log('[Stripe Webhook] GHL opportunity update failed:', err.message);
    return null;
  }
}

/**
 * Add a payment confirmation note to the GHL contact
 */
async function addGHLNote(contactId, apiKey, session) {
  const ghlHeaders = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Version': '2021-07-28',
  };

  try {
    const amount = (session.amount_total / 100).toFixed(2);
    const noteBody = `💳 PAGO CONFIRMADO — Bono Diagnóstico ${amount}€\nEmail: ${session.customer_email}\nStripe Session: ${session.id}\nFecha: ${new Date().toISOString()}`;

    await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: ghlHeaders,
      body: JSON.stringify({ body: noteBody }),
    });
    console.log('[Stripe Webhook] Payment note added to contact:', contactId);
  } catch (err) {
    console.log('[Stripe Webhook] Note creation failed:', err.message);
  }
}

/**
 * Update GHL tags: remove bono_pendiente, add bono_pagado.
 */
async function updatePaymentTags(contactId, apiKey) {
  const ghlHeaders = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Version': '2021-07-28',
  };

  try {
    // Remove bono_pendiente tag
    await fetch(`${GHL_BASE}/contacts/${contactId}/tags`, {
      method: 'DELETE',
      headers: ghlHeaders,
      body: JSON.stringify({ tags: ['bono_pendiente'] }),
    });
    // Add bono_pagado tag
    await fetch(`${GHL_BASE}/contacts/${contactId}/tags`, {
      method: 'POST',
      headers: ghlHeaders,
      body: JSON.stringify({ tags: ['bono_pagado'] }),
    });
    console.log('[Stripe Webhook] Tags updated: bono_pendiente → bono_pagado for contact:', contactId);
  } catch (err) {
    console.log('[Stripe Webhook] Tag update failed:', err.message);
  }
}

/**
 * Sync payment confirmation to Koibox:
 * - If appointment exists (koiboxId): update appointment notes
 * - Search client by email: update client notes
 */
async function syncPaymentToKoibox(email, koiboxId, session) {
  const koiboxKey = process.env.KOIBOX_API_KEY;
  if (!koiboxKey) {
    console.log('[Stripe→Koibox] No KOIBOX_API_KEY, skipping sync');
    return;
  }

  const koiboxHeaders = {
    'X-Koibox-Key': koiboxKey,
    'Content-Type': 'application/json',
  };

  const amount = ((session.amount_total || 0) / 100).toFixed(2);
  const paymentNote = `✅ BONO DIAGNÓSTICO PAGADO (${amount}€) — Stripe: ${session.id} — ${new Date().toISOString()}`;

  // 1. Update appointment notes if koibox appointment exists
  if (koiboxId) {
    try {
      // GET current appointment to preserve existing notes
      const getRes = await fetch(`${KOIBOX_BASE}/agenda/${koiboxId}/`, { headers: koiboxHeaders });
      if (getRes.ok) {
        const appt = await getRes.json();
        const existingNotes = appt.notas || '';
        await fetch(`${KOIBOX_BASE}/agenda/${koiboxId}/`, {
          method: 'PATCH',
          headers: koiboxHeaders,
          body: JSON.stringify({ notas: `${existingNotes}\n${paymentNote}`.trim() }),
        });
        console.log('[Stripe→Koibox] Appointment notes updated:', koiboxId);
      }
    } catch (err) {
      console.log('[Stripe→Koibox] Appointment update failed:', err.message);
    }
  }

  // 2. Update client notes
  if (email) {
    try {
      const searchRes = await fetch(
        `${KOIBOX_BASE}/clientes/?email=${encodeURIComponent(email)}`,
        { headers: koiboxHeaders }
      );
      if (searchRes.ok) {
        const data = await searchRes.json();
        if (data.count > 0) {
          const client = data.results[0];
          const existingNotes = client.notas || '';
          await fetch(`${KOIBOX_BASE}/clientes/${client.id}/`, {
            method: 'PATCH',
            headers: koiboxHeaders,
            body: JSON.stringify({ notas: `${existingNotes}\n${paymentNote}`.trim() }),
          });
          console.log('[Stripe→Koibox] Client notes updated:', client.id);
        }
      }
    } catch (err) {
      console.log('[Stripe→Koibox] Client update failed:', err.message);
    }
  }
}

/**
 * Track an event server-side to PostHog.
 * Fire-and-forget: does not block the response.
 */
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
