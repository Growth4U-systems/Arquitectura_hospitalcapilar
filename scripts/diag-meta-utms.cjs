#!/usr/bin/env node
// Meta Ads diagnostic: inspects active G4U ads and reports the UTM
// convention they use (url_tags on the creative). Output tells us whether
// utm_content={{ad.id}} is already set, or if we need to fix the templates.
//
// Usage:
//   META_ACCESS_TOKEN=... META_AD_ACCOUNT_ID=act_... node scripts/diag-meta-utms.cjs

const TOKEN = process.env.META_ACCESS_TOKEN;
const ACCOUNT = process.env.META_AD_ACCOUNT_ID;
const GRAPH = 'https://graph.facebook.com/v21.0';

if (!TOKEN || !ACCOUNT) {
  console.error('Missing META_ACCESS_TOKEN or META_AD_ACCOUNT_ID');
  process.exit(1);
}

async function graph(path, params = {}) {
  const qs = new URLSearchParams({ access_token: TOKEN, ...params }).toString();
  const res = await fetch(`${GRAPH}/${path}?${qs}`);
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${path}: ${body.substring(0, 300)}`);
  return JSON.parse(body);
}

async function paginate(path, params, max = 500) {
  const all = [];
  let next = null;
  let cursor = { ...params, limit: 100 };
  while (all.length < max) {
    const page = next
      ? await (async () => { const r = await fetch(next); return r.json(); })()
      : await graph(path, cursor);
    if (page.data) all.push(...page.data);
    next = page.paging && page.paging.next;
    if (!next) break;
  }
  return all;
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

function extractQuery(url) {
  if (!url) return {};
  const idx = url.indexOf('?');
  if (idx < 0) return {};
  const q = url.substring(idx + 1).split('#')[0];
  return parseUrlTags(q);
}

(async () => {
  console.log(`Inspecting ${ACCOUNT} …`);

  const ads = await paginate(`${ACCOUNT}/ads`, {
    fields: [
      'id',
      'name',
      'status',
      'effective_status',
      'campaign{id,name}',
      'adset{id,name}',
      'creative{id,url_tags,object_story_spec,template_url,link_og_id}',
      'tracking_specs',
    ].join(','),
  });

  console.log(`Total ads in account: ${ads.length}`);

  const g4u = ads.filter(a => {
    const cname = (a.campaign && a.campaign.name) || '';
    return cname.includes('G4U') || cname.toLowerCase().includes('hospitalcapilar') || cname.toLowerCase().includes('hospital capilar');
  });

  console.log(`G4U / Hospital Capilar ads: ${g4u.length}`);
  console.log('');

  const active = g4u.filter(a => a.effective_status === 'ACTIVE');
  const sample = active.length > 0 ? active : g4u;

  const rows = [];
  const utmContentValues = new Set();
  const utmCampaignValues = new Set();
  const utmSourceValues = new Set();
  let withUrlTags = 0;
  let withAdIdMacro = 0;

  for (const ad of sample.slice(0, 60)) {
    const creative = ad.creative || {};
    const urlTagsRaw = creative.url_tags || '';
    const tags = parseUrlTags(urlTagsRaw);

    const linkUrl =
      (creative.object_story_spec && creative.object_story_spec.link_data && creative.object_story_spec.link_data.link) ||
      creative.template_url ||
      '';
    const linkQuery = extractQuery(linkUrl);

    const merged = { ...linkQuery, ...tags };

    if (urlTagsRaw) withUrlTags++;
    const contentVal = merged.utm_content || '';
    if (contentVal.includes('{{ad.id}}') || contentVal.includes('{{ad.name}}')) withAdIdMacro++;
    if (contentVal) utmContentValues.add(contentVal);
    if (merged.utm_campaign) utmCampaignValues.add(merged.utm_campaign);
    if (merged.utm_source) utmSourceValues.add(merged.utm_source);

    rows.push({
      ad_id: ad.id,
      ad_name: (ad.name || '').substring(0, 50),
      status: ad.effective_status,
      campaign: ((ad.campaign && ad.campaign.name) || '').substring(0, 40),
      utm_source: merged.utm_source || '',
      utm_campaign: merged.utm_campaign || '',
      utm_content: contentVal,
      utm_medium: merged.utm_medium || '',
      url_tags_set: !!urlTagsRaw,
      link: linkUrl ? linkUrl.split('?')[0] : '',
    });
  }

  console.log('─── Per-ad sample (first 30) ───');
  console.table(rows.slice(0, 30));

  console.log('\n─── Summary ───');
  console.log(`Ads inspected: ${sample.length}`);
  console.log(`With creative.url_tags set: ${withUrlTags}`);
  console.log(`Using {{ad.id}} or {{ad.name}} macro in utm_content: ${withAdIdMacro}`);
  console.log(`Distinct utm_source values (${utmSourceValues.size}): ${[...utmSourceValues].join(' | ')}`);
  console.log(`Distinct utm_campaign values (${utmCampaignValues.size}): ${[...utmCampaignValues].slice(0, 10).join(' | ')}${utmCampaignValues.size > 10 ? ' …' : ''}`);
  console.log(`Distinct utm_content values (${utmContentValues.size}): ${[...utmContentValues].slice(0, 15).join(' | ')}${utmContentValues.size > 15 ? ' …' : ''}`);

  if (utmContentValues.size < sample.length * 0.5 && sample.length > 4) {
    console.log('\n⚠️  utm_content no es único por anuncio — hay que cambiar la convención a {{ad.id}}');
  } else if (withAdIdMacro > 0) {
    console.log('\n✅  Al menos algunos anuncios ya usan {{ad.id}} dinámico — convención OK');
  } else if (utmContentValues.size >= sample.length * 0.8) {
    console.log('\n✅  utm_content parece único por anuncio — aunque no use macro, vale como identificador estable');
  }
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
