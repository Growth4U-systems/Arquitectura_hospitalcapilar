// GHL → PostHog sync. Runs hourly (netlify.toml).
//
// Emits PostHog events ONLY when an opportunity's pipeline stage changes
// since the previous run. State is persisted in Firestore collection
// `opportunity_states/{opp_id}` so re-running on an unchanged pipeline
// produces zero events.
//
// First run after deploy: if `opportunity_states` is empty, the function
// performs a silent bootstrap — it stores the current state for every opp
// without emitting events. The following run starts emitting on real changes.
//
// Always emits a single `ghl_pipeline_summary` heartbeat per run.

const { getFirestore } = require('./lib/firebase-admin');

async function sendAlert(source, message, details = {}) {
  console.error(`[ALERT][${source}] ${message}`, JSON.stringify(details));
}

const GHL_KEY = process.env.VITE_GHL_API_KEY;
const GHL_LOCATION = process.env.VITE_GHL_LOCATION_ID || 'U4SBRYIlQtGBDHLFwEUf';
const POSTHOG_KEY = process.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = 'https://eu.i.posthog.com';
const GHL_BASE = 'https://services.leadconnectorhq.com';
const PIPELINE_ID = 'xXCgpUIEizlqdrmGrJkg';

const STATE_COLLECTION = 'opportunity_states';

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

