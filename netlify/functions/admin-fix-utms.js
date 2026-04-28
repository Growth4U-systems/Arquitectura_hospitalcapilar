// One-shot admin endpoint to detect + fix broken utm_content in Meta + Google.
// Dry-run by default. Pass ?apply=true to actually mutate the platforms.
// Auth via ?key=<DASHBOARD_SECRET>.
//
// What "broken" means:
//   Meta: creative.url_tags either contains a "***...***" placeholder or a
//         literal "{{ad.id}}" macro that never substituted. We rewrite the
//         creative's url_tags to a canonical template.
//   Google: campaign.tracking_url_template contains "{adgroupid}" (loses
//           per-ad granularity). We propose switching to "{creative}" so each
//           ad gets a unique utm_content.

const META_GRAPH = 'https://graph.facebook.com/v21.0';
const CANONICAL_META_URL_TAGS = [
  'utm_source=facebook',
  'utm_medium=paid_social',
  'utm_campaign={{campaign.name}}',
  'utm_content={{ad.id}}',
  'utm_term={{adset.name}}',
].join('&');

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const secret = process.env.DASHBOARD_SECRET || 'hc-dashboard-2026';
  if (params.key !== secret) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const apply = params.apply === 'true';
  const platform = params.platform || 'all'; // 'meta' | 'google' | 'all'

  const result = {
    dry_run: !apply,
    timestamp: new Date().toISOString(),
  };

  if (platform === 'meta' || platform === 'all') {
    try {
      result.meta = await diagnoseMeta(apply);
    } catch (e) {
      result.meta = { error: e.message };
    }
  }
  if (platform === 'google' || platform === 'all') {
    try {
      result.google = await diagnoseGoogle(apply);
    } catch (e) {
      result.google = { error: e.message };
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result, null, 2),
  };
};

// ─── Meta ─────────────────────────────────────────────────

function isBrokenMetaUtmContent(utmContent) {
  if (!utmContent) return { broken: true, reason: 'empty' };
  if (/^\*+.+\*+$/.test(utmContent)) return { broken: true, reason: 'placeholder' };
  if (/^\{\{.+\}\}$/.test(utmContent) && !utmContent.includes('{{ad.id}}')) {
    return { broken: true, reason: 'macro-literal' };
  }
  return { broken: false };
}

function parseUrlTags(urlTags) {
  if (!urlTags) return {};
  const out = {};
  urlTags.split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k) out[decodeURIComponent(k)] = v ? decodeURIComponent(v) : '';
  });
  return out;
}

