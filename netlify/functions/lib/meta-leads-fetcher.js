// Pulls Meta Lead Ads leads with full attribution (campaign / adset / ad).
// Used by cron-enrich-meta-leads to populate utm_* CFs on GHL contacts that
// arrived via the native Meta-GHL integration without UTM tracking.
//
// PRECONDITION: META_ACCESS_TOKEN must have `leads_retrieval` permission
// on the Page that owns the lead forms. Verify with:
//   GET /.netlify/functions/admin-test-meta-leads?key=<DASHBOARD_SECRET>
//
// API ref: https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving

const META_GRAPH = 'https://graph.facebook.com/v21.0';

// Page ID for Hospital Capilar — set as env var to avoid hardcoding.
// Find via: GET /me/accounts?access_token=<token>
function getPageIds() {
  const ids = (process.env.META_PAGE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  return ids;
}

async function fetchPagesFromAccount() {
  // Fallback when META_PAGE_IDS not set — list pages the token can access.
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return [];
  const r = await fetch(`${META_GRAPH}/me/accounts?fields=id,name&access_token=${token}`);
  if (!r.ok) return [];
  const d = await r.json();
  return (d.data || []).map(p => p.id);
}

async function listLeadFormsForPage(pageId) {
  const token = process.env.META_ACCESS_TOKEN;
  const url = `${META_GRAPH}/${pageId}/leadgen_forms?fields=id,name,status,created_time&limit=100&access_token=${token}`;
  const r = await fetch(url);
  if (!r.ok) return { error: `${r.status}: ${(await r.text()).slice(0, 200)}`, forms: [] };
  const d = await r.json();
  return { forms: d.data || [] };
}

async function fetchLeadsForForm(formId, sinceUnix) {
  const token = process.env.META_ACCESS_TOKEN;
  const fields = [
    'id', 'created_time', 'form_id',
    'campaign_id', 'campaign_name',
    'adset_id', 'adset_name',
    'ad_id', 'ad_name',
    'field_data',
    'platform',
  ].join(',');
  const filter = sinceUnix ? `&filtering=[{"field":"time_created","operator":"GREATER_THAN","value":${sinceUnix}}]` : '';
  const url = `${META_GRAPH}/${formId}/leads?fields=${fields}${filter}&limit=100&access_token=${token}`;
  const all = [];
  let next = url;
  let guard = 0;
  while (next && guard++ < 20) {
    const r = await fetch(next);
    if (!r.ok) {
      console.log('[meta-leads] form', formId, 'fetch failed:', r.status, (await r.text()).slice(0, 200));
      break;
    }
    const d = await r.json();
    all.push(...(d.data || []));
    next = d.paging?.next || null;
  }
  return all;
}

// Extract email + phone from Meta's field_data array (which has shape:
// [{ name: "email", values: ["foo@bar.com"] }, { name: "phone_number", values: ["+34..."] }])
function extractContactFields(lead) {
  const out = { email: '', phone: '', full_name: '', city: '' };
  for (const f of (lead.field_data || [])) {
    const name = (f.name || '').toLowerCase();
    const val = (f.values && f.values[0]) || '';
    if (!val) continue;
    if (name === 'email') out.email = val.toLowerCase().trim();
    else if (name.includes('phone')) out.phone = val.replace(/\s+/g, '').trim();
    else if (name.includes('full_name') || name.includes('first_name') || name.includes('nombre')) out.full_name = val.trim();
    else if (name.includes('city') || name.includes('ciudad')) out.city = val.trim();
  }
  return out;
}

// Main entry point: pulls all recent Meta leads with attribution data
// across all known pages/forms. Returns flattened list of lead records.
async function fetchRecentMetaLeads(lookbackHours = 24) {
  const sinceUnix = Math.floor((Date.now() - lookbackHours * 3600 * 1000) / 1000);
  let pageIds = getPageIds();
  if (pageIds.length === 0) {
    pageIds = await fetchPagesFromAccount();
  }
  if (pageIds.length === 0) {
    return { error: 'No pages found. Set META_PAGE_IDS env var or grant pages_show_list to token.', leads: [] };
  }

  const allLeads = [];
  const errors = [];
  for (const pageId of pageIds) {
    const { forms, error } = await listLeadFormsForPage(pageId);
    if (error) { errors.push(`page ${pageId}: ${error}`); continue; }
    for (const form of forms) {
      const leads = await fetchLeadsForForm(form.id, sinceUnix);
      for (const lead of leads) {
        const contact = extractContactFields(lead);
        allLeads.push({
          lead_id:        lead.id,
          created_time:   lead.created_time,
          email:          contact.email,
          phone:          contact.phone,
          full_name:      contact.full_name,
          city:           contact.city,
          form_id:        lead.form_id,
          form_name:      form.name,
          campaign_id:    lead.campaign_id,
          campaign_name:  lead.campaign_name,
          adset_id:       lead.adset_id,
          adset_name:     lead.adset_name,
          ad_id:          lead.ad_id,
          ad_name:        lead.ad_name,
          platform:       lead.platform || '',
          page_id:        pageId,
        });
      }
    }
  }
  return { leads: allLeads, errors };
}

module.exports = {
  fetchRecentMetaLeads,
  extractContactFields,
};