const STAGE_EVENTS = {
  booked:        ['appointment_booked'],
  reminder_sent: ['appointment_booked'],
  attended:      ['appointment_booked', 'appointment_attended'],
  won:           ['appointment_booked', 'appointment_attended', 'patient_converted'],
  no_show:       ['appointment_booked', 'appointment_no_show'],
  lost:          ['patient_lost'],
};

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

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, options);
    if (res.ok) return res;
    if (res.status === 429) {
      const delay = Math.pow(2, i) * 1000;
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
  const all = [];
  // Use the cursor URL GHL returns in meta.nextPageUrl. The previous code
  // built the next URL from `opps[opps.length-1].id`, but GHL's internal
  // cursor is a different value (and also requires a startAfter timestamp),
  // so manual construction caused the request to keep returning the same
  // page on accounts with > 100 opportunities — leading to the infinite
  // loop that timed out the function.
  let nextUrl = `${GHL_BASE}/opportunities/search?location_id=${GHL_LOCATION}&pipeline_id=${PIPELINE_ID}&limit=100`;
  let pages = 0;
  while (nextUrl && pages < 100) {
    const res = await fetchWithRetry(nextUrl, { headers });
    const data = await res.json();
    all.push(...(data.opportunities || []));
    nextUrl = data?.meta?.nextPageUrl || null;
    pages++;
    if (nextUrl) await sleep(100);
  }
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

function derivePaymentVariant({ sexo, funnel_type, monetary_value }) {
  if ((funnel_type || '').toLowerCase() === 'asesores') return 'clinica';
  const s = (sexo || '').toLowerCase();
  if (s === 'hombre' || s === 'male') return '0';
  if (s === 'mujer' || s === 'female') {
    const v = Number(monetary_value) || 0;
    if (v >= 180) return '195';
    if (v >= 100) return '125';
    return '125';
  }
  return 'unknown';
}

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

async function parallelMap(items, fn, concurrency = 10) {
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

async function loadAllStates(db) {
  const snapshot = await db.collection(STATE_COLLECTION).get();
  const map = new Map();
  snapshot.forEach(doc => map.set(doc.id, doc.data()));
  return map;
}

async function saveStates(db, updates) {
  for (let i = 0; i < updates.length; i += 400) {
    const chunk = updates.slice(i, i + 400);
    const batch = db.batch();
    for (const u of chunk) {
      batch.set(db.collection(STATE_COLLECTION).doc(u.id), u.data, { merge: true });
    }
    await batch.commit();
  }
}

exports.handler = async () => {
  if (!GHL_KEY || !POSTHOG_KEY) {
    await sendAlert('sync-ghl-posthog', 'Missing GHL or PostHog API keys', { severity: 'critical' });
    return { statusCode: 500, body: 'Missing GHL or PostHog API keys' };
  }

  const db = getFirestore();
  if (!db) {
    await sendAlert('sync-ghl-posthog', 'Firestore not configured — sync requires FIREBASE_SERVICE_ACCOUNT', { severity: 'critical' });
    return { statusCode: 500, body: 'Firestore unavailable' };
  }

  try {
    console.log('[GHL→PostHog Sync] Starting...');
    const [opps, states] = await Promise.all([
      fetchAllOpportunities(),
      loadAllStates(db),
    ]);
    const isBootstrap = states.size === 0;
    if (isBootstrap) {
      console.log('[GHL→PostHog Sync] BOOTSTRAP: opportunity_states is empty. Saving current stages without emitting events.');
    }

    const stateUpdates = [];
    const oppsToEmit = [];

    for (const opp of opps) {
      const stageName = STAGES[opp.pipelineStageId] || 'unknown';
      const stored = states.get(opp.id);
      const stageChanged = !stored || stored.stageId !== opp.pipelineStageId;

      if (stageChanged) {
        stateUpdates.push({
          id: opp.id,
          data: {
            stageId: opp.pipelineStageId,
            stageName,
            contactId: opp.contactId || null,
            updatedAt: new Date().toISOString(),
          },
        });
        if (!isBootstrap && STAGE_EVENTS[stageName]) {
          oppsToEmit.push({ opp, stageName, eventsToSend: STAGE_EVENTS[stageName] });
        }
      }
    }

    console.log(`[GHL→PostHog Sync] ${opps.length} opps total, ${stateUpdates.length} changed, ${oppsToEmit.length} to emit`);

    // Only fetch contact details for opps that actually need to emit. With
    // the change-based logic this is typically 0–10 per run, not hundreds —
    // so we no longer hit the Netlify function timeout.
    const contactPropsByOppId = new Map();
    await parallelMap(oppsToEmit, async ({ opp }) => {
      if (!opp.contactId) return;
      const props = await fetchContactProperties(opp.contactId);
      contactPropsByOppId.set(opp.id, props);
    }, 10);

    const events = [];
    for (const { opp, stageName, eventsToSend } of oppsToEmit) {
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
          // (opp, event, stageId) is unique per real stage transition. If two
          // runs ever race on the same change, PostHog dedups via $insert_id.
          properties: { ...baseProps, $insert_id: `${opp.id}_${eventName}_${opp.pipelineStageId}` },
        });
      }
    }

    let batchFailures = 0;
    for (let i = 0; i < events.length; i += 50) {
      const batch = events.slice(i, i + 50);
      const ok = await sendBatch(batch);
      if (!ok) batchFailures++;
    }

    if (batchFailures > 0) {
      await sendAlert('sync-ghl-posthog', `${batchFailures} batch(es) failed to send to PostHog`, {
        severity: 'warning',
        total_events: events.length,
        batch_failures: batchFailures,
      });
    }

    if (stateUpdates.length > 0) {
      await saveStates(db, stateUpdates);
    }

    const stageCounts = {};
    for (const opp of opps) {
      const stage = STAGES[opp.pipelineStageId] || 'unknown';
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    }

    await sendBatch([{
      event: 'ghl_pipeline_summary',
      distinct_id: 'ghl-sync',
      timestamp: new Date().toISOString(),
      properties: {
        total_contacts: opps.length,
        ...stageCounts,
        changed_this_run: stateUpdates.length,
        events_emitted: events.length,
        bootstrap: isBootstrap,
        $insert_id: `pipeline_summary_${new Date().toISOString().split(':')[0]}`,
      },
    }]);

    console.log('[GHL→PostHog Sync] Done.', {
      total: opps.length,
      changed: stateUpdates.length,
      emitted: events.length,
      bootstrap: isBootstrap,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        total_opportunities: opps.length,
        changed: stateUpdates.length,
        events_emitted: events.length,
        bootstrap: isBootstrap,
        stages: stageCounts,
      }),
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
