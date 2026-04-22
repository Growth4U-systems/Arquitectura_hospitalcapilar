// Alert: inline minimal version to avoid dependency chain crashes
async function sendAlert(source, message, details = {}) {
  console.error(`[ALERT][${source}] ${message}`, JSON.stringify(details));
}

const GHL_KEY = process.env.VITE_GHL_API_KEY;
const GHL_LOCATION = process.env.VITE_GHL_LOCATION_ID || 'U4SBRYIlQtGBDHLFwEUf';
const POSTHOG_KEY = process.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = 'https://eu.i.posthog.com';
const GHL_BASE = 'https://services.leadconnectorhq.com';
const PIPELINE_ID = 'xXCgpUIEizlqdrmGrJkg';

const STAGES = {
  'fbed92b1-5e91-4b86-820f-44b9f66f8b73': 'new_lead',
  'f0b2e24c-ce25-4c54-bb2f-6ba3571308c7': 'contacted',
  'f9e5c1cf-7701-4883-ac96-f16b3d78c0d5': 'booked',
  '24956338-65d9-4a16-97e5-ba01b64f390f': 'reminder_sent',
  '71a5cc36-584e-47dc-9cce-215803e3140d': 'attended',
  '1cd97c60-fb19-4699-9293-2b32fd48b54a': 'won',
  '437d0663-bd17-4d84-a939-11aed1b4b384': 'no_show',
  'c961b576-b14d-43a6-ac75-a26695886d58': 'lost',
};

// Stages that imply PostHog events
const STAGE_EVENTS = {
  booked:        ['appointment_booked'],
  reminder_sent: ['appointment_booked'],
  attended:      ['appointment_booked', 'appointment_attended'],
  won:           ['appointment_booked', 'appointment_attended', 'patient_converted'],
  no_show:       ['appointment_booked', 'appointment_no_show'],
  lost:          ['patient_lost'],
};

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, options);
    if (res.ok) return res;
    if (res.status === 429) {
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      console.log(`[GHL] Rate limited, retrying in ${delay}ms...`);
      await sleep(delay);
      continue;
    }
    const errText = await res.text();
    throw new Error(`GHL API ${res.status}: ${errText.substring(0, 200)}`);
  }
  throw new Error('GHL API: max retries exceeded (429)');
}

async function fetchAllOpportunities() {
  const headers = { 'Authorization': `Bearer ${GHL_KEY}`, 'Version': '2021-07-28' };
  let all = [];
  let startAfterId = '';
  let hasMore = true;

  const PAGE_SIZE = 100;  // GHL opportunities/search max is 100
  while (hasMore) {
    const url = `${GHL_BASE}/opportunities/search?location_id=${GHL_LOCATION}&pipeline_id=${PIPELINE_ID}&limit=${PAGE_SIZE}${startAfterId ? `&startAfterId=${startAfterId}` : ''}`;
    const res = await fetchWithRetry(url, { headers });
    const data = await res.json();
    const opps = data.opportunities || [];
    all = all.concat(opps);
    console.log(`[GHL] opportunities page fetched: ${opps.length} (total ${all.length})`);
    hasMore = opps.length >= PAGE_SIZE;
    if (hasMore) {
      startAfterId = opps[opps.length - 1].id;
      await sleep(100);
    }
  }

  console.log(`[GHL] fetchAllOpportunities complete: ${all.length} total`);
  return all;
}

