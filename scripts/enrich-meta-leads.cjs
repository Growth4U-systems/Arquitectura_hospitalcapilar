// Backfill script: enrich Meta-direct GHL leads that are missing link_agendar.
//
// Use cases:
//   - Catch leads that arrived BEFORE the GHL workflow webhook is deployed.
//   - Catch leads that slipped through if the workflow fails or is paused.
//
// Logic:
//   - Search GHL contacts where source contains "Facebook" and link_agendar is empty.
//   - For each: build the booking URL with tipo=diagnostico and PUT it on contact + open opportunity.
//
// Usage:
//   node scripts/enrich-meta-leads.cjs              # dry-run (default last 7 days)
//   node scripts/enrich-meta-leads.cjs --execute    # apply changes
//   node scripts/enrich-meta-leads.cjs --days 30    # widen lookback
require('dotenv').config();

const GHL_KEY      = process.env.VITE_GHL_API_KEY;
const GHL_LOCATION = process.env.VITE_GHL_LOCATION_ID || 'U4SBRYIlQtGBDHLFwEUf';
const GHL_BASE     = 'https://services.leadconnectorhq.com';

const CONTACT_LINK_AGENDAR_CF = 'UdbclFWU2YGw0YYup4vm';
const OPP_LINK_AGENDADOS_CF   = 'eHCAvPZKNph7h15z1gGt';

const ghlHeaders = { 'Authorization': `Bearer ${GHL_KEY}`, 'Content-Type': 'application/json', 'Version': '2021-07-28' };

const EXECUTE = process.argv.includes('--execute');
const daysIdx = process.argv.indexOf('--days');
const DAYS = daysIdx > -1 ? parseInt(process.argv[daysIdx + 1], 10) : 7;

function buildLink(c) {
  const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ');
  return `https://diagnostico.hospitalcapilar.com/agendar?contactId=${c.id}`
    + `&nombre=${encodeURIComponent(fullName)}`
    + `&email=${encodeURIComponent(c.email || '')}`
    + `&phone=${encodeURIComponent(c.phone || '')}`
    + `&tipo=diagnostico`;
}

async function searchFacebookContacts() {
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
  const results = [];
  let page = 1;
  while (true) {
    const r = await fetch(`${GHL_BASE}/contacts/search`, {
      method: 'POST',
      headers: ghlHeaders,
      body: JSON.stringify({
        locationId: GHL_LOCATION,
        pageLimit: 100,
        page,
        filters: [
          { field: 'source', operator: 'contains', value: 'Facebook' },
          { field: 'dateAdded', operator: 'range', value: { gte: since } },
        ],
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      console.error('search failed', r.status, txt);
      break;
    }
    const d = await r.json();
    const batch = d?.contacts || [];
    results.push(...batch);
    if (batch.length < 100) break;
    page += 1;
    if (page > 50) break; // safety
  }
  return results;
}

async function enrichOne(contact) {
  // Re-fetch to get customFields
  const cr = await fetch(`${GHL_BASE}/contacts/${contact.id}`, { headers: ghlHeaders });
  const cd = await cr.json();
  const c = cd?.contact || {};
  const cfs = c.customFields || [];
  const currentLink = cfs.find(f => f.id === CONTACT_LINK_AGENDAR_CF)?.value || '';
  const link = buildLink(c);

  const needsContactUpdate = currentLink !== link;
  if (!needsContactUpdate) {
    return { id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(' '), action: 'skip (already correct)' };
  }

  if (!EXECUTE) {
    return { id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(' '), action: 'WOULD update', link };
  }

  // PUT contact
  const ur = await fetch(`${GHL_BASE}/contacts/${c.id}`, {
    method: 'PUT', headers: ghlHeaders,
    body: JSON.stringify({ customFields: [{ id: CONTACT_LINK_AGENDAR_CF, field_value: link }] }),
  });
  const contactStatus = ur.status;

  // PUT open opportunity link_agendados
  let oppStatus = null;
  let oppId = null;
  try {
    const sr = await fetch(`${GHL_BASE}/opportunities/search?location_id=${GHL_LOCATION}&contact_id=${c.id}`, { headers: ghlHeaders });
    const sd = await sr.json();
    const opps = sd?.opportunities || [];
    const opp = opps.find(o => o.status === 'open') || opps[0];
    if (opp) {
      oppId = opp.id;
      const or = await fetch(`${GHL_BASE}/opportunities/${oppId}`, {
        method: 'PUT', headers: ghlHeaders,
        body: JSON.stringify({ customFields: [{ id: OPP_LINK_AGENDADOS_CF, field_value: link }] }),
      });
      oppStatus = or.status;
    }
  } catch (e) {
    console.error('opp update failed for', c.id, e.message);
  }

  return { id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(' '), action: 'updated', contactStatus, oppId, oppStatus };
}

async function main() {
  console.log(EXECUTE ? '=== EXECUTE MODE ===' : '=== DRY-RUN (pass --execute to apply) ===');
  console.log(`Lookback window: ${DAYS} days`);

  const contacts = await searchFacebookContacts();
  console.log(`\nFound ${contacts.length} Facebook-source contacts in window.`);

  // Filter: only those with empty link_agendar
  const candidates = [];
  for (const c of contacts) {
    const cfs = c.customFields || [];
    const link = cfs.find(f => f.id === CONTACT_LINK_AGENDAR_CF)?.value || '';
    if (!link) candidates.push(c);
  }
  console.log(`Candidates with empty link_agendar: ${candidates.length}\n`);

  for (const c of candidates) {
    const r = await enrichOne(c);
    console.log('-', r.action, '|', r.name, '|', r.id, r.link ? '\n  → ' + r.link : '');
  }

  if (!EXECUTE) console.log('\nDry-run complete. Re-run with --execute to apply.');
}

main().catch(e => { console.error(e); process.exit(1); });