async function diagnoseMeta(apply) {
  const token = process.env.META_ACCESS_TOKEN;
  const account = process.env.META_AD_ACCOUNT_ID;
  if (!token || !account) return { error: 'Missing META_ACCESS_TOKEN or META_AD_ACCOUNT_ID' };

  const fields = [
    'id', 'name', 'effective_status',
    'campaign{id,name}',
    'adset{id,name}',
    'creative{id,url_tags}',
  ].join(',');
  const url = `${META_GRAPH}/${account}/ads?fields=${fields}&limit=500&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Meta read failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const ads = data.data || [];

  const isG4U = (camp) => /G4U|Postparto_G4U|Menopausia G4U|¿Qué me pasa/i.test(camp || '');
  const broken = [];
  const ok = [];

  for (const a of ads) {
    if (!isG4U(a.campaign?.name)) continue;
    const creative = a.creative || {};
    const urlTags = creative.url_tags || '';
    const tags = parseUrlTags(urlTags);
    const check = isBrokenMetaUtmContent(tags.utm_content);
    const row = {
      ad_id: a.id,
      ad_name: a.name,
      campaign_name: a.campaign?.name,
      adset_name: a.adset?.name,
      effective_status: a.effective_status,
      creative_id: creative.id,
      current_utm_content: tags.utm_content || '',
      current_url_tags: urlTags,
    };
    if (check.broken) {
      row.reason = check.reason;
      row.proposed_url_tags = CANONICAL_META_URL_TAGS;
      broken.push(row);
    } else {
      ok.push(row);
    }
  }

  const summary = {
    g4u_ads_inspected: broken.length + ok.length,
    broken_count: broken.length,
    ok_count: ok.length,
    canonical_template: CANONICAL_META_URL_TAGS,
  };

  if (!apply || broken.length === 0) {
    return { ...summary, broken_ads: broken };
  }

  // Apply: update each broken creative's url_tags. Meta lets you POST to the
  // creative endpoint with url_tags as a write field on creatives that have
  // not yet been deeply locked.
  const applied = [];
  for (const row of broken) {
    try {
      const updateUrl = `${META_GRAPH}/${row.creative_id}`;
      const body = new URLSearchParams({
        url_tags: CANONICAL_META_URL_TAGS,
        access_token: token,
      });
      const upd = await fetch(updateUrl, { method: 'POST', body });
      const text = await upd.text();
      applied.push({
        ad_id: row.ad_id,
        creative_id: row.creative_id,
        ok: upd.ok,
        status: upd.status,
        response: text.slice(0, 300),
      });
    } catch (e) {
      applied.push({ ad_id: row.ad_id, creative_id: row.creative_id, ok: false, error: e.message });
    }
  }

  return {
    ...summary,
    applied_count: applied.filter(x => x.ok).length,
    failed_count: applied.filter(x => !x.ok).length,
    broken_ads: broken,
    apply_results: applied,
  };
}

// ─── Google Ads ───────────────────────────────────────────

async function getGoogleAccessToken() {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  if (!clientId || !refreshToken) return null;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) return null;
  const { access_token } = await res.json();
  return access_token;
}

async function diagnoseGoogle(apply) {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  const mccId = process.env.GOOGLE_ADS_MCC_ID;
  if (!developerToken || !customerId) return { error: 'Missing GOOGLE_ADS_DEVELOPER_TOKEN or GOOGLE_ADS_CUSTOMER_ID' };

  const accessToken = await getGoogleAccessToken();
  if (!accessToken) return { error: 'OAuth token refresh failed' };

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'developer-token': developerToken,
  };
  if (mccId) headers['login-customer-id'] = mccId;

  const search = `https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:searchStream`;
  const runQuery = async (query) => {
    const r = await fetch(search, { method: 'POST', headers, body: JSON.stringify({ query }) });
    if (!r.ok) throw new Error(`Google read failed: ${r.status} ${(await r.text()).slice(0, 300)}`);
    return r.json();
  };

  // 1) Find G4U-relevant campaigns (those whose ads target our landing).
  const adsData = await runQuery(`
    SELECT campaign.id, ad_group_ad.ad.final_urls
    FROM ad_group_ad
    WHERE campaign.status = 'ENABLED'
  `);
  const ourCampaignIds = new Set();
  for (const batch of (adsData || [])) {
    for (const row of (batch.results || [])) {
      const urls = row.adGroupAd?.ad?.finalUrls || [];
      if (urls.some(u => u.includes('diagnostico.hospitalcapilar.com'))) {
        ourCampaignIds.add(String(row.campaign?.id || ''));
      }
    }
  }
  if (ourCampaignIds.size === 0) {
    return { campaigns_inspected: 0, broken_count: 0, broken_campaigns: [] };
  }
  const idList = [...ourCampaignIds].join(', ');

  // 2) Read tracking templates.
  const tplData = await runQuery(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.tracking_url_template,
      campaign.final_url_suffix
    FROM campaign
    WHERE campaign.id IN (${idList})
  `);

  const broken = [];
  const ok = [];
  for (const batch of (tplData || [])) {
    for (const row of (batch.results || [])) {
      const tracking = row.campaign?.trackingUrlTemplate || '';
      const suffix   = row.campaign?.finalUrlSuffix || '';
      const haystack = (tracking + ' ' + suffix).toLowerCase();
      const usesAdgroupId = /\{adgroupid\}/.test(haystack);
      const usesCreative  = /\{creative\}/.test(haystack);
      const item = {
        campaign_id: String(row.campaign?.id || ''),
        campaign_name: row.campaign?.name || '',
        tracking_url_template: tracking,
        final_url_suffix: suffix,
      };
      if (usesAdgroupId && !usesCreative) {
        item.reason = 'tracks-only-adgroup';
        item.proposed_change = 'Replace {adgroupid} with {creative} for per-ad granularity';
        broken.push(item);
      } else {
        ok.push(item);
      }
    }
  }

  const summary = {
    g4u_campaigns_inspected: broken.length + ok.length,
    broken_count: broken.length,
    ok_count: ok.length,
  };

  if (!apply || broken.length === 0) {
    return { ...summary, broken_campaigns: broken };
  }

  // Apply: replace {adgroupid} with {creative} in tracking_url_template /
  // final_url_suffix. Use campaigns:mutate updateMask path.
  const mutateUrl = `https://googleads.googleapis.com/v20/customers/${customerId}/campaigns:mutate`;
  const operations = broken.map(b => {
    const newTracking = (b.tracking_url_template || '').replace(/\{adgroupid\}/gi, '{creative}');
    const newSuffix   = (b.final_url_suffix || '').replace(/\{adgroupid\}/gi, '{creative}');
    const updateMask = [];
    const update = {
      resourceName: `customers/${customerId}/campaigns/${b.campaign_id}`,
    };
    if (newTracking !== b.tracking_url_template) {
      update.trackingUrlTemplate = newTracking;
      updateMask.push('tracking_url_template');
    }
    if (newSuffix !== b.final_url_suffix) {
      update.finalUrlSuffix = newSuffix;
      updateMask.push('final_url_suffix');
    }
    return { update, updateMask: updateMask.join(',') };
  }).filter(op => op.updateMask);

  if (operations.length === 0) {
    return { ...summary, broken_campaigns: broken, applied_count: 0, note: 'Nothing to mutate after diff' };
  }

  const mutateRes = await fetch(mutateUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ operations }),
  });
  const mutateText = await mutateRes.text();
  return {
    ...summary,
    broken_campaigns: broken,
    apply_results: {
      ok: mutateRes.ok,
      status: mutateRes.status,
      response: mutateText.slice(0, 1000),
    },
  };
}
