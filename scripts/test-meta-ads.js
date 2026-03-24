/**
 * Quick test: verify Meta Ads API connection
 * Usage: node scripts/test-meta-ads.js
 */

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || 'act_898774584294194';

async function test() {
  if (!ACCESS_TOKEN) {
    console.error('Missing META_ACCESS_TOKEN env var');
    console.log('Usage: META_ACCESS_TOKEN=EAA... node scripts/test-meta-ads.js');
    process.exit(1);
  }

  console.log('Testing Meta Ads API...');
  console.log(`Ad Account: ${AD_ACCOUNT_ID}`);

  // 1. Test account access
  const params = new URLSearchParams({
    access_token: ACCESS_TOKEN,
    fields: 'name,account_id,currency,timezone_name',
  });

  const accountRes = await fetch(`https://graph.facebook.com/v21.0/${AD_ACCOUNT_ID}?${params}`);
  const account = await accountRes.json();

  if (account.error) {
    console.error('Account access failed:', account.error.message);
    process.exit(1);
  }

  console.log('\nAccount info:');
  console.log(`  Name: ${account.name}`);
  console.log(`  ID: ${account.account_id}`);
  console.log(`  Currency: ${account.currency}`);
  console.log(`  Timezone: ${account.timezone_name}`);

  // 2. Fetch recent campaign spend (last 7 days)
  const insightsParams = new URLSearchParams({
    access_token: ACCESS_TOKEN,
    fields: 'campaign_name,campaign_id,spend,clicks,impressions,actions',
    level: 'campaign',
    date_preset: 'last_7d',
  });

  const insightsRes = await fetch(`https://graph.facebook.com/v21.0/${AD_ACCOUNT_ID}/insights?${insightsParams}`);
  const insights = await insightsRes.json();

  if (insights.error) {
    console.error('Insights failed:', insights.error.message);
    process.exit(1);
  }

  const campaigns = insights.data || [];
  console.log(`\nCampaigns with spend (last 7 days): ${campaigns.length}`);

  for (const c of campaigns) {
    const leads = (c.actions || []).find(a => a.action_type === 'lead');
    console.log(`  ${c.campaign_name}: €${c.spend} | ${c.clicks} clicks | ${c.impressions} impressions${leads ? ` | ${leads.value} leads` : ''}`);
  }

  console.log('\nMeta Ads connection OK!');
}

test().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
