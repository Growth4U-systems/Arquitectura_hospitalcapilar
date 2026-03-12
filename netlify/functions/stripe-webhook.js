const crypto = require('crypto');
const { updateLeadByEmail } = require('./lib/firebase-admin');

const GHL_BASE = 'https://services.leadconnectorhq.com';
const POSTHOG_HOST = 'https://eu.i.posthog.com';

// Opportunity custom field IDs (same as ghl-proxy.js)
const OPP_CF = {
  tratamiento_status: 'Hk81fRW2HaTqlry4I1L0',
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

      // Update GHL opportunity status to 'paid'
      if (contactId && ghlKey) {
        await updateGHLOpportunity(contactId, ghlKey);
      }

      // Add note to contact in GHL
      if (contactId && ghlKey) {
        await addGHLNote(contactId, ghlKey, session);
      }

      // Update Firestore lead: paymentStatus → paid
      await updateLeadByEmail(session.customer_email, {
        paymentStatus: 'paid',
        paymentAmount: session.amount_total / 100,
        stripeSessionId: session.id,
        paymentDate: new Date().toISOString(),
      });

      // Track in PostHog server-side
      trackServerEvent('payment_completed', {
        amount: session.amount_total / 100,
        currency: session.currency,
        stripe_session_id: session.id,
        ecp: session.metadata?.ecp || '',
        ubicacion: session.metadata?.ubicacion || '',
        ghl_contact_id: contactId || '',
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
 * Find and update the opportunity's tratamiento_status to 'paid'
 */
async function updateGHLOpportunity(contactId, apiKey) {
  const ghlHeaders = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Version': '2021-07-28',
  };

  try {
    // Search for open opportunities for this contact
    const searchRes = await fetch(`${GHL_BASE}/opportunities/search?contact_id=${contactId}&status=open`, {
      headers: ghlHeaders,
    });
    const searchData = await searchRes.json();
    const opportunities = searchData?.opportunities || [];

    if (opportunities.length === 0) {
      console.log('[Stripe Webhook] No open opportunities found for contact:', contactId);
      return;
    }

    // Update the most recent opportunity
    const opp = opportunities[0];
    const updateRes = await fetch(`${GHL_BASE}/opportunities/${opp.id}`, {
      method: 'PUT',
      headers: ghlHeaders,
      body: JSON.stringify({
        monetaryValue: 195,
        customFields: [
          { id: OPP_CF.tratamiento_status, field_value: 'paid' },
        ],
      }),
    });
    console.log('[Stripe Webhook] Opportunity updated:', opp.id, 'status:', updateRes.status);

    // Add "Pago 195€" tag to contact
    try {
      await fetch(`${GHL_BASE}/contacts/${contactId}/tags`, {
        method: 'POST',
        headers: ghlHeaders,
        body: JSON.stringify({ tags: ['Pago 195€', 'Bono Diagnostico'] }),
      });
      console.log('[Stripe Webhook] Payment tags added to contact:', contactId);
    } catch (tagErr) {
      console.log('[Stripe Webhook] Tag addition failed:', tagErr.message);
    }
  } catch (err) {
    console.log('[Stripe Webhook] GHL opportunity update failed:', err.message);
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
