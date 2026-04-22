#!/usr/bin/env node
// Google Ads diagnostic: inspects tracking templates / final URL suffix
// at account, campaign, ad-group and ad level to tell us what UTMs
// (ValueTrack params) are being injected on clicks.
//
// In Google Ads the cascade is:
//   customer.final_url_suffix  →  campaign.final_url_suffix  →  ad_group.final_url_suffix
//   customer.tracking_url_template → campaign.tracking_url_template → ad_group.tracking_url_template → ad.tracking_url_template
// The most specific non-empty wins.

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN;
const DEV_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID;
const MCC_ID = process.env.GOOGLE_ADS_MCC_ID;

if (!CLIENT_ID || !REFRESH_TOKEN || !DEV_TOKEN || !CUSTOMER_ID) {
  console.error('Missing Google Ads env vars');
  process.exit(1);
}

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`OAuth refresh failed: ${res.status}`);
  const { access_token } = await res.json();
  return access_token;
}

(async () => {
  const token = await getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'developer-token': DEV_TOKEN,
    ...(MCC_ID ? { 'login-customer-id': MCC_ID } : {}),
  };
  const api = `https://googleads.googleapis.com/v20/customers/${CUSTOMER_ID}/googleAds:searchStream`;

  async function q(query) {
    const r = await fetch(api, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Google Ads ${r.status}: ${t.substring(0, 500)}`);
    }
    return r.json();
  }

  // 1. Account-level templates
  console.log('─── Account level ───');
  const acct = await q(`
    SELECT
      customer.id,
      customer.descriptive_name,
      customer.tracking_url_template,
      customer.final_url_suffix
    FROM customer
  `);
  const acctRow = acct[0]?.results?.[0]?.customer || {};
  console.log({
    id: acctRow.id,
    name: acctRow.descriptiveName,
    tracking_url_template: acctRow.trackingUrlTemplate || '(none)',
    final_url_suffix: acctRow.finalUrlSuffix || '(none)',
  });

  // 2. Identify campaigns that land on diagnostico.hospitalcapilar.com
  console.log('\n─── Identifying HC campaigns ───');
  const adsUrls = await q(`
    SELECT
      campaign.id,
      campaign.name,
      ad_group_ad.ad.final_urls
    FROM ad_group_ad
    WHERE campaign.status = 'ENABLED'
  `);
  const hcCampaignIds = new Set();
  for (const batch of adsUrls) {
    for (const row of (batch.results || [])) {
      const urls = row.adGroupAd?.ad?.finalUrls || [];
      if (urls.some(u => u.includes('diagnostico.hospitalcapilar.com'))) {
        hcCampaignIds.add(String(row.campaign?.id || ''));
      }
    }
  }
  console.log(`HC campaigns (enabled, landing on diagnostico.hc.com): ${hcCampaignIds.size}`);
  if (hcCampaignIds.size === 0) {
    console.log('No HC campaigns found.');
    return;
  }
  const idList = [...hcCampaignIds].join(', ');

  // 3. Campaign-level templates
  console.log('\n─── Campaigns ───');
  const camps = await q(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.tracking_url_template,
      campaign.final_url_suffix
    FROM campaign
    WHERE campaign.id IN (${idList})
  `);
  const campRows = [];
  for (const batch of camps) {
    for (const row of (batch.results || [])) {
      const c = row.campaign;
      campRows.push({
        id: c.id,
        name: (c.name || '').substring(0, 40),
        tracking_url_template: c.trackingUrlTemplate || '(none)',
        final_url_suffix: c.finalUrlSuffix || '(none)',
      });
    }
  }
  console.table(campRows);

  // 4. Ad-group level
  console.log('\n─── Ad groups ───');
  const ags = await q(`
    SELECT
      ad_group.id,
      ad_group.name,
      campaign.id,
      ad_group.tracking_url_template,
      ad_group.final_url_suffix
    FROM ad_group
    WHERE campaign.id IN (${idList})
      AND ad_group.status = 'ENABLED'
  `);
  const agRows = [];
  for (const batch of ags) {
    for (const row of (batch.results || [])) {
      agRows.push({
        campaign_id: row.campaign?.id,
        adgroup_id: row.adGroup?.id,
        adgroup_name: (row.adGroup?.name || '').substring(0, 30),
        tracking_url_template: row.adGroup?.trackingUrlTemplate || '(none)',
        final_url_suffix: row.adGroup?.finalUrlSuffix || '(none)',
      });
    }
  }
  console.table(agRows.slice(0, 20));
  console.log(`Total ad groups: ${agRows.length}`);

  // 5. Ad level — tracking_url_template, final_urls, url_custom_parameters
  console.log('\n─── Ads (sample) ───');
  const adsData = await q(`
    SELECT
      ad_group_ad.ad.id,
      ad_group_ad.ad.name,
      ad_group_ad.ad.type,
      ad_group_ad.ad.final_urls,
      ad_group_ad.ad.tracking_url_template,
      ad_group_ad.ad.url_custom_parameters,
      ad_group.id,
      campaign.id,
      campaign.name
    FROM ad_group_ad
    WHERE campaign.id IN (${idList})
      AND ad_group_ad.status = 'ENABLED'
  `);
  const adRows = [];
  let totalAds = 0;
  let adsWithTemplate = 0;
  let adsWithUtmContentInFinalUrl = 0;
  let adsWithAdIdMacro = 0;
  const utmContentValues = new Set();
  const utmCampaignValues = new Set();

  for (const batch of adsData) {
    for (const row of (batch.results || [])) {
      totalAds++;
      const ad = row.adGroupAd?.ad || {};
      const finalUrls = ad.finalUrls || [];
      const first = finalUrls[0] || '';
      const tpl = ad.trackingUrlTemplate || '';
      if (tpl) adsWithTemplate++;

      // Extract any utm_* params from finalUrl + tracking_template
      const combined = first + '&' + tpl;
      const utmMatches = combined.match(/utm_\w+=[^&]*/g) || [];
      const utmMap = {};
      utmMatches.forEach(m => {
        const [k, v] = m.split('=');
        utmMap[k] = decodeURIComponent(v || '');
      });
      if (utmMap.utm_content) {
        adsWithUtmContentInFinalUrl++;
        utmContentValues.add(utmMap.utm_content);
      }
      if (utmMap.utm_campaign) utmCampaignValues.add(utmMap.utm_campaign);
      if (/\{creative\}|\{adid\}/i.test(combined)) adsWithAdIdMacro++;

      if (adRows.length < 30) {
        adRows.push({
          campaign: (row.campaign?.name || '').substring(0, 25),
          ad_id: ad.id,
          type: (ad.type || '').substring(0, 18),
          final_url: first.substring(0, 80),
          tracking_template: tpl ? tpl.substring(0, 80) : '(none)',
        });
      }
    }
  }

  console.table(adRows);

  console.log('\n─── Summary ───');
  console.log(`Total enabled HC ads inspected: ${totalAds}`);
  console.log(`Ads with ad-level tracking_url_template: ${adsWithTemplate}`);
  console.log(`Ads with utm_content in final_url or template: ${adsWithUtmContentInFinalUrl}`);
  console.log(`Ads using {creative} or {adid} ValueTrack macro: ${adsWithAdIdMacro}`);
  console.log(`Distinct utm_content values (${utmContentValues.size}): ${[...utmContentValues].slice(0, 15).join(' | ')}${utmContentValues.size > 15 ? ' …' : ''}`);
  console.log(`Distinct utm_campaign values (${utmCampaignValues.size}): ${[...utmCampaignValues].slice(0, 10).join(' | ')}`);

  console.log('\n─── Verdict ───');
  const acctHasTemplate = !!(acctRow.trackingUrlTemplate || acctRow.finalUrlSuffix);
  const anyCampHasTemplate = campRows.some(c => c.tracking_url_template !== '(none)' || c.final_url_suffix !== '(none)');
  if (!acctHasTemplate && !anyCampHasTemplate && adsWithTemplate === 0 && adsWithUtmContentInFinalUrl === 0) {
    console.log('⚠️  Ningún nivel lleva tracking template ni UTM. Hay que setear final_url_suffix a nivel cuenta.');
  } else {
    console.log('✅  Alguna configuración de tracking existe. Revisa la tabla arriba para ver dónde.');
  }
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
