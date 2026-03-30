const GHL_BASE = 'https://services.leadconnectorhq.com';

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

  const apiKey = process.env.VITE_GHL_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'GHL API key not configured' }) };
  }

  const ghlHeaders = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Version': '2021-07-28',
  };

  try {
    const { contactId, ecp, nombre } = JSON.parse(event.body);

    if (!contactId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'contactId required' }) };
    }

    const firstName = (nombre || '').split(' ')[0] || 'Paciente';
    const timestamp = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

    // 1. Add tag "solicita_llamada" to contact
    try {
      const tagRes = await fetch(`${GHL_BASE}/contacts/${contactId}/tags`, {
        method: 'POST',
        headers: ghlHeaders,
        body: JSON.stringify({ tags: ['solicita_llamada'] }),
      });
      if (!tagRes.ok) console.log('[GHL-CallRequest] Tag failed:', tagRes.status);
    } catch (tagErr) {
      console.log('[GHL-CallRequest] Tag error:', tagErr.message);
    }

    // 2. Add note to contact with context
    try {
      const noteRes = await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
        method: 'POST',
        headers: ghlHeaders,
        body: JSON.stringify({
          body: `📞 SOLICITA LLAMADA (${timestamp})\n\nEl paciente ${firstName} ha pulsado "Prefiero que me llamen" en la pantalla de resultados del quiz.\n\nPerfil clínico: ${ecp || 'No definido'}\n\nAcción requerida: Llamar al paciente para resolver dudas y agendar cita.`,
        }),
      });
      if (!noteRes.ok) console.log('[GHL-CallRequest] Note failed:', noteRes.status);
    } catch (noteErr) {
      console.log('[GHL-CallRequest] Note error:', noteErr.message);
    }

    console.log('[GHL-CallRequest] Tag + note added for contact:', contactId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, contactId }),
    };
  } catch (err) {
    console.log('[GHL-CallRequest] Error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