async function sendBatch(events) {
  if (events.length === 0) return true;
  const res = await fetch(`${POSTHOG_HOST}/batch/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: POSTHOG_KEY, batch: events }),
  });
  return res.ok;
}

// GHL custom field IDs (mirrors HospitalCapilarQuiz.jsx CF map)
const CF_IDS = {
  sexo:              'P7D2edjnOHwXLpglw9tB',
  ecp:               'cFIcdJlT9sfnC3KMSwDD',
  nicho:             'o4I4AG3ZK07nEzAMLTlK',
  funnel_type:       'liIshAFJMngl2BV9MtVw',
  traffic_source:    'miu6E3oxZowYahYGjX1A',
  utm_source:        'MisB9YJJAH7cnh8JOtQn',
  utm_medium:        'vykx7m6bcfbYMXRqToYP',
  utm_campaign:      '3fUI7GO9o7oZ7ddMNnFf',
  utm_content:       'dydSaUSYbb5R7nYOboLq',
  utm_term:          'eLdhsOthmyD38al527tG',
  ubicacion_clinica: 'LygjPVQnLbqqdL4eqQwT',
  door:              '2JYlfGk60lHbuyh9vcdV',
};

// Derive payment variant from contact properties + opportunity value.
// 'clinica' = pago al terminar consulta (flow asesores)
// '0'       = hombres, no bono
// '195'     = mujer, bono completo (precio histórico / pago en clínica)
// '125'     = mujer, bono anticipado web/phone (reframe 2026-04-22)
// 'unknown' = falta dato para decidir
function derivePaymentVariant({ sexo, funnel_type, monetary_value }) {
  if ((funnel_type || '').toLowerCase() === 'asesores') return 'clinica';
  const s = (sexo || '').toLowerCase();
  if (s === 'hombre' || s === 'male') return '0';
  if (s === 'mujer' || s === 'female') {
    const v = Number(monetary_value) || 0;
    if (v >= 180) return '195';
    if (v >= 100) return '125';
    // sin monetary_value fiable: default al precio actual (125€ advance)
    return '125';
  }
  return 'unknown';
}

// Map GHL native gender (female/male/other) to our sexo taxonomy (mujer/hombre).
function normalizeGender(g) {
  if (!g) return null;
  const s = String(g).toLowerCase();
  if (s === 'female' || s === 'mujer') return 'mujer';
  if (s === 'male' || s === 'hombre') return 'hombre';
  return null;
}

async function fetchContactProperties(contactId) {
  try {
    const cfRes = await fetchWithRetry(
      `${GHL_BASE}/contacts/${contactId}`,
      { headers: { 'Authorization': `Bearer ${GHL_KEY}`, 'Version': '2021-07-28' } }
    );
    const cfData = await cfRes.json();
    const contact = cfData.contact || {};
    const cfs = contact.customFields || [];
    const cfMap = {};
    cfs.forEach(f => { cfMap[f.id] = f.value; });
    const get = (key) => cfMap[CF_IDS[key]] || null;

    // Sexo: fall back to GHL native `gender` field when the custom field is
    // empty — in practice it is, because the GHL write path persists gender
    // natively but the custom field `sexo` does not round-trip reliably.
    const sexoFromCF = get('sexo');
    const sexoFromNative = normalizeGender(contact.gender);
    const sexo = (sexoFromCF || sexoFromNative) || null;

    return {
      sexo,
      ecp:               get('ecp'),
      nicho:             get('nicho'),
      funnel_type:       get('funnel_type'),
      traffic_source:    get('traffic_source'),
      utm_source:        get('utm_source'),
      utm_medium:        get('utm_medium'),
      utm_campaign:      get('utm_campaign'),
      utm_content:       get('utm_content'),
      utm_term:          get('utm_term'),
      ubicacion_clinica: get('ubicacion_clinica'),
      door:              get('door'),
    };
  } catch (e) {
    console.log(`[GHL] Contact fetch failed for ${contactId}: ${e.message}`);
    return {};
  }
}

async function parallelMap(items, fn, concurrency = 5) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

// Scheduled function: runs every hour
exports.handler = async (event) => {
  if (!GHL_KEY || !POSTHOG_KEY) {
    await sendAlert('sync-ghl-posthog', 'Missing GHL or PostHog API keys — sync disabled', { severity: 'critical' });
    return { statusCode: 500, body: 'Missing GHL or PostHog API keys' };
  }

  try {
  console.log('[GHL→PostHog Sync] Starting...');
  const opps = await fetchAllOpportunities();
  console.log(`[GHL→PostHog Sync] Found ${opps.length} opportunities`);

  // Filter to opps in stages that emit events — avoids wasted contact fetches
  const relevantOpps = opps.filter(o => STAGE_EVENTS[STAGES[o.pipelineStageId] || 'unknown']);
  console.log(`[GHL→PostHog Sync] ${relevantOpps.length} opps in event-emitting stages`);

  // Fetch all contact custom fields in parallel (5 concurrent) — prevents Netlify timeout
  const contactPropsByOppId = new Map();
  await parallelMap(relevantOpps, async (opp) => {
    if (!opp.contactId) return;
    const props = await fetchContactProperties(opp.contactId);
    contactPropsByOppId.set(opp.id, props);
  }, 5);

  const events = [];

  for (const opp of relevantOpps) {
    const stageName = STAGES[opp.pipelineStageId] || 'unknown';
    const eventsToSend = STAGE_EVENTS[stageName];

    const contact = opp.contact || {};
    const email = contact.email || '';
    const distinctId = email || opp.id;
    const contactProps = contactPropsByOppId.get(opp.id) || {};
    const monetaryValue = opp.monetaryValue || 0;
    const paymentVariant = derivePaymentVariant({
      sexo: contactProps.sexo,
      funnel_type: contactProps.funnel_type,
      monetary_value: monetaryValue,
    });

    // Use the most recent timestamp available (stage change > updated > created)
    const eventTimestamp = opp.lastStageChangeAt || opp.updatedAt || opp.createdAt || new Date().toISOString();

    const baseProps = {
      $lib: 'ghl-sync-scheduled',
      contact_name: contact.name || opp.name || '',
      contact_email: email,
      contact_phone: contact.phone || '',
      opportunity_id: opp.id,
      pipeline_stage: stageName,
      monetary_value: monetaryValue,
      payment_variant: paymentVariant,
      ...contactProps,
    };

    // Send $set to update person properties
    if (email) {
      events.push({
        event: '$set',
        distinct_id: email,
        timestamp: eventTimestamp,
        properties: {
          $set: {
            email,
            name: contact.name || opp.name || '',
            phone: contact.phone || '',
            pipeline_stage: stageName,
            monetary_value: monetaryValue,
            payment_variant: paymentVariant,
            ...contactProps,
          },
        },
      });
    }

    for (const eventName of eventsToSend) {
      events.push({
        event: eventName,
        distinct_id: distinctId,
        timestamp: eventTimestamp,
        properties: { ...baseProps, $insert_id: `${opp.id}_${eventName}_v5` },
      });
    }
  }

  // Send in batches of 50
  let batchFailures = 0;
  for (let i = 0; i < events.length; i += 50) {
    const batch = events.slice(i, i + 50);
    const ok = await sendBatch(batch);
    if (!ok) batchFailures++;
    console.log(`[GHL→PostHog Sync] Batch ${Math.floor(i / 50) + 1}: ${batch.length} events → ${ok ? 'OK' : 'FAILED'}`);
  }

  if (batchFailures > 0) {
    await sendAlert('sync-ghl-posthog', `${batchFailures} batch(es) failed to send to PostHog`, {
      severity: 'warning',
      total_events: events.length,
      batch_failures: batchFailures,
    });
  }

  const summary = {};
  for (const e of events) {
    summary[e.event] = (summary[e.event] || 0) + 1;
  }

  // Count leads by stage for dashboard KPI
  const stageCounts = {};
  for (const opp of opps) {
    const stage = STAGES[opp.pipelineStageId] || 'unknown';
    stageCounts[stage] = (stageCounts[stage] || 0) + 1;
  }

  // Send pipeline summary as a single event (dashboard reads this for lead count)
  await sendBatch([{
    event: 'ghl_pipeline_summary',
    distinct_id: 'ghl-sync',
    timestamp: new Date().toISOString(),
    properties: {
      total_contacts: opps.length,
      ...stageCounts,
      $insert_id: `pipeline_summary_${new Date().toISOString().split(':')[0]}`,
    },
  }]);

  console.log('[GHL→PostHog Sync] Summary:', JSON.stringify(summary), 'Contacts:', opps.length);

  return {
    statusCode: 200,
    body: JSON.stringify({ synced: events.length, summary, opportunities: opps.length, stages: stageCounts }),
  };

  } catch (err) {
    console.error('[GHL→PostHog Sync] Fatal error:', err.message);
    await sendAlert('sync-ghl-posthog', `Sync crashed: ${err.message}`, {
      severity: 'critical',
      error: err.message,
      stack: err.stack?.substring(0, 300),
    });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
