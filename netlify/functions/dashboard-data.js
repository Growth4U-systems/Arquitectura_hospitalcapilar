// Netlify Function: Dashboard Data from PostHog
// Fetches real analytics data via PostHog HogQL queries

const POSTHOG_HOST = 'https://eu.i.posthog.com';
const PROJECT_ID = '137870';
const LAUNCH_DATE = '2026-04-09';

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
      funnelVisitsLeads,
      funnelBookings,
      byNicho,
      byEcp,
      dailyLeads,
      dailyLeadsBySource,
      noShowBySource,
      adSpendBySource,
      adSpendDaily,
      quizDropoff,
      byFunnelDimensions,
      adSpendByCampaign,
    ] = await Promise.all([
      // KPIs — all use count() for funnel consistency
      hogqlQuery(apiKey, `SELECT count(DISTINCT person_id) FROM events WHERE event = '$pageview' ${dateFilter}`),
      hogqlQuery(apiKey, `SELECT count() FROM events WHERE event IN ('quiz_started', 'short_quiz_started') ${dateFilter}`),
      hogqlQuery(apiKey, `SELECT count() FROM events WHERE event IN ('quiz_completed', 'short_quiz_completed') ${dateFilter}`),
      hogqlQuery(apiKey, `SELECT count() FROM events WHERE event IN ('form_submitted', 'direct_form_submitted') ${dateFilter}`),
      // Bookings: dedupe by opportunity_id across v4+v5 sync batches. A single opp
      // can have both a legacy _v4 insert_id and a new _v5 one after the sync
      // re-emits with enriched properties — dedupe-by-opp keeps the count stable.
      hogqlQuery(apiKey, `SELECT count(DISTINCT toString(properties.opportunity_id)) FROM events WHERE event = 'appointment_booked' AND (toString(properties.$insert_id) LIKE '%_v4' OR toString(properties.$insert_id) LIKE '%_v5') ${dateFilter}`),
      hogqlQuery(apiKey, `SELECT count(DISTINCT toString(properties.opportunity_id)) FROM events WHERE event = 'appointment_attended' AND (toString(properties.$insert_id) LIKE '%_v4' OR toString(properties.$insert_id) LIKE '%_v5') ${dateFilter}`),
      hogqlQuery(apiKey, `SELECT count(DISTINCT toString(properties.opportunity_id)) FROM events WHERE event = 'appointment_no_show' AND (toString(properties.$insert_id) LIKE '%_v4' OR toString(properties.$insert_id) LIKE '%_v5') ${dateFilter}`),

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

      // Bookings by traffic source — dedupe by opportunity_id across v4+v5
      hogqlQuery(apiKey, `
        SELECT
          properties.traffic_source as source,
          uniqIf(toString(properties.opportunity_id), event = 'appointment_booked') as booked,
          uniqIf(toString(properties.opportunity_id), event = 'appointment_attended') as attended,
          uniqIf(toString(properties.opportunity_id), event = 'appointment_no_show') as no_show
        FROM events
        WHERE event IN ('appointment_booked', 'appointment_attended', 'appointment_no_show')
          AND (toString(properties.$insert_id) LIKE '%_v4' OR toString(properties.$insert_id) LIKE '%_v5')
          ${dateFilter}
        GROUP BY properties.traffic_source
      `),

      // Visits + leads by URL path
      hogqlQuery(apiKey, `
        SELECT
          multiIf(
            properties.$pathname LIKE '%/rapido/%', 'quiz_corto',
            properties.$pathname LIKE '%/form/%', 'formulario_directo',
            'quiz_largo'
          ) as funnel,
          count(DISTINCT if(event = '$pageview', person_id, NULL)) as visits,
          countIf(event IN ('quiz_started', 'short_quiz_started')) as started,
          countIf(event IN ('form_submitted', 'direct_form_submitted')) as leads
        FROM events
        WHERE event IN ('$pageview', 'quiz_started', 'short_quiz_started', 'form_submitted', 'direct_form_submitted')
          ${dateFilter}
        GROUP BY funnel
        ORDER BY visits DESC
      `),

      // Bookings by funnel_type — dedupe by opportunity_id across v4+v5
      hogqlQuery(apiKey, `
        SELECT
          properties.funnel_type as funnel,
          count(DISTINCT toString(properties.opportunity_id)) as booked
        FROM events
        WHERE event = 'appointment_booked'
          AND (toString(properties.$insert_id) LIKE '%_v4' OR toString(properties.$insert_id) LIKE '%_v5')
          ${dateFilter}
        GROUP BY funnel
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

      // Quiz drop-off by question — group by question_id, expose question_index for
      // correct sequential ordering in the UI (fix: antes ordenábamos por users DESC).
      hogqlQuery(apiKey, `
        SELECT
          toString(properties.question_id) as q_id,
          min(properties.question_index) as q_idx,
          count(DISTINCT person_id) as users
        FROM events
        WHERE event = 'question_answered'
          ${dateFilter}
        GROUP BY q_id
        ORDER BY q_idx ASC NULLS LAST
      `),

      // F3 — master funnel table: 1 row per (utm_content, landing, nicho, sexo, payment_variant).
      // Coalesce chain: event-level property → PostHog $utm_* autocapture → person-level
      // $initial_utm_* (set once per person on first pageview) → person custom property.
      // This ensures events fired AFTER the user navigated off the landing URL still
      // attribute to the original ad.
      hogqlQuery(apiKey, `
        SELECT
          coalesce(
            nullIf(toString(properties.utm_content), ''),
            nullIf(toString(properties.$utm_content), ''),
            nullIf(toString(person.properties.$initial_utm_content), ''),
            nullIf(toString(person.properties.utm_content), ''),
            'sin-atribucion'
          ) as ad,
          multiIf(
            toString(properties.$pathname) LIKE '%/rapido/%', 'quiz_corto',
            toString(properties.$pathname) LIKE '%/form/%', 'formulario_directo',
            coalesce(
              nullIf(toString(properties.funnel_type), ''),
              nullIf(toString(person.properties.funnel_type), ''),
              'quiz_largo'
            )
          ) as landing,
          coalesce(
            nullIf(toString(properties.nicho), ''),
            nullIf(toString(person.properties.nicho), ''),
            'sin-nicho'
          ) as nicho,
          coalesce(
            nullIf(toString(properties.sexo), ''),
            nullIf(toString(person.properties.sexo), ''),
            'sin-dato'
          ) as sexo,
          coalesce(
            nullIf(toString(properties.payment_variant), ''),
            nullIf(toString(person.properties.payment_variant), ''),
            'sin-dato'
          ) as payment_variant,
          count(DISTINCT if(event = '$pageview', person_id, NULL)) as visits,
          countIf(event IN ('quiz_started', 'short_quiz_started')) as started,
          countIf(event IN ('quiz_completed', 'short_quiz_completed')) as completed,
          countIf(event IN ('form_submitted', 'direct_form_submitted', 'lead_form_submitted')) as leads,
          uniqIf(toString(properties.opportunity_id),
                 event = 'appointment_booked' AND (toString(properties.$insert_id) LIKE '%_v4' OR toString(properties.$insert_id) LIKE '%_v5')) as booked,
          uniqIf(toString(properties.opportunity_id),
                 event = 'appointment_attended' AND (toString(properties.$insert_id) LIKE '%_v4' OR toString(properties.$insert_id) LIKE '%_v5')) as attended,
          uniqIf(toString(properties.opportunity_id),
                 event = 'appointment_no_show' AND (toString(properties.$insert_id) LIKE '%_v4' OR toString(properties.$insert_id) LIKE '%_v5')) as no_show
        FROM events
        WHERE event IN (
          '$pageview',
          'quiz_started', 'short_quiz_started',
          'quiz_completed', 'short_quiz_completed',
          'form_submitted', 'direct_form_submitted', 'lead_form_submitted',
          'appointment_booked', 'appointment_attended', 'appointment_no_show'
        )
          ${dateFilter}
        GROUP BY ad, landing, nicho, sexo, payment_variant
        HAVING visits > 0 OR started > 0 OR leads > 0 OR booked > 0
        ORDER BY visits DESC, leads DESC
      `),

      // F3 — ad spend grouped by utm_content when available (for per-ad CPL/CPA).
      // Until Meta tracking template is applied, utm_content on ad_spend_daily is
      // campaign-level only; rows are still useful aggregated up.
      hogqlQuery(apiKey, `
        SELECT
          toString(properties.source) as ad_source,
          coalesce(nullIf(toString(properties.campaign_id), ''), 'unknown') as campaign_id,
          coalesce(nullIf(toString(properties.campaign_name), ''), '') as campaign_name,
          sum(toFloatOrZero(toString(properties.spend))) as spend,
          sum(toIntOrZero(toString(properties.clicks))) as clicks,
          sum(toIntOrZero(toString(properties.impressions))) as impressions
        FROM events
        WHERE event = 'ad_spend_daily'
          AND properties.source IN ('google_ads', 'meta_ads')
          ${adDateFilter}
        GROUP BY ad_source, campaign_id, campaign_name
        ORDER BY spend DESC
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
      by_funnel_type: (() => {
        // Merge visits/leads (by URL path) with bookings (by GHL funnel_type)
        const fMap = {};
        for (const row of funnelVisitsLeads) {
          const f = row[0];
          if (!fMap[f]) fMap[f] = { visits: 0, started: 0, leads: 0, booked: 0 };
          fMap[f].visits = row[1];
          fMap[f].started = row[2];
          fMap[f].leads = row[3];
        }
        for (const row of funnelBookings) {
          const f = row[0];
          if (!fMap[f]) fMap[f] = { visits: 0, started: 0, leads: 0, booked: 0 };
          fMap[f].booked = row[1];
        }
        return Object.entries(fMap)
          .filter(([f]) => f && f !== 'null' && f !== 'None')
          .map(([funnel, d]) => ({ funnel, visits: d.visits, started: d.started, leads: d.leads, booked: d.booked }))
          .sort((a, b) => b.visits - a.visits);
      })(),
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
        question_index: row[1],
        users: row[2],
      })),
      by_funnel_dimensions: byFunnelDimensions.map(row => ({
        utm_content: row[0],
        landing: row[1],
        nicho: row[2],
        sexo: row[3],
        payment_variant: row[4],
        visits: row[5],
        started: row[6],
        completed: row[7],
        leads: row[8],
        booked: row[9],
        attended: row[10],
        no_show: row[11],
      })),
      ad_spend_by_campaign: adSpendByCampaign.map(row => ({
        source: row[0],
        campaign_id: row[1],
        campaign_name: row[2],
        spend: row[3],
        clicks: row[4],
        impressions: row[5],
      })),
      executive_header: (() => {
        // Global funnel stages
        const p = val(kpiPageviews);
        const s = val(kpiStarted);
        const c = val(kpiCompleted);
        const l = val(kpiLeads);
        const b = val(kpiBooked);
        const a = val(kpiAttended);
        const stages = [
          { from: 'Visitante',      to: 'Iniciado',   prev: p, curr: s },
          { from: 'Iniciado',       to: 'Finalizado', prev: s, curr: c },
          { from: 'Finalizado',     to: 'Lead',       prev: c, curr: l },
          { from: 'Lead',           to: 'Cita',       prev: l, curr: b },
          { from: 'Cita',           to: 'Asiste',     prev: b, curr: a },
        ];
        const withDrop = stages
          .filter(st => st.prev > 0)
          .map(st => ({ ...st, drop_pct: 100 * (1 - st.curr / st.prev), retention_pct: 100 * st.curr / st.prev }));
        const bottleneck = withDrop.length
          ? withDrop.reduce((worst, cur) => (cur.drop_pct > worst.drop_pct ? cur : worst), withDrop[0])
          : null;

        // Top/Bottom funnels — compute ratio booked/visits per funnel line;
        // minimum traffic gate so we don't rank noise.
        const lines = (byFunnelDimensions || [])
          .map(row => ({
            utm_content: row[0],
            landing: row[1],
            nicho: row[2],
            sexo: row[3],
            payment_variant: row[4],
            visits: row[5],
            started: row[6],
            completed: row[7],
            leads: row[8],
            booked: row[9],
          }))
          .filter(r => r.visits >= 30 || r.leads >= 3);
        const scored = lines
          .map(r => ({ ...r, conv_pct: r.visits > 0 ? 100 * r.booked / r.visits : 0 }))
          .filter(r => r.conv_pct > 0);
        scored.sort((x, y) => y.conv_pct - x.conv_pct);
        const top = scored.slice(0, 3);
        const bottom = scored.slice(-3).reverse();

        // Budget: Alfonso 2026-04-21 set 500€/semana × 2 semanas = 2.000€ total
        // for the 3-niche pilot. Overridable per-request via ?budget= later if needed.
        const totalSpend = (adSpendBySource || []).reduce((sum, row) => sum + (Number(row[1]) || 0), 0);
        const budgetAssigned = 2000;

        return {
          bottleneck: bottleneck
            ? {
                from: bottleneck.from,
                to: bottleneck.to,
                drop_pct: Number(bottleneck.drop_pct.toFixed(1)),
                retention_pct: Number(bottleneck.retention_pct.toFixed(1)),
                abs_lost: bottleneck.prev - bottleneck.curr,
              }
            : null,
          top_funnels: top,
          bottom_funnels: bottom,
          budget: {
            assigned: budgetAssigned,
            spent: Number(totalSpend.toFixed(2)),
            remaining: Number((budgetAssigned - totalSpend).toFixed(2)),
            pct_used: budgetAssigned > 0 ? Number((100 * totalSpend / budgetAssigned).toFixed(1)) : 0,
          },
          global_cpl: l > 0 && totalSpend > 0 ? Number((totalSpend / l).toFixed(2)) : null,
          global_cpa: b > 0 && totalSpend > 0 ? Number((totalSpend / b).toFixed(2)) : null,
        };
      })(),
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
