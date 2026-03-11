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
    const { email, nombre, contactId, ecp, ubicacion, amount = 19500, embedded = false } = body;

    if (!email) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'email is required' }) };
    }

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('customer_email', email);
    params.append('line_items[0][price_data][currency]', 'eur');
    params.append('line_items[0][price_data][unit_amount]', amount.toString());
    params.append('line_items[0][price_data][product_data][name]', 'Bono Diagnóstico Capilar');
    params.append('line_items[0][price_data][product_data][description]', 'Tricoscopía digital + Analítica hormonal completa + Valoración médica personalizada + Plan de tratamiento');

    // Metadata at session level (for webhook) and payment_intent level
    params.append('metadata[contactId]', contactId || '');
    params.append('metadata[nombre]', nombre || '');
    params.append('metadata[ecp]', ecp || '');
    params.append('metadata[ubicacion]', ubicacion || '');
    params.append('metadata[source]', 'quiz_hospitalcapilar');
    params.append('payment_intent_data[metadata][contactId]', contactId || '');
    params.append('payment_intent_data[metadata][nombre]', nombre || '');
    params.append('payment_intent_data[metadata][ecp]', ecp || '');
    params.append('payment_intent_data[metadata][source]', 'quiz_hospitalcapilar');

    if (embedded) {
      // Embedded mode: returns client_secret for inline checkout
      params.append('ui_mode', 'embedded');
      params.append('return_url', 'https://diagnostico.hospitalcapilar.com/?pago=exito&session_id={CHECKOUT_SESSION_ID}');
    } else {
      // Redirect mode: returns URL
      params.append('success_url', 'https://diagnostico.hospitalcapilar.com/?pago=exito&session_id={CHECKOUT_SESSION_ID}');
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
