const STRIPE_API = 'https://api.stripe.com/v1';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const stripeKey = process.env.STRIPE_RK_KEY;
  if (!stripeKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Stripe key not configured' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { email, nombre, telefono, contactId, ecp, ubicacion, amount = 19500, embedded = false } = body;

    // Build success URL with lead data prellenada so /pago-confirmado renders
    // personalized confirmation + WhatsApp CTA without needing to look up the
    // contact (which may not exist in GHL yet — Stripe webhook is async).
    const successQs = new URLSearchParams();
    if (nombre)    successQs.set('nombre', nombre);
    if (email)     successQs.set('email', email);
    if (telefono)  successQs.set('telefono', telefono);
    if (ubicacion) successQs.set('ubicacion', ubicacion);
    if (contactId) successQs.set('contactId', contactId);
    successQs.set('amount', String(amount / 100));
    successQs.set('session_id', '{CHECKOUT_SESSION_ID}');
    const successUrl = `https://diagnostico.hospitalcapilar.com/pago-confirmado?${successQs.toString()}`;

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    if (email) params.append('customer_email', email);
    params.append('line_items[0][quantity]', '1');
    params.append('line_items[0][price_data][currency]', 'eur');
    params.append('line_items[0][price_data][unit_amount]', amount.toString());
    params.append('line_items[0][price_data][product_data][name]', 'Test Capilar con Analítica Hormonal');
    params.append('line_items[0][price_data][product_data][description]', 'Analítica hormonal completa + Tricoscopia digital + Valoración con médico especialista + Informe personalizado con plan de tratamiento');

    // Metadata at session level (for webhook) and payment_intent level
    params.append('metadata[contactId]', contactId || '');
    params.append('metadata[nombre]', nombre || '');
    params.append('metadata[ecp]', ecp || '');
    params.append('metadata[ubicacion]', ubicacion || '');
    params.append('metadata[source]', 'quiz_hospitalcapilar');
    params.append('metadata[bono_price]', amount / 100);
    params.append('payment_intent_data[metadata][contactId]', contactId || '');
    params.append('payment_intent_data[metadata][nombre]', nombre || '');
    params.append('payment_intent_data[metadata][ecp]', ecp || '');
    params.append('payment_intent_data[metadata][source]', 'quiz_hospitalcapilar');

    if (embedded) {
      // Embedded mode: returns client_secret for inline checkout
      params.append('ui_mode', 'embedded');
      params.append('return_url', successUrl);
    } else {
      // Redirect mode: returns URL
      params.append('success_url', successUrl);
      params.append('cancel_url', 'https://diagnostico.hospitalcapilar.com/?pago=cancelado');
    }

    const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await res.json();

    if (!res.ok) {
      console.log('[Stripe] Checkout session error:', JSON.stringify(session));
      return { statusCode: res.status, headers, body: JSON.stringify({ error: session.error?.message || 'Stripe error' }) };
    }

    console.log('[Stripe] Checkout session created:', session.id, 'embedded:', embedded);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        url: session.url || null,
        clientSecret: session.client_secret || null,
        sessionId: session.id,
      }),
    };
  } catch (err) {
    console.log('[Stripe] Exception:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
