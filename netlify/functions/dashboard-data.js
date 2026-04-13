// Netlify Function: Dashboard Data from PostHog
// Fetches real analytics data via PostHog HogQL queries

const POSTHOG_HOST = 'https://eu.i.posthog.com';
const PROJECT_ID = '137870';
const LAUNCH_DATE = '2026-03-30';

async function hogqlQuery(apiKey, query) {
  const res = await fetch(`${POSTHOG_HOST}/api/projects/${PROJECT_ID}/query/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: {
        kind: 'HogQLQuery',
        query,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog query failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.results || [];
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=300',
  };

  // Auth check
  const params = event.queryStringParameters || {};
  const secret = process.env.DASHBOARD_SECRET || 'hc-dashboard-2026';
  if (params.key !== secret) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing POSTHOG_PERSONAL_API_KEY' }) };
  }

  const days = parseInt(params.days) || 30;

  try {
    // Use the later of LAUNCH_DATE or (now - days) as the start boundary
    const dateFilter = `AND timestamp >= greatest(toDateTime('${LAUNCH_DATE}'), now() - interval ${days} day)`;

    const [
      kpiPageviews,
      kpiStarted,
      kpiCompleted,
      kpiFormSubmitted,
      kpiBooked,
      kpiAttended,
      kpiNoShow,
      byTrafficSource,
      byFunnelType,
      byNicho,
      byEcp,
      dailyLeads,
      dailyLeadsBySource,
      attendedBySource,
      noShowBySource,
      adSpendBySource,
      adSpendDaily,
    ] = await Promise.all([
      // KPIs
      hogqlQuery(apiKey, `SELECT count(DISTINCT person_id) FROM events WHERE event = '$pageview' ${dateFilter}`),
      hogqlQuery(apiKey, `SELECT count(DISTINCT person_id) FROM events WHERE event IN ('quiz_started', 'short_quiz_started') ${dateFilter}`),
      hogqlQuery(apiKey, `SELECT count(DISTINCT person_id) FROM events WHERE event IN ('quiz_completed', 'short_quiz_completed') ${dateFilter}`),
      hogqlQuery(apiKey, `SELECT count(DISTINCT person_id) FROM events WHERE event = 'form_submitted' ${dateFilter}`),
      hogqlQuery(apiKey, `SELECT count(DISTINCT person_id) FROM events WHERE event = 'appointment_booked' ${dateFilter}`),
      hogqlQuery(apiKey, `SELECT count(DISTINCT person_id) FROM events WHERE event = 'appointment_attended' ${dateFilter}`),
      hogqlQuery(apiKey, `SELECT count(DISTINCT person_id) FROM events WHERE event = 'appointment_no_show' ${dateFilter}`),

      // By traffic source: leads, booked, attended, no-show (unique persons)
      hogqlQuery(apiKey, `
        SELECT
          properties.traffic_source as source,
          count(DISTINCT if(event = 'form_submitted', person_id, NULL)) as leads,
          count(DISTINCT if(event = 'appointment_booked', person_id, NULL)) as booked,
          count(DISTINCT if(event = 'appointment_attended', person_id, NULL)) as attended,
          count(DISTINCT if(event = 'appointment_no_show', person_id, NULL)) as no_show
        FROM events
        WHERE event IN ('form_submitted', 'appointment_booked', 'appointment_attended', 'appointment_no_show')
          ${dateFilter}
        GROUP BY properties.traffic_source
        ORDER BY leads DESC
      `),

      // By funnel type (unique persons)
      hogqlQuery(apiKey, `
        SELECT
          properties.funnel_type as funnel,
          count(DISTINCT if(event = 'form_submitted', person_id, NULL)) as leads,
          count(DISTINCT if(event = 'appointment_booked', person_id, NULL)) as booked
        FROM events
        WHERE event IN ('form_submitted', 'appointment_booked')
          ${dateFilter}
        GROUP BY properties.funnel_type
        ORDER BY leads DESC
      `),

      // By nicho (unique persons)
      hogqlQuery(apiKey, `
        SELECT properties.nicho as nicho, count(DISTINCT person_id) as cnt
        FROM events
        WHERE event = 'form_submitted'
          ${dateFilter}
        GROUP BY properties.nicho
        ORDER BY cnt DESC
      `),

      // ECP classification (unique persons)
      hogqlQuery(apiKey, `
        SELECT properties.ecp as ecp, count(DISTINCT person_id) as cnt
        FROM events
        WHERE event = 'lead_classified'
          ${dateFilter}
        GROUP BY properties.ecp
        ORDER BY cnt DESC
      `),

      // Daily leads (unique persons)
      hogqlQuery(apiKey, `
        SELECT toDate(timestamp) as day, count(DISTINCT person_id) as cnt
        FROM events
        WHERE event = 'form_submitted'
          ${dateFilter}
        GROUP BY day
        ORDER BY day ASC
      `),

      // Daily leads by source (unique persons)
      hogqlQuery(apiKey, `
        SELECT toDate(timestamp) as day, properties.traffic_source as source, count(DISTINCT person_id) as cnt
        FROM events
        WHERE event = 'form_submitted'
          ${dateFilter}
        GROUP BY day, source
        ORDER BY day ASC
      `),

      // Attended by source
      hogqlQuery(apiKey, `
        SELECT properties.traffic_source as source, count(DISTINCT person_id) as cnt
        FROM events
        WHERE event = 'appointment_attended'
          ${dateFilter}
        GROUP BY source
        ORDER BY cnt DESC
      `),

      // No-show by source
      hogqlQuery(apiKey, `
        SELECT properties.traffic_source as source, count(DISTINCT person_id) as cnt
        FROM events
        WHERE event = 'appointment_no_show'
          ${dateFilter}
        GROUP BY source
        ORDER BY cnt DESC
      `),

      // Ad spend by source (from ad_spend_daily events, deduplicated by $insert_id)
      hogqlQuery(apiKey, `
        SELECT
          properties.source as ad_source,
          sum(toFloatOrZero(toString(properties.spend))) as total_spend,
          sum(toIntOrZero(toString(properties.clicks))) as total_clicks,
          sum(toIntOrZero(toString(properties.impressions))) as total_impressions,
          sum(toIntOrZero(toString(properties.conversions))) as total_conversions
        FROM events
        WHERE event = 'ad_spend_daily'
          AND properties.$insert_id IS NOT NULL
          AND properties.source IN ('google_ads', 'meta_ads')
          ${dateFilter}
        GROUP BY properties.source
        ORDER BY total_spend DESC
      `),

      // Ad spend daily trend (deduplicated)
      hogqlQuery(apiKey, `
        SELECT
          properties.date as spend_date,
          properties.source as ad_source,
          sum(toFloatOrZero(toString(properties.spend))) as daily_spend
        FROM events
        WHERE event = 'ad_spend_daily'
          AND properties.$insert_id IS NOT NULL
          AND properties.source IN ('google_ads', 'meta_ads')
          ${dateFilter}
        GROUP BY properties.date, properties.source
        ORDER BY spend_date ASC
      `),
    ]);

    // Helper to extract single value
    const val = (result) => (result && result[0] && result[0][0]) || 0;

    const result = {
      days,
      launch_date: LAUNCH_DATE,
      generated_at: new Date().toISOString(),
      kpis: {
        pageviews: val(kpiPageviews),
        quiz_started: val(kpiStarted),
        quiz_completed: val(kpiCompleted),
        form_submitted: val(kpiFormSubmitted),
        appointment_booked: val(kpiBooked),
        appointment_attended: val(kpiAttended),
        appointment_no_show: val(kpiNoShow),
      },
      by_traffic_source: byTrafficSource.map(row => ({
        source: row[0],
        leads: row[1],
        booked: row[2],
        attended: row[3],
        no_show: row[4],
      })),
      by_funnel_type: byFunnelType.map(row => ({
        funnel: row[0],
        leads: row[1],
        booked: row[2],
      })),
      by_nicho: byNicho.map(row => ({
        nicho: row[0],
        count: row[1],
      })),
      by_ecp: byEcp.map(row => ({
        ecp: row[0],
        count: row[1],
      })),
      daily_leads: dailyLeads.map(row => ({
        date: row[0],
        count: row[1],
      })),
      daily_leads_by_source: dailyLeadsBySource.map(row => ({
        date: row[0],
        source: row[1],
        count: row[2],
      })),
      attended_by_source: attendedBySource.map(row => ({
        source: row[0],
        count: row[1],
      })),
      no_show_by_source: noShowBySource.map(row => ({
        source: row[0],
        count: row[1],
      })),
      ad_spend_by_source: adSpendBySource.map(row => ({
        source: row[0],
        spend: row[1],
        clicks: row[2],
        impressions: row[3],
        conversions: row[4],
      })),
      ad_spend_daily: adSpendDaily.map(row => ({
        date: row[0],
        source: row[1],
        spend: row[2],
      })),
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error('Dashboard data error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
