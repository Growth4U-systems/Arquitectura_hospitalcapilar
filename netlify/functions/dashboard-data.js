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

  // Support custom date range: ?start=2026-04-01&end=2026-04-14
  // Or preset: ?days=30
  const days = parseInt(params.days) || 30;
  const customStart = params.start; // YYYY-MM-DD
  const customEnd = params.end;     // YYYY-MM-DD

  try {
    let dateFilter;
    let effectiveStart, effectiveEnd;

    if (customStart && customEnd) {
      // Custom date range
      effectiveStart = customStart;
      effectiveEnd = customEnd;
      dateFilter = `AND timestamp >= toDateTime('${customStart}') AND timestamp < toDateTime('${customEnd}') + interval 1 day`;
    } else {
      // Preset days, bounded by launch date
      effectiveEnd = new Date().toISOString().split('T')[0];
      const daysAgo = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
      effectiveStart = daysAgo > LAUNCH_DATE ? daysAgo : LAUNCH_DATE;
      dateFilter = `AND timestamp >= greatest(toDateTime('${LAUNCH_DATE}'), now() - interval ${days} day)`;
    }

    // Ad spend uses properties.date (the actual spend date) instead of event timestamp
    let adDateFilter;
    if (customStart && customEnd) {
      adDateFilter = `AND properties.date >= '${customStart}' AND properties.date <= '${customEnd}'`;
    } else {
      adDateFilter = `AND properties.date >= '${effectiveStart}'`;
    }

    const [
      kpiPageviews,
      kpiStarted,
      kpiCompleted,
      kpiLeads,
      kpiBooked,
      kpiAttended,
      kpiNoShow,
      leadsBySource,
      bookingsBySource,
      byFunnelType,
      byNicho,
      byEcp,
      dailyLeads,
      dailyLeadsBySource,
      noShowBySource,
      adSpendBySource,
      adSpendDaily,
    ] = await Promise.all([
      // KPIs — each uses the right dedup strategy
      hogqlQuery(apiKey, `SELECT count(DISTINCT person_id) FROM events WHERE event = '$pageview' ${dateFilter}`),
      hogqlQuery(apiKey, `SELECT count(DISTINCT person_id) FROM events WHERE event IN ('quiz_started', 'short_quiz_started') ${dateFilter}`),
      hogqlQuery(apiKey, `SELECT count(DISTINCT person_id) FROM events WHERE event IN ('quiz_completed', 'short_quiz_completed') ${dateFilter}`),
      // Leads = form_submitted (fires when contact info is submitted)
      hogqlQuery(apiKey, `SELECT count() FROM events WHERE event = 'form_submitted' ${dateFilter}`),
      hogqlQuery(apiKey, `SELECT count(DISTINCT properties.$insert_id) FROM events WHERE event = 'appointment_booked' ${dateFilter}`),
      hogqlQuery(apiKey, `SELECT count(DISTINCT properties.$insert_id) FROM events WHERE event = 'appointment_attended' ${dateFilter}`),
      hogqlQuery(apiKey, `SELECT count(DISTINCT properties.$insert_id) FROM events WHERE event = 'appointment_no_show' ${dateFilter}`),

      // Leads by traffic source (separate query, quiz events only)
      hogqlQuery(apiKey, `
        SELECT
          properties.traffic_source as source,
          count() as leads
        FROM events
        WHERE event = 'form_submitted'
          ${dateFilter}
        GROUP BY properties.traffic_source
        ORDER BY leads DESC
      `),

      // Bookings by traffic source (separate query, GHL events only)
      hogqlQuery(apiKey, `
        SELECT
          properties.traffic_source as source,
          count(DISTINCT if(event = 'appointment_booked', properties.$insert_id, NULL)) as booked,
          count(DISTINCT if(event = 'appointment_attended', properties.$insert_id, NULL)) as attended,
          count(DISTINCT if(event = 'appointment_no_show', properties.$insert_id, NULL)) as no_show
        FROM events
        WHERE event IN ('appointment_booked', 'appointment_attended', 'appointment_no_show')
          ${dateFilter}
        GROUP BY properties.traffic_source
      `),

      // By funnel type
      hogqlQuery(apiKey, `
        SELECT
          properties.funnel_type as funnel,
          count() as leads
        FROM events
        WHERE event = 'form_submitted'
          ${dateFilter}
        GROUP BY properties.funnel_type
        ORDER BY leads DESC
      `),

      // By nicho
      hogqlQuery(apiKey, `
        SELECT properties.nicho as nicho, count() as cnt
        FROM events
        WHERE event IN ('quiz_completed', 'short_quiz_completed')
          ${dateFilter}
        GROUP BY properties.nicho
        ORDER BY cnt DESC
      `),

      // ECP classification
      hogqlQuery(apiKey, `
        SELECT properties.ecp as ecp, count() as cnt
        FROM events
        WHERE event = 'lead_classified'
          ${dateFilter}
        GROUP BY properties.ecp
        ORDER BY cnt DESC
      `),

      // Daily leads
      hogqlQuery(apiKey, `
        SELECT toDate(timestamp) as day, count() as cnt
        FROM events
        WHERE event = 'form_submitted'
          ${dateFilter}
        GROUP BY day
        ORDER BY day ASC
      `),

      // Daily leads by source
      hogqlQuery(apiKey, `
        SELECT toDate(timestamp) as day, properties.traffic_source as source, count() as cnt
        FROM events
        WHERE event = 'form_submitted'
          ${dateFilter}
        GROUP BY day, source
        ORDER BY day ASC
      `),

      // No-show by source
      hogqlQuery(apiKey, `
        SELECT properties.traffic_source as source,
          count(DISTINCT properties.$insert_id) as cnt
        FROM events
        WHERE event = 'appointment_no_show'
          ${dateFilter}
        GROUP BY source
        ORDER BY cnt DESC
      `),

      // Ad spend by source — filter on properties.date, not event timestamp
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
          ${adDateFilter}
        GROUP BY properties.source
        ORDER BY total_spend DESC
      `),

      // Ad spend daily trend — filter on properties.date
      hogqlQuery(apiKey, `
        SELECT
          properties.date as spend_date,
          properties.source as ad_source,
          sum(toFloatOrZero(toString(properties.spend))) as daily_spend
        FROM events
        WHERE event = 'ad_spend_daily'
          AND properties.$insert_id IS NOT NULL
          AND properties.source IN ('google_ads', 'meta_ads')
          ${adDateFilter}
        GROUP BY properties.date, properties.source
        ORDER BY spend_date ASC
      `),
    ]);

    // Helper to extract single value
    const val = (result) => (result && result[0] && result[0][0]) || 0;

    // Merge leads and bookings by traffic source
    const sourceMap = {};
    for (const row of leadsBySource) {
      const src = row[0];
      if (!sourceMap[src]) sourceMap[src] = { leads: 0, booked: 0, attended: 0, no_show: 0 };
      sourceMap[src].leads = row[1];
    }
    for (const row of bookingsBySource) {
      const src = row[0];
      if (!sourceMap[src]) sourceMap[src] = { leads: 0, booked: 0, attended: 0, no_show: 0 };
      sourceMap[src].booked = row[1];
      sourceMap[src].attended = row[2];
      sourceMap[src].no_show = row[3];
    }
    const byTrafficSource = Object.entries(sourceMap)
      .map(([source, data]) => ({ source, ...data }))
      .sort((a, b) => b.leads - a.leads);

    const result = {
      days,
      start: effectiveStart,
      end: effectiveEnd,
      launch_date: LAUNCH_DATE,
      generated_at: new Date().toISOString(),
      kpis: {
        pageviews: val(kpiPageviews),
        quiz_started: val(kpiStarted),
        quiz_completed: val(kpiCompleted),
        form_submitted: val(kpiLeads),
        appointment_booked: val(kpiBooked),
        appointment_attended: val(kpiAttended),
        appointment_no_show: val(kpiNoShow),
      },
      by_traffic_source: byTrafficSource,
      by_funnel_type: byFunnelType.map(row => ({
        funnel: row[0],
        leads: row[1],
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
      attended_by_source: [],
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
