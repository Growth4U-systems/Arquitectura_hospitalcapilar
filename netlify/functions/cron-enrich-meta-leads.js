// Scheduled every 5 min (netlify.toml). Catches Meta-direct leads that arrive
// in GHL via the native Facebook Lead Form integration but bypass our quiz
// flow, so they never get link_agendar / link_paywall populated. Without this
// the auto-reply WhatsApp goes out with an empty link.
//
// Logic mirrors scripts/enrich-meta-leads.cjs:
//   - Search GHL contacts created in last 24h with source containing "Facebook".
//   - Skip ones that already have link_agendar matching the canonical format.
//   - PUT link_agendar + link_paywall on the contact, link_agendados on the
//     open opportunity, then add the meta_form_directo tag.
//
// Idempotent: re-running on a populated contact is a no-op (skip path).

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION = process.env.VITE_GHL_LOCATION_ID || 'U4SBRYIlQtGBDHLFwEUf';
const CONTACT_LINK_AGENDAR_CF = 'UdbclFWU2YGw0YYup4vm';
const CONTACT_LINK_PAYWALL_CF = 'uRxexlYy8HItx45Z7sih';
const OPP_LINK_AGENDADOS_CF   = 'eHCAvPZKNph7h15z1gGt';

const LOOKBACK_HOURS = 24;

function buildLink(c) {
  const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ');
  return `https://diagnostico.hospitalcapilar.com/agendar?contactId=${c.id}`
    + `&nombre=${encodeURIComponent(fullName)}`
    + `&email=${encodeURIComponent(c.email || '')}`
    + `&phone=${encodeURIComponent(c.phone || '')}`
    + `&tipo=diagnostico`;
}

function buildPaywallLink(c) {
  const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ');
  return `https://diagnostico.hospitalcapilar.com/p/?ecp=protocolo-mujer&contactId=${c.id}`
    + `&nombre=${encodeURIComponent(fullName)}`
    + `&email=${encodeURIComponent(c.email || '')}`
    + `&telefono=${encodeURIComponent(c.phone || '')}`;
}

async function searchRecentFacebookContacts(ghlHeaders) {
  const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const results = [];
  let page = 1;
  while (page <= 10) {
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
      console.error('[cron-enrich] search failed', r.status, await r.text());
      break;
    }
    const d = await r.json();
    const batch = d?.contacts || [];
    results.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }
  return results;
}

async function enrichOne(c, ghlHeaders) {
  const cfs = c.customFields || [];
  const currentLink = cfs.find(f => f.id === CONTACT_LINK_AGENDAR_CF)?.value || '';
  const currentPaywall = cfs.find(f => f.id === CONTACT_LINK_PAYWALL_CF)?.value || '';
  const link = buildLink(c);
  const linkPaywall = buildPaywallLink(c);

  if (currentLink === link && currentPaywall === linkPaywall) {
    return { id: c.id, skipped: true };
  }

  // PUT contact CFs
  await fetch(`${GHL_BASE}/contacts/${c.id}`, {
    method: 'PUT',
    headers: ghlHeaders,
    body: JSON.stringify({
      customFields: [
        { id: CONTACT_LINK_AGENDAR_CF, field_value: link },
        { id: CONTACT_LINK_PAYWALL_CF, field_value: linkPaywall },
      ],
    }),
  });

  // Mirror link on the open opportunity
  try {
    const sr = await fetch(`${GHL_BASE}/opportunities/search?location_id=${GHL_LOCATION}&contact_id=${c.id}`, { headers: ghlHeaders });
    const sd = await sr.json();
    const opp = (sd?.opportunities || []).find(o => o.status === 'open') || (sd?.opportunities || [])[0];
    if (opp) {
      await fetch(`${GHL_BASE}/opportunities/${opp.id}`, {
        method: 'PUT',
        headers: ghlHeaders,
        body: JSON.stringify({ customFields: [{ id: OPP_LINK_AGENDADOS_CF, field_value: link }] }),
      });
    }
  } catch (e) {
    console.error('[cron-enrich] opp update failed for', c.id, e.message);
  }

  // Tag last so any tag-triggered downstream reads populated fields.
  try {
    await fetch(`${GHL_BASE}/contacts/${c.id}/tags`, {
      method: 'POST',
      headers: ghlHeaders,
      body: JSON.stringify({ tags: ['meta_form_directo'] }),
    });
  } catch (e) {
    console.error('[cron-enrich] tag POST failed for', c.id, e.message);
  }

  return { id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(' '), updated: true };
}

exports.handler = async () => {
  const apiKey = process.env.VITE_GHL_API_KEY;
  if (!apiKey) {
    console.error('[cron-enrich] VITE_GHL_API_KEY not set');
    return { statusCode: 500, body: 'Missing GHL key' };
  }
  const ghlHeaders = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Version': '2021-07-28',
  };

  const startedAt = Date.now();
  let scanned = 0, skipped = 0, updated = 0, failed = 0;
  const updates = [];

  try {
    const contacts = await searchRecentFacebookContacts(ghlHeaders);
    scanned = contacts.length;
    for (const c of contacts) {
      try {
        const r = await enrichOne(c, ghlHeaders);
        if (r.skipped) skipped += 1;
        else if (r.updated) { updated += 1; updates.push(r.name + ' (' + r.id + ')'); }
      } catch (e) {
        failed += 1;
        console.error('[cron-enrich] failed for', c.id, e.message);
      }
    }
  } catch (e) {
    console.error('[cron-enrich] fatal', e);
    return { statusCode: 500, body: e.message };
  }

  const ms = Date.now() - startedAt;
  console.log(`[cron-enrich] done in ${ms}ms — scanned:${scanned} updated:${updated} skipped:${skipped} failed:${failed}`);
  if (updates.length) console.log('[cron-enrich] updated:', updates.join(', '));
  return {
    statusCode: 200,
    body: JSON.stringify({ ms, scanned, updated, skipped, failed, updates }),
  };
};
