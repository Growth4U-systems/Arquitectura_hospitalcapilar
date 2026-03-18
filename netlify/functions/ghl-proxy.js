const GHL_BASE = 'https://services.leadconnectorhq.com';
const SALESFORCE_URL = 'https://webto.salesforce.com/servlet/servlet.WebToLead?encoding=UTF-8&orgId=00D090000047Cb3';
const PIPELINE_ID = 'xXCgpUIEizlqdrmGrJkg';
const STAGE_NEW_LEAD = 'fbed92b1-5e91-4b86-820f-44b9f66f8b73';

// Opportunity custom field IDs
const OPP_CF = {
  lead_priority:       'l99Opesqh9cJBLxSPs4z',
  agent_message:       'cVtN5KboKd2R1cf1s7QA',
  tratamiento_status:  'Hk81fRW2HaTqlry4I1L0',
  fecha_cita:          '6SmcwU7myCOv7FsNPkX8',
  hora_cita:           'xI1E3qSGLVgJdBujrWcI',
  koibox_booking_id:   'EDiHi8YfC913Mve0DRsv',
};

// Salesforce Web-To-Lead field mapping
const SF = {
  oid:                     '00D090000047Cb3',
  clinica_pck:             '00NbE000006pqPJ',
  lopd_firmada:            '00N0900000CPq2F',
  acepta_comunicaciones:   '00N0900000CPq1v',
  g4u_id:                  '00NbE000006ougH',
  g4u_perfil_clinico:      '00NbE000006pt3p',
  g4u_score:               '00NbE000006psAz',
  g4u_door:                '00NbE000006pqXP',
  genero:                  '00N0900000CPq2O',
  g4u_edad:                '00NbE000006pvbt',
  g4u_problema:            '00NbE000006pvwr',
  g4u_tiempo:              '00NbE000006pvvF',
  g4u_probado:             '00NbE000006pvyT',
  g4u_motivacion:          '00NbE000006ptJx',
  g4u_formato:             '00NbE000006ptOn',
  g4u_condicion:           '00NbE000006ptTd',
  g4u_mensaje_comercial:   '00NbE000006ptWr',
  g4u_utm_source:          '00NbE000006ptYT',
  g4u_utm_medium:          '00NbE000006pta5',
  g4u_utm_campaign:        '00NbE000006ptjl',
  g4u_utm_content:         '00NbE000006ptob',
  g4u_utm_term:            '00NbE000006pt8g',
  g4u_fbclid:              '00NbE000006ptqD',
  g4u_gclid:               '00NbE000006pttR',
  g4u_referrer:            '00NbE000006ptv3',
  g4u_landing_url:         '00NbE000006ptwf',
};


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
    const body = JSON.parse(event.body);

    // Extract extra fields before sending to GHL contacts API
    const agentMessage = body._agentMessage || '';
    const contactScore = body._contactScore || '';
    const salesforceData = body._salesforceData || {};
    delete body._agentMessage;
    delete body._quizAnswers;
    delete body._contactScore;
    delete body._salesforceData;

    // 1. Create or update contact
    const contactRes = await fetch(`${GHL_BASE}/contacts/`, {
      method: 'POST',
      headers: ghlHeaders,
      body: JSON.stringify(body),
    });
    const contactData = await contactRes.json();

    // GHL returns contact.id for new contacts, meta.contactId for duplicates
    const contactId = contactData?.contact?.id || contactData?.meta?.contactId || contactData?.id || contactData?.contactId;
    console.log('[GHL] Contact response status:', contactRes.status, 'contactId:', contactId, 'duplicate:', !!contactData?.meta?.contactId);

    // 1b. Add "new_lead" tag + populate link_agendar on contact
    if (contactId) {
      try {
        await fetch(`${GHL_BASE}/contacts/${contactId}/tags`, {
          method: 'POST',
          headers: ghlHeaders,
          body: JSON.stringify({ tags: ['new_lead'] }),
        });
        console.log('[GHL] Tags added to contact:', contactId);
      } catch (tagErr) {
        console.log('[GHL] Tag addition failed:', tagErr.message);
      }

      // Populate link_agendar so Noemí can open booking page from the contact card
      try {
        const bookingUrl = `https://diagnostico.hospitalcapilar.com/agendar?contactId=${contactId}&nombre=${encodeURIComponent((body.firstName || '') + ' ' + (body.lastName || ''))}&email=${encodeURIComponent(body.email || '')}&phone=${encodeURIComponent(body.phone || '')}`;
        await fetch(`${GHL_BASE}/contacts/${contactId}`, {
          method: 'PUT',
          headers: ghlHeaders,
          body: JSON.stringify({
            customFields: [
              { id: 'UdbclFWU2YGw0YYup4vm', field_value: bookingUrl },
            ],
          }),
        });
        console.log('[GHL] link_agendar set on contact:', contactId);
      } catch (linkErr) {
        console.log('[GHL] link_agendar update failed:', linkErr.message);
      }
    }

    // 2. Create opportunity if we have a contactId
    let opportunityData = null;
    let noteData = null;
    let oppError = null;
    if (contactId) {
      // Determine lead_priority from contact_score (now numerical 0-100)
      // HOT: contact_score >= 70
      // WARM: contact_score >= 30
      // COLD: contact_score < 30 (fuera de zona operativa)
      const scoreNum = typeof contactScore === 'number' ? contactScore : parseInt(contactScore, 10) || 50;
      let priority = 'WARM';
      if (scoreNum >= 70) priority = 'HOT';
      else if (scoreNum < 30) priority = 'COLD';

      // Step A: Create opportunity (custom fields don't work on POST)
      const oppPayload = {
        pipelineId: PIPELINE_ID,
        locationId: body.locationId,
        name: `Lead - ${body.firstName || ''} ${body.lastName || ''}`.trim(),
        pipelineStageId: STAGE_NEW_LEAD,
        contactId,
        status: 'open',
        monetaryValue: 195,
      };
      console.log('[GHL] Creating opportunity:', JSON.stringify(oppPayload));

      const oppRes = await fetch(`${GHL_BASE}/opportunities/`, {
        method: 'POST',
        headers: ghlHeaders,
        body: JSON.stringify(oppPayload),
      });
      opportunityData = await oppRes.json();
      console.log('[GHL] Opportunity response status:', oppRes.status, JSON.stringify(opportunityData));

      if (!oppRes.ok) {
        oppError = `Opportunity creation failed: ${oppRes.status} ${JSON.stringify(opportunityData)}`;
      }

      // Step B: Update opportunity with custom fields via PUT
      const oppId = opportunityData?.opportunity?.id;
      if (oppId) {
        try {
          const updateRes = await fetch(`${GHL_BASE}/opportunities/${oppId}`, {
            method: 'PUT',
            headers: ghlHeaders,
            body: JSON.stringify({
              customFields: [
                { id: OPP_CF.lead_priority, field_value: priority },
                { id: OPP_CF.agent_message, field_value: agentMessage },
                { id: OPP_CF.tratamiento_status, field_value: 'not_paid' },
              ],
            }),
          });
          console.log('[GHL] Opportunity update status:', updateRes.status);
        } catch (updateErr) {
          console.log('[GHL] Opportunity update failed:', updateErr.message);
        }
      }

      // 3. Also add agent message as note on the contact
      if (agentMessage && contactId) {
        try {
          const noteRes = await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
            method: 'POST',
            headers: ghlHeaders,
            body: JSON.stringify({ body: agentMessage }),
          });
          noteData = await noteRes.json();
          console.log('[GHL] Note response status:', noteRes.status);
        } catch (noteErr) {
          console.log('[GHL] Note creation failed:', noteErr.message);
        }
      }
    } else {
      oppError = `No contactId found in response: ${JSON.stringify(contactData)}`;
      console.log('[GHL] ERROR:', oppError);
    }

    // 4. Send to Salesforce Web-To-Lead (fire-and-forget)
    sendToSalesforce({
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      contactId,
      agentMessage,
      contactScore,
      ...salesforceData,
    });

    return {
      statusCode: contactRes.ok ? 200 : contactRes.status,
      headers,
      body: JSON.stringify({
        contact: contactData,
        contactId,
        opportunity: opportunityData,
        note: noteData,
        oppError,
      }),
    };
  } catch (err) {
    console.log('[GHL] Exception:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

/**
 * Send lead to Salesforce via Web-To-Lead POST.
 * Fire-and-forget: does not block the GHL response.
 */
function sendToSalesforce(data) {
  // Map ubicacion to Salesforce picklist values
  const clinicaMap = { madrid: 'Madrid', murcia: 'Murcia', pontevedra: 'Pontevedra' };
  const generoMap = { hombre: 'Masculino', mujer: 'Femenino' };
  const formatoMap = { presencial: 'Presencial', online: 'Online', llamada: 'Llamada' };

  const params = new URLSearchParams();
  params.append('oid', SF.oid);
  params.append('retURL', 'http://');
  params.append('first_name', data.firstName || '');
  params.append('last_name', data.lastName || '');
  params.append('email', data.email || '');
  params.append('phone', data.phone || '');
  params.append(SF.clinica_pck, clinicaMap[data.ubicacion] || '');
  params.append(SF.lopd_firmada, data.consentPrivacidad ? 'Sí' : 'No');
  params.append(SF.acepta_comunicaciones, data.consentComunicaciones ? '1' : '0');
  params.append(SF.g4u_id, data.contactId || '');
  params.append(SF.g4u_perfil_clinico, data.ecp || '');
  params.append(SF.g4u_score, String(data.contactScore || ''));
  params.append(SF.g4u_door, data.door || '');
  params.append(SF.genero, generoMap[data.sexo] || '');
  params.append(SF.g4u_edad, data.edad || '');
  params.append(SF.g4u_problema, data.problema || '');
  params.append(SF.g4u_tiempo, data.tiempo || '');
  params.append(SF.g4u_probado, Array.isArray(data.probado) ? data.probado.join(', ') : (data.probado || ''));
  params.append(SF.g4u_motivacion, data.motivacion || '');
  params.append(SF.g4u_formato, formatoMap[data.formato] || '');
  params.append(SF.g4u_condicion, Array.isArray(data.condicion) ? data.condicion.join(', ') : (data.condicion || ''));
  params.append(SF.g4u_mensaje_comercial, data.agentMessage || '');
  params.append(SF.g4u_utm_source, data.utm_source || '');
  params.append(SF.g4u_utm_medium, data.utm_medium || '');
  params.append(SF.g4u_utm_campaign, data.utm_campaign || '');
  params.append(SF.g4u_utm_content, data.utm_content || '');
  params.append(SF.g4u_utm_term, data.utm_term || '');
  params.append(SF.g4u_fbclid, data.fbclid || '');
  params.append(SF.g4u_gclid, data.gclid || '');
  params.append(SF.g4u_referrer, data.referrer || '');
  params.append(SF.g4u_landing_url, data.landing_url || '');

  fetch(SALESFORCE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
    .then(res => console.log('[Salesforce] Web-To-Lead sent, status:', res.status))
    .catch(err => console.log('[Salesforce] Web-To-Lead failed:', err.message));
}
