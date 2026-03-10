const GHL_BASE = 'https://services.leadconnectorhq.com';
const PIPELINE_ID = 'xXCgpUIEizlqdrmGrJkg';
const STAGE_NEW_LEAD = 'fbed92b1-5e91-4b86-820f-44b9f66f8b73';

// Opportunity custom field IDs
const OPP_CF = {
  lead_priority:    'l99Opesqh9cJBLxSPs4z',
  agent_message:    'cVtN5KboKd2R1cf1s7QA',
  bono_diagnostico: 'QFeGi097rXODJDWg7YPF',
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
    delete body._agentMessage;
    delete body._quizAnswers;
    delete body._contactScore;

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
                { id: OPP_CF.bono_diagnostico, field_value: 'not_paid' },
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
