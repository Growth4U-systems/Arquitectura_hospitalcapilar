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
      quizDropoff,
    ] = await Promise.all([
      // KPIs — all use count() for funnel consistency
      hogqlQuery(apiKey, `SELECT count() FROM events WHERE event = '$pageview' ${dateFilter}`),
      hogqlQuery(apiKey, `SELECT count() FROM events WHERE event IN ('quiz_started', 'short_quiz_started') ${dateFilter}`),
      hogqlQuery(apiKey, `SELECT count() FROM events WHERE event IN ('quiz_completed', 'short_quiz_completed') ${dateFilter}`),
      hogqlQuery(apiKey, `SELECT count() FROM events WHERE event IN ('form_submitted', 'direct_form_submitted') ${dateFilter}`),
      // Bookings: filter _v3 to avoid duplicates from old sync versions
      hogqlQuery(apiKey, `SELECT count() FROM events WHERE event = 'appointment_booked' AND toString(properties.$insert_id) LIKE '%_v4' ${dateFilter}`),
      hogqlQuery(apiKey, `SELECT count() FROM events WHERE event = 'appointment_attended' AND toString(properties.$insert_id) LIKE '%_v4' ${dateFilter}`),
      hogqlQuery(apiKey, `SELECT count() FROM events WHERE event = 'appointment_no_show' AND toString(properties.$insert_id) LIKE '%_v4' ${dateFilter}`),

      // Leads by traffic source (separate query, quiz events only)
      hogqlQuery(apiKey, `
        SELECT
          properties.traffic_source as source,
          count() as leads
        FROM events
        WHERE event IN ('form_submitted', 'direct_form_submitted')
          ${dateFilter}
        GROUP BY properties.traffic_source
        ORDER BY leads DESC
      `),

      // Bookings by traffic source (only v3 events)
      hogqlQuery(apiKey, `
        SELECT
          properties.traffic_source as source,
          countIf(event = 'appointment_booked') as booked,
          countIf(event = 'appointment_attended') as attended,
          countIf(event = 'appointment_no_show') as no_show
        FROM events
        WHERE event IN ('appointment_booked', 'appointment_attended', 'appointment_no_show')
          AND toString(properties.$insert_id) LIKE '%_v4'
          ${dateFilter}
        GROUP BY properties.traffic_source
      `),

      // By funnel type — visits (started), leads (completed/submitted), bookings
      hogqlQuery(apiKey, `
        SELECT
          properties.funnel_type as funnel,
          countIf(event IN ('quiz_started', 'short_quiz_started', 'direct_form_submitted')) as visits,
          countIf(event IN ('form_submitted', 'direct_form_submitted')) as leads,
          countIf(event IN ('appointment_booked') AND toString(properties.$insert_id) LIKE '%_v4') as booked
        FROM events
        WHERE event IN ('quiz_started', 'short_quiz_started', 'form_submitted', 'direct_form_submitted', 'appointment_booked')
          ${dateFilter}
        GROUP BY properties.funnel_type
        ORDER BY visits DESC
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
        WHERE event IN ('form_submitted', 'direct_form_submitted')
          ${dateFilter}
        GROUP BY day
        ORDER BY day ASC
      `),

      // Daily leads by source
      hogqlQuery(apiKey, `
        SELECT toDate(timestamp) as day, properties.traffic_source as source, count() as cnt
        FROM events
        WHERE event IN ('form_submitted', 'direct_form_submitted')
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

      // Quiz drop-off by question — group by question_id, take max index per question
      hogqlQuery(apiKey, `
        SELECT
          toString(properties.question_id) as q_id,
          count(DISTINCT person_id) as users
        FROM events
        WHERE event = 'question_answered'
          ${dateFilter}
        GROUP BY q_id
        ORDER BY users DESC
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
        visits: row[1],
        leads: row[2],
        booked: row[3],
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
      quiz_dropoff: quizDropoff.map(row => ({
        question_id: row[0],
        users: row[1],
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
