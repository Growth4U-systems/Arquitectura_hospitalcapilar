const { sendAlert } = require('./lib/alert');

const POSTHOG_HOST = 'https://eu.i.posthog.com';

/**
 * Netlify Scheduled Function — runs daily at 06:00 UTC.
 * Pulls yesterday's campaign spend from Google Ads and Meta Ads,
 * then sends each campaign as an `ad_spend_daily` event to PostHog.
 */
exports.handler = async () => {
  const yesterday = getYesterday();
  console.log(`[AdSpend] Syncing spend for ${yesterday}`);

  const results = { google: [], meta: [], errors: [] };

  // Google Ads
  try {
    const googleCampaigns = await fetchGoogleAdsSpend(yesterday);
    results.google = googleCampaigns;
    console.log(`[AdSpend] Google Ads: ${googleCampaigns.length} campaigns`);
  } catch (err) {
    results.errors.push(`Google Ads: ${err.message}`);
    console.log('[AdSpend] Google Ads error:', err.message);
  }

  // Meta Ads
  try {
    const metaCampaigns = await fetchMetaAdsSpend(yesterday);
    results.meta = metaCampaigns;
    console.log(`[AdSpend] Meta Ads: ${metaCampaigns.length} campaigns`);
  } catch (err) {
    results.errors.push(`Meta Ads: ${err.message}`);
    console.log('[AdSpend] Meta Ads error:', err.message);
  }

  // Send all campaigns to PostHog (await all to prevent premature process exit)
  const allCampaigns = [...results.google, ...results.meta];
  const posthogResults = await Promise.all(allCampaigns.map(campaign => trackAdSpend(campaign)));
  const posthogOk = posthogResults.filter(r => r === 'ok').length;
  const posthogSkipped = posthogResults.filter(r => r === 'skipped').length;
  const posthogFailed = posthogResults.filter(r => r === 'failed').length;

  console.log(`[AdSpend] Done. PostHog: ${posthogOk} ok, ${posthogSkipped} skipped, ${posthogFailed} failed. Errors: ${results.errors.length}`);

  // Alert if any ad platform sync failed
  if (results.errors.length > 0) {
    await sendAlert('sync-ad-spend', `Ad spend sync had ${results.errors.length} error(s)`, {
      severity: 'warning',
      date: yesterday,
      errors: results.errors,
    });
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      date: yesterday,
      google_campaigns: results.google.length,
      meta_campaigns: results.meta.length,
      posthog: { ok: posthogOk, skipped: posthogSkipped, failed: posthogFailed },
      errors: results.errors,
    }),
  };
};

// ─── Google Ads ────────────────────────────────────────

async function fetchGoogleAdsSpend(date) {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;  // 5559727380
  const mccId = process.env.GOOGLE_ADS_MCC_ID;             // 5915365707

  if (!clientId || !refreshToken || !developerToken || !customerId) {
    console.log('[AdSpend] Google Ads: missing env vars, skipping');
    return [];
  }

  // 1. Get access token from refresh token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`OAuth token refresh failed: ${tokenRes.status}`);
  }

  const { access_token } = await tokenRes.json();

  const apiHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${access_token}`,
    'developer-token': developerToken,
  };

  if (mccId) {
    apiHeaders['login-customer-id'] = mccId;
  }

  const apiUrl = `https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:searchStream`;

  async function runQuery(query) {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Google Ads API ${res.status}: ${errBody.substring(0, 200)}`);
    }
    return res.json();
  }

  // 2. Find campaigns that point to our landing pages (diagnostico.hospitalcapilar.com)
  const adsData = await runQuery(`
    SELECT campaign.id, ad_group_ad.ad.final_urls
    FROM ad_group_ad
    WHERE campaign.status = 'ENABLED'
  `);

  const ourCampaignIds = new Set();
  for (const batch of adsData) {
    for (const row of (batch.results || [])) {
      const urls = row.adGroupAd?.ad?.finalUrls || [];
      if (urls.some(u => u.includes('diagnostico.hospitalcapilar.com'))) {
        ourCampaignIds.add(String(row.campaign?.id || ''));
      }
    }
  }

  console.log(`[AdSpend] Google Ads: ${ourCampaignIds.size} campaigns target diagnostico.hospitalcapilar.com`);

  if (ourCampaignIds.size === 0) return [];

  // 3. Query metrics only for our campaigns
  const idList = [...ourCampaignIds].join(', ');
  const metricsData = await runQuery(`
    SELECT
      campaign.name,
      campaign.id,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions
    FROM campaign
    WHERE segments.date = '${date}'
      AND campaign.id IN (${idList})
  `);

  const campaigns = [];
  for (const batch of metricsData) {
    for (const row of (batch.results || [])) {
      campaigns.push({
        source: 'google_ads',
        campaign_name: row.campaign?.name || '',
        campaign_id: String(row.campaign?.id || ''),
        spend: (row.metrics?.costMicros || 0) / 1_000_000,
        clicks: Number(row.metrics?.clicks || 0),
        impressions: Number(row.metrics?.impressions || 0),
        conversions: Number(row.metrics?.conversions || 0),
        date,
      });
    }
  }

  return campaigns;
}

// ─── Meta Ads ──────────────────────────────────────────

async function fetchMetaAdsSpend(date) {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID; // act_xxxxxxxxx

  if (!accessToken || !adAccountId) {
    console.log('[AdSpend] Meta Ads: missing env vars, skipping');
    return [];
  }

  const params = new URLSearchParams({
    access_token: accessToken,
    fields: 'campaign_name,campaign_id,spend,clicks,impressions,actions',
    level: 'campaign',
    time_range: JSON.stringify({ since: date, until: date }),
    filtering: JSON.stringify([
      { field: 'spend', operator: 'GREATER_THAN', value: '0' },
    ]),
  });

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${adAccountId}/insights?${params}`
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Meta Ads API ${res.status}: ${errBody.substring(0, 200)}`);
  }

  const data = await res.json();

  return (data.data || []).map(row => {
    // Extract lead conversions from actions array
    const leadAction = (row.actions || []).find(a => a.action_type === 'lead');
    return {
      source: 'meta_ads',
      campaign_name: row.campaign_name || '',
      campaign_id: row.campaign_id || '',
      spend: parseFloat(row.spend || '0'),
      clicks: parseInt(row.clicks || '0', 10),
      impressions: parseInt(row.impressions || '0', 10),
      conversions: leadAction ? parseInt(leadAction.value, 10) : 0,
      date,
    };
  });
}

// ─── PostHog ───────────────────────────────────────────

async function trackAdSpend(campaign) {
  const posthogKey = process.env.VITE_POSTHOG_KEY;
  if (!posthogKey) {
    console.log('[PostHog] Missing VITE_POSTHOG_KEY, skipping ad spend capture');
    return 'skipped';
  }

  const payload = {
    api_key: posthogKey,
    event: 'ad_spend_daily',
    distinct_id: `ads-${campaign.source}`,
    timestamp: new Date().toISOString(),
    properties: {
      ...campaign,
      $lib: 'server-netlify',
    },
  };

  try {
    const res = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.log(`[PostHog] Ad spend capture failed (${res.status}): ${campaign.source} ${campaign.date}`);
      return 'failed';
    }
    return 'ok';
  } catch (err) {
    console.log('[PostHog] Ad spend capture failed:', err.message);
    return 'failed';
  }
}

// ─── Helpers ───────────────────────────────────────────

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}
