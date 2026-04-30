// Webhook receiver for GHL workflow that fires when a Meta Lead Form contact is created.
// Sets `link_agendar` + `link_paywall` on the contact, `link_agendados` on the open
// opportunity, and finally adds the tag `meta_form_directo` so the auto-reply
// WhatsApp workflow can trigger on it (guaranteeing the links are populated before
// the message goes out).
//
// Trigger setup (in GHL):
//   Workflow trigger: Contact Created (Source contains Facebook)
//   → Webhook action POST { contactId, firstName, lastName, email, phone }
//   → URL: https://diagnostico.hospitalcapilar.com/.netlify/functions/ghl-meta-lead-enrich

const GHL_BASE = 'https://services.leadconnectorhq.com';
const CONTACT_LINK_AGENDAR_CF = 'UdbclFWU2YGw0YYup4vm';
const CONTACT_LINK_PAYWALL_CF = 'uRxexlYy8HItx45Z7sih';
const OPP_LINK_AGENDADOS_CF   = 'eHCAvPZKNph7h15z1gGt';

exports.handler = async (event) => {
  const responseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: responseHeaders, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: responseHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };

  const apiKey = process.env.VITE_GHL_API_KEY;
  const locationId = process.env.VITE_GHL_LOCATION_ID || 'U4SBRYIlQtGBDHLFwEUf';
  if (!apiKey) return { statusCode: 500, headers: responseHeaders, body: JSON.stringify({ error: 'GHL API key not configured' }) };

  const ghlHeaders = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Version': '2021-07-28',
  };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: responseHeaders, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { contactId, firstName, lastName, email, phone } = body;
  if (!contactId) return { statusCode: 400, headers: responseHeaders, body: JSON.stringify({ error: 'Missing contactId' }) };

  console.log('[meta-lead-enrich] received', { contactId, email, phone });

  // 1. Build personalized links (agendar + paywall) with the contact's data prefilled.
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const link = `https://diagnostico.hospitalcapilar.com/agendar?contactId=${contactId}`
    + `&nombre=${encodeURIComponent(fullName)}`
    + `&email=${encodeURIComponent(email || '')}`
    + `&phone=${encodeURIComponent(phone || '')}`
    + `&tipo=diagnostico`;
  const linkPaywall = `https://diagnostico.hospitalcapilar.com/p/?ecp=protocolo-mujer&contactId=${contactId}`
    + `&nombre=${encodeURIComponent(fullName)}`
    + `&email=${encodeURIComponent(email || '')}`
    + `&telefono=${encodeURIComponent(phone || '')}`;

  // 2. PUT contact link_agendar.
  // The bono gate in AgendarPage / koibox-proxy now triggers on tipo=diagnostico
  // alone (no sexo/gender check), so the link itself enforces the paywall.
  let contactStatus, contactBody;
  try {
    const r = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
      method: 'PUT',
      headers: ghlHeaders,
      body: JSON.stringify({
        customFields: [
          { id: CONTACT_LINK_AGENDAR_CF, field_value: link },
          { id: CONTACT_LINK_PAYWALL_CF, field_value: linkPaywall },
        ],
      }),
    });
    contactStatus = r.status;
    contactBody = await r.text();
  } catch (e) {
    console.error('[meta-lead-enrich] contact PUT failed', e);
    return { statusCode: 502, headers: responseHeaders, body: JSON.stringify({ error: 'Contact update failed', detail: e.message }) };
  }
  console.log('[meta-lead-enrich] contact PUT', contactStatus);

  // 3. Find open opportunity for this contact and update link_agendados
  let oppId = null;
  let oppStatus = null;
  try {
    const sr = await fetch(`${GHL_BASE}/opportunities/search?location_id=${locationId}&contact_id=${contactId}`, { headers: ghlHeaders });
    const sd = await sr.json();
    const opps = sd?.opportunities || [];
    const openOpp = opps.find(o => o.status === 'open') || opps[0];
    if (openOpp) {
      oppId = openOpp.id;
      const ur = await fetch(`${GHL_BASE}/opportunities/${oppId}`, {
        method: 'PUT',
        headers: ghlHeaders,
        body: JSON.stringify({ customFields: [{ id: OPP_LINK_AGENDADOS_CF, field_value: link }] }),
      });
      oppStatus = ur.status;
      console.log('[meta-lead-enrich] opp PUT', oppId, oppStatus);
    } else {
      console.log('[meta-lead-enrich] no opportunity found for contact', contactId);
    }
  } catch (e) {
    console.error('[meta-lead-enrich] opportunity update failed', e);
  }

  // 4. Add `meta_form_directo` tag LAST so any downstream workflow (e.g. the
  // auto-reply WhatsApp) triggered by this tag is guaranteed to read a contact
  // with link_agendar + link_paywall already populated. Order matters — keep
  // this as the final step.
  let tagStatus = null;
  try {
    const tr = await fetch(`${GHL_BASE}/contacts/${contactId}/tags`, {
      method: 'POST',
      headers: ghlHeaders,
      body: JSON.stringify({ tags: ['meta_form_directo'] }),
    });
    tagStatus = tr.status;
    console.log('[meta-lead-enrich] tag added', tagStatus);
  } catch (e) {
    console.error('[meta-lead-enrich] tag POST failed', e);
  }

  return {
    statusCode: 200,
    headers: responseHeaders,
    body: JSON.stringify({
      ok: true,
      contactId,
      link,
      contactStatus,
      oppId,
      oppStatus,
      tagStatus,
    }),
  };
};
