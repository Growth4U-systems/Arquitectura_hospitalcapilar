// Diagnóstico read-only: verifica si META_ACCESS_TOKEN tiene los permisos
// que necesita el cron de enriquecimiento (leads_retrieval, ads_read,
// pages_show_list, pages_read_engagement).
//
// Uso: GET /.netlify/functions/admin-test-meta-leads?key=<DASHBOARD_SECRET>
// No modifica nada — solo lee.

const META_GRAPH = 'https://graph.facebook.com/v21.0';

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const secret = process.env.DASHBOARD_SECRET || 'hc-dashboard-2026';
  if (params.key !== secret) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const token = process.env.META_ACCESS_TOKEN;
  const account = process.env.META_AD_ACCOUNT_ID;
  if (!token || !account) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing META_ACCESS_TOKEN or META_AD_ACCOUNT_ID env vars' }),
    };
  }

  const result = {
    timestamp: new Date().toISOString(),
    account,
    checks: {},
  };

  // 1) Inspect token: list scopes/permissions
  try {
    const r = await fetch(`${META_GRAPH}/me/permissions?access_token=${token}`);
    const d = await r.json();
    if (!r.ok) {
      result.checks.token_permissions = { ok: false, status: r.status, error: d.error?.message || 'unknown' };
    } else {
      const perms = (d.data || []).filter(p => p.status === 'granted').map(p => p.permission);
      result.checks.token_permissions = {
        ok: true,
        granted: perms,
        has_leads_retrieval: perms.includes('leads_retrieval'),
        has_ads_read: perms.includes('ads_read'),
        has_pages_show_list: perms.includes('pages_show_list'),
        has_pages_read_engagement: perms.includes('pages_read_engagement'),
        has_business_management: perms.includes('business_management'),
      };
    }
  } catch (e) {
    result.checks.token_permissions = { ok: false, error: e.message };
  }

  // 2) List Pages this token can access (lead forms live on Pages, not Ad Accounts)
  let pageIds = [];
  try {
    const r = await fetch(`${META_GRAPH}/me/accounts?fields=id,name&access_token=${token}`);
    const d = await r.json();
    if (!r.ok) {
      result.checks.list_pages = { ok: false, status: r.status, error: d.error?.message || 'unknown' };
    } else {
      pageIds = (d.data || []).map(p => p.id);
      result.checks.list_pages = {
        ok: true,
        total: (d.data || []).length,
        sample: (d.data || []).slice(0, 5).map(p => ({ id: p.id, name: p.name })),
      };
    }
  } catch (e) {
    result.checks.list_pages = { ok: false, error: e.message };
  }

  // 3) For each Page, list its lead forms
  const allForms = [];
  for (const pageId of pageIds) {
    try {
      const url = `${META_GRAPH}/${pageId}/leadgen_forms?fields=id,name,status,created_time&limit=100&access_token=${token}`;
      const r = await fetch(url);
      const d = await r.json();
      if (r.ok) {
        for (const f of (d.data || [])) allForms.push({ ...f, page_id: pageId });
      }
    } catch (e) { /* skip */ }
  }
  result.checks.list_lead_forms = {
    ok: allForms.length > 0,
    total: allForms.length,
    sample: allForms.slice(0, 8).map(f => ({ id: f.id, name: f.name, status: f.status, page_id: f.page_id })),
  };

  // 3.5) If no forms via Pages, find form IDs by inspecting Lead-Ads from the ad account
  if (allForms.length === 0 && account) {
    try {
      const url = `${META_GRAPH}/${account}/ads?fields=id,name,creative{object_story_spec},effective_status&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE"]}]&limit=100&access_token=${token}`;
      const r = await fetch(url);
      const d = await r.json();
      const formIdsFromAds = new Set();
      for (const a of (d.data || [])) {
        const oss = a.creative?.object_story_spec || {};
        // Lead Ads stash form_id in link_data.lead_gen_form_id or similar
        const fid = oss.link_data?.lead_gen_form_id
                 || oss.video_data?.lead_gen_form_id
                 || oss.lead_gen?.form_id;
        if (fid) formIdsFromAds.add(fid);
      }
      result.checks.form_ids_from_ads = {
        ok: formIdsFromAds.size > 0,
        total: formIdsFromAds.size,
        sample: [...formIdsFromAds].slice(0, 10),
      };
      // Try to fetch a lead from each form ID directly
      const formProbes = [];
      for (const fid of [...formIdsFromAds].slice(0, 5)) {
        const fr = await fetch(`${META_GRAPH}/${fid}?fields=id,name,status,page_id&access_token=${token}`);
        const fd = await fr.json();
        formProbes.push({ form_id: fid, ok: fr.ok, name: fd.name, page_id: fd.page_id, error: fd.error?.message });
        if (fr.ok) {
          allForms.push({ id: fd.id, name: fd.name, status: fd.status, page_id: fd.page_id });
        }
      }
      result.checks.form_probes = formProbes;
    } catch (e) {
      result.checks.form_ids_from_ads = { ok: false, error: e.message };
    }
  }

  // 4) Try to fetch leads from the first form
  if (allForms.length > 0) {
    const firstForm = allForms[0];
    try {
      const url = `${META_GRAPH}/${firstForm.id}/leads?fields=id,created_time,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,form_id,field_data&limit=3&access_token=${token}`;
      const r = await fetch(url);
      const d = await r.json();
      if (!r.ok) {
        result.checks.fetch_leads_from_form = {
          ok: false,
          form_id: firstForm.id,
          form_name: firstForm.name,
          status: r.status,
          error: d.error?.message || 'unknown',
          error_code: d.error?.code,
        };
      } else {
        const leads = d.data || [];
        result.checks.fetch_leads_from_form = {
          ok: true,
          form_id: firstForm.id,
          form_name: firstForm.name,
          total_returned: leads.length,
          sample: leads.slice(0, 2).map(l => ({
            id: l.id,
            created_time: l.created_time,
            campaign_name: l.campaign_name || null,
            ad_name: l.ad_name || null,
            adset_name: l.adset_name || null,
            field_count: (l.field_data || []).length,
          })),
        };
      }
    } catch (e) {
      result.checks.fetch_leads_from_form = { ok: false, error: e.message };
    }
  }

  // 5) Final verdict
  const tp = result.checks.token_permissions;
  const lp = result.checks.list_pages;
  const lf = result.checks.list_lead_forms;
  const fl = result.checks.fetch_leads_from_form;
  result.verdict = {
    can_implement_enrich:
      tp?.has_leads_retrieval && lp?.ok && lf?.ok && fl?.ok,
    missing: [
      !tp?.has_leads_retrieval && 'leads_retrieval permission',
      !lp?.ok && 'pages_show_list permission (cannot list pages)',
      !lf?.ok && 'lead forms (no forms found across pages)',
      !fl?.ok && 'leads_retrieval on the page that owns the forms',
    ].filter(Boolean),
  };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result, null, 2),
  };
};
