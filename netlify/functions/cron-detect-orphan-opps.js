// Scheduled hourly. Safety net for ghl-proxy opp creation failures —
// finds contacts that have a `door` CF set but no opportunity in the
// Leads HC pipeline, and creates the missing opp.
//
// This catches:
//   - Transient 5xx / network failures that retry-with-backoff missed
//   - Race conditions where post-create verify still didn't find the opp
//   - Any other path that creates a contact-with-door but no opp
//
// Idempotent: GHL rejects duplicate opps for the same contact, so
// re-running on already-handled contacts is a no-op (logged as skip).

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION = process.env.VITE_GHL_LOCATION_ID || 'U4SBRYIlQtGBDHLFwEUf';
const PIPELINE_ID = 'xXCgpUIEizlqdrmGrJkg';
const STAGE_NEW_LEAD = 'fbed92b1-5e91-4b86-820f-44b9f66f8b73';
const DOOR_CF = '2JYlfGk60lHbuyh9vcdV';

const LOOKBACK_HOURS = 48; // catch failures from the last 2 days each run

async function searchContactsWithDoor(headers) {
  // Search contacts created in last LOOKBACK_HOURS that have door CF set.
  // GHL doesn't let us filter by CF presence, so we get all recent contacts
  // and filter client-side.
  const since = new Date(Date.now() - LOOKBACK_HOURS * 3600 * 1000).toISOString().slice(0, 10);
  const all = [];
  let page = 1;
  while (page <= 10) {
    const r = await fetch(`${GHL_BASE}/contacts/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        locationId: GHL_LOCATION,
        pageLimit: 100,
        page,
        sort: [{ field: 'dateAdded', direction: 'desc' }],
        filters: [{ field: 'dateAdded', operator: 'range', value: { gte: since } }],
      }),
    });
    if (!r.ok) break;
    const d = await r.json();
    const batch = d.contacts || [];
    all.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return all.filter(c => {
    const cf = (c.customFields || []).find(f => f.id === DOOR_CF);
    const door = cf?.value || cf?.fieldValue;
    return door && door !== '';
  });
}

async function contactHasOppInPipeline(contactId, headers) {
  const r = await fetch(
    `${GHL_BASE}/opportunities/search?location_id=${GHL_LOCATION}&contact_id=${contactId}`,
    { headers }
  );
  if (!r.ok) return null; // unknown — be cautious, don't create
  const d = await r.json();
  // Any opp at all means we should NOT create another (GHL would reject anyway)
  return (d.opportunities || []).length > 0;
}

async function createOppForContact(contact, headers) {
  const oppName = [contact.firstName, contact.lastName].filter(Boolean).join(' ')
    || contact.name
    || contact.email
    || `Recovered ${contact.id}`;
  const r = await fetch(`${GHL_BASE}/opportunities/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      pipelineId: PIPELINE_ID,
      locationId: GHL_LOCATION,
      name: oppName,
      pipelineStageId: STAGE_NEW_LEAD,
      status: 'open',
      contactId: contact.id,
      monetaryValue: 0,
    }),
  });
  if (!r.ok) {
    const txt = (await r.text()).slice(0, 200);
    throw new Error(`POST ${r.status}: ${txt}`);
  }
  const d = await r.json();
  return d.opportunity || d;
}

exports.handler = async () => {
  const apiKey = process.env.VITE_GHL_API_KEY;
  if (!apiKey) {
    console.error('[orphan-opps] VITE_GHL_API_KEY not set');
    return { statusCode: 500, body: 'Missing GHL key' };
  }
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Version': '2021-07-28',
  };

  const startedAt = Date.now();
  let scanned = 0, hasOpp = 0, created = 0, failed = 0;
  const recovered = [];

  try {
    const contactsWithDoor = await searchContactsWithDoor(headers);
    scanned = contactsWithDoor.length;

    for (const c of contactsWithDoor) {
      try {
        const has = await contactHasOppInPipeline(c.id, headers);
        if (has === null) continue; // search failed — skip this round
        if (has) { hasOpp += 1; continue; }
        // Truly orphan — create the opp
        const opp = await createOppForContact(c, headers);
        created += 1;
        recovered.push({
          contact_id: c.id,
          name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email,
          opp_id: opp.id,
        });
      } catch (e) {
        failed += 1;
        console.log('[orphan-opps] failed for', c.id, e.message);
      }
    }
  } catch (e) {
    console.error('[orphan-opps] fatal', e);
    return { statusCode: 500, body: e.message };
  }

  const ms = Date.now() - startedAt;
  console.log(`[orphan-opps] done in ${ms}ms — scanned:${scanned} hasOpp:${hasOpp} created:${created} failed:${failed}`);
  if (recovered.length) console.log('[orphan-opps] recovered:', JSON.stringify(recovered));
  return {
    statusCode: 200,
    body: JSON.stringify({ ms, scanned, hasOpp, created, failed, recovered }),
  };
};
