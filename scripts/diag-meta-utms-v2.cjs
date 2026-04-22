#!/usr/bin/env node
// Deeper inspection: account-level templates + raw creative structure for one ad.

const TOKEN = process.env.META_ACCESS_TOKEN;
const ACCOUNT = process.env.META_AD_ACCOUNT_ID;
const GRAPH = 'https://graph.facebook.com/v21.0';

async function graph(path, params = {}) {
  const qs = new URLSearchParams({ access_token: TOKEN, ...params }).toString();
  const res = await fetch(`${GRAPH}/${path}?${qs}`);
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${path}: ${body.substring(0, 400)}`);
  return JSON.parse(body);
}

(async () => {
  // 1. Account-level tracking / url template
  const acct = await graph(ACCOUNT, {
    fields: 'name,account_status,currency,timezone_name',
  });
  console.log('─── Account ───');
  console.log(acct);

  // 2. List G4U ads and pick one active to inspect deeply
  const ads = await graph(`${ACCOUNT}/ads`, {
    fields: 'id,name,effective_status,campaign{name},creative{id}',
    limit: 100,
  });
  const g4u = (ads.data || []).filter(a => ((a.campaign && a.campaign.name) || '').toLowerCase().includes('g4u') || ((a.campaign && a.campaign.name) || '').toLowerCase().includes('pasa') || ((a.campaign && a.campaign.name) || '').toLowerCase().includes('postparto') || ((a.campaign && a.campaign.name) || '').toLowerCase().includes('menopausia'));
  console.log(`\nG4U-ish ads found: ${g4u.length}`);

  const active = g4u.filter(a => a.effective_status === 'ACTIVE');
  if (active.length === 0) {
    console.log('No active ads to inspect');
    return;
  }

  const target = active[0];
  console.log(`\n─── Inspecting ad ${target.id} ("${target.name}") ───`);

  const creativeId = target.creative && target.creative.id;
  if (!creativeId) {
    console.log('No creative id');
    return;
  }

  const creative = await graph(creativeId, {
    fields: 'id,name,url_tags,template_url,object_story_spec,effective_object_story_id,object_story_id,link_url,object_type,asset_feed_spec,call_to_action_type',
  });
  console.log('\nRaw creative:');
  console.log(JSON.stringify(creative, null, 2));

  // 3. Check two more actives for variety
  console.log('\n─── Quick scan of 5 more active ads ───');
  for (const ad of active.slice(1, 6)) {
    const cid = ad.creative && ad.creative.id;
    if (!cid) continue;
    const c = await graph(cid, {
      fields: 'id,url_tags,template_url,object_story_spec{link_data{link,message}},asset_feed_spec{link_urls}',
    });
    const linkFromStory = (c.object_story_spec && c.object_story_spec.link_data && c.object_story_spec.link_data.link) || '';
    const linkFromAsset = (c.asset_feed_spec && c.asset_feed_spec.link_urls && c.asset_feed_spec.link_urls[0] && c.asset_feed_spec.link_urls[0].website_url) || '';
    console.log({
      ad_id: ad.id,
      ad_name: ad.name,
      url_tags: c.url_tags || '(none)',
      template_url: c.template_url || '(none)',
      story_link: linkFromStory || '(none)',
      asset_link: linkFromAsset || '(none)',
    });
  }
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
