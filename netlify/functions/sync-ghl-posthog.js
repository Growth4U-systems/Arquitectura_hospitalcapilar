const { sendAlert } = require('./lib/alert');

// Lazy-load Firebase to avoid crash if FIREBASE_SERVICE_ACCOUNT is missing
let getLeadSourceByEmail;
try {
  getLeadSourceByEmail = require('./lib/firebase-admin').getLeadSourceByEmail;
} catch (e) {
  console.log('[GHL Sync] Firebase admin not available, continuing without attribution');
  getLeadSourceByEmail = async () => ({});
}

const GHL_KEY = process.env.VITE_GHL_API_KEY;
const GHL_LOCATION = process.env.VITE_GHL_LOCATION_ID || 'U4SBRYIlQtGBDHLFwEUf';
const POSTHOG_KEY = process.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = 'https://eu.i.posthog.com';
const POSTHOG_PERSONAL_KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const POSTHOG_PROJECT_ID = '137870';
const GHL_BASE = 'https://services.leadconnectorhq.com';
const PIPELINE_ID = 'xXCgpUIEizlqdrmGrJkg';

// Lookup lead attribution from PostHog by email using HogQL
async function getLeadSourceFromPostHog(email) {
  if (!POSTHOG_PERSONAL_KEY || !email) return {};

  try {
    const safeEmail = email.replace(/'/g, "''");
    const query = `
      SELECT properties.traffic_source, properties.funnel_type, properties.nicho
      FROM events
      WHERE event IN ('quiz_completed', 'short_quiz_completed')
        AND person.properties.email = '${safeEmail}'
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    const res = await fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${POSTHOG_PERSONAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
    });

    if (!res.ok) {
      console.log(`[PostHog] Attribution query failed (${res.status}) for ${email}`);
      return {};
    }

    const data = await res.json();
    const row = data.results?.[0];
    if (!row) {
      console.log(`[PostHog] No quiz event found for ${email}`);
      return {};
    }

    console.log(`[PostHog] Attribution for ${email}: ${row[0]}, ${row[1]}, ${row[2]}`);
    return {
      traffic_source: row[0] || null,
      funnel_type: row[1] || null,
      nicho: row[2] || null,
    };
  } catch (e) {
    console.log(`[PostHog] Attribution lookup error for ${email}:`, e.message);
    return {};
  }
}

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

async function fetchAllOpportunities() {
  const headers = { 'Authorization': `Bearer ${GHL_KEY}`, 'Version': '2021-07-28' };
  let all = [];
  let startAfterId = '';
  let hasMore = true;

  while (hasMore) {
    const url = `${GHL_BASE}/opportunities/search?location_id=${GHL_LOCATION}&pipeline_id=${PIPELINE_ID}&limit=20${startAfterId ? `&startAfterId=${startAfterId}` : ''}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`GHL API ${res.status}: ${errText.substring(0, 200)}`);
    }
    const data = await res.json();
    const opps = data.opportunities || [];
    all = all.concat(opps);
    hasMore = opps.length >= 20;
    if (hasMore) startAfterId = opps[opps.length - 1].id;
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

  const events = [];

  for (const opp of opps) {
    const stageName = STAGES[opp.pipelineStageId] || 'unknown';
    const eventsToSend = STAGE_EVENTS[stageName];
    if (!eventsToSend) continue;

    const contact = opp.contact || {};
    const email = contact.email || '';
    const distinctId = email || opp.id;

    // Get attribution: try PostHog first (person properties from quiz), then Firebase fallback
    let leadSource = {};
    if (email) {
      try {
        leadSource = await getLeadSourceFromPostHog(email);
      } catch (e) {
        // PostHog lookup failed, try Firebase
      }
      if (!leadSource.traffic_source) {
        try {
          leadSource = await getLeadSourceByEmail(email);
        } catch (e) {
          // Firebase also failed, continue without attribution
        }
      }
    }

    // Use the most recent timestamp available (stage change > updated > created)
    const eventTimestamp = opp.lastStageChangeAt || opp.updatedAt || opp.createdAt || new Date().toISOString();

    const baseProps = {
      $lib: 'ghl-sync-scheduled',
      contact_name: contact.name || opp.name || '',
      contact_email: email,
      contact_phone: contact.phone || '',
      opportunity_id: opp.id,
      pipeline_stage: stageName,
      monetary_value: opp.monetaryValue || 0,
      ...leadSource,
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
            monetary_value: opp.monetaryValue || 0,
            ...leadSource,
          },
        },
      });
    }

    for (const eventName of eventsToSend) {
      events.push({
        event: eventName,
        distinct_id: distinctId,
        timestamp: eventTimestamp,
        properties: { ...baseProps, $insert_id: `${opp.id}_${eventName}_v2` },
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
  console.log('[GHL→PostHog Sync] Summary:', JSON.stringify(summary));

  return {
    statusCode: 200,
    body: JSON.stringify({ synced: events.length, summary, opportunities: opps.length }),
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
