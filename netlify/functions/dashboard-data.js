// Netlify Function: Dashboard Data from PostHog
// Fetches real analytics data via PostHog HogQL queries + direct GHL
// lookups for fields that are authoritative in the CRM (sexo, pipeline
// stage) and not reliably propagated through the PostHog sync.

const POSTHOG_HOST = 'https://eu.i.posthog.com';
const PROJECT_ID = '137870';
const LAUNCH_DATE = '2026-04-09';

// GHL constants (mirrors sync-ghl-posthog.js)
const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_PIPELINE_ID = 'xXCgpUIEizlqdrmGrJkg';
const GHL_BOOKED_STAGES = new Set([
  'f9e5c1cf-7701-4883-ac96-f16b3d78c0d5', // booked
  '24956338-65d9-4a16-97e5-ba01b64f390f', // reminder_sent
  '71a5cc36-584e-47dc-9cce-215803e3140d', // attended
  '1cd97c60-fb19-4699-9293-2b32fd48b54a', // won
  '437d0663-bd17-4d84-a939-11aed1b4b384', // no_show
]);

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

// Small Spanish first-name → gender lookup used as a fallback when
// contact.gender isn't set in GHL (happens for leads that came via
// forms without a sexo question, e.g. formulario directo).
// Only covers the top ~80 most common Spanish names; anything else
// falls through to 'sin-dato'.
const MALE_NAMES = new Set([
  'diego','izan','andres','juan','jose','carlos','miguel','antonio','pedro',
  'pablo','manuel','luis','fernando','javier','francisco','daniel','alejandro',
  'rafael','alberto','ricardo','raul','enrique','jorge','ignacio','ivan',
  'alvaro','ismael','adrian','ruben','gabriel','david','victor','marcos',
  'mario','hector','samuel','joaquin','sergio','eduardo','roberto','santiago',
  'gonzalo','ramon','alex','hugo','oscar','lucas','martin','emilio','nicolas',
  'cristian','felipe','marc','albert','xavier','dario','julian','cesar',
]);
const FEMALE_NAMES = new Set([
  'maria','ana','carmen','laura','isabel','sara','rosa','catalina','pilar',
  'lucia','elena','cristina','marta','paula','sofia','andrea','alba','marina',
  'eva','ines','patricia','beatriz','rocio','silvia','sandra','raquel','monica',
  'teresa','julia','claudia','natalia','lorena','gloria','susana','angela',
  'yolanda','alicia','elisa','dolores','adriana','concepcion','esther',
  'mercedes','manuela','josefa','antonia','encarnacion','amparo','nieves',
  'montserrat','montse','noelia','nuria','virginia','olga','irene','celia',
  'veronica','carla','diana','rebeca','nerea','aitana','martina','valentina',
  'vanesa','vanessa','miriam','ester','nadia','leire','ainhoa',
]);

function stripAccents(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Try each token in the full name in order — handles "IBM Andrés noreña"
// (first token is not a name) or "María del Carmen" (second/third tokens).
function inferSexoFromName(fullName) {
  if (!fullName) return null;
  const tokens = fullName.trim().toLowerCase().split(/\s+/).map(stripAccents);
  for (const t of tokens) {
    if (MALE_NAMES.has(t)) return 'hombre';
    if (FEMALE_NAMES.has(t)) return 'mujer';
  }
  return null;
}

// ─── Direct GHL → by_sexo aggregation ─────────────────────────────
// GHL is the source of truth for gender (native contact.gender field).
// When gender is missing (contacts from form-direct flows that don't ask
// sexo), fall back to a first-name heuristic against a Spanish name list.
// Pulling directly avoids PostHog's person-property propagation lag.
async function fetchGhlBySexo(startDate, endDate) {
  const GHL_KEY = process.env.VITE_GHL_API_KEY;
  const GHL_LOCATION = process.env.VITE_GHL_LOCATION_ID || 'U4SBRYIlQtGBDHLFwEUf';
  if (!GHL_KEY) return null;

  const headers = { Authorization: `Bearer ${GHL_KEY}`, Version: '2021-07-28' };

  // Fetch all opportunities in the pipeline (typically <100 for HC)
  let allOpps = [];
  let startAfterId = '';
  let hasMore = true;
  let guard = 0;
  while (hasMore && guard++ < 20) {
    const url = `${GHL_BASE}/opportunities/search?location_id=${GHL_LOCATION}&pipeline_id=${GHL_PIPELINE_ID}&limit=100${startAfterId ? `&startAfterId=${startAfterId}` : ''}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`GHL search ${res.status}`);
    const data = await res.json();
    const opps = data.opportunities || [];
    allOpps = allOpps.concat(opps);
    hasMore = opps.length >= 100;
    if (hasMore) startAfterId = opps[opps.length - 1].id;
  }

  // Filter to the requested date range by opportunity createdAt.
  const startTs = new Date(startDate + 'T00:00:00Z').getTime();
  const endTs = new Date(endDate + 'T23:59:59Z').getTime();
  const inRange = allOpps.filter(opp => {
    const t = new Date(opp.createdAt || opp.updatedAt || 0).getTime();
    return t >= startTs && t <= endTs;
  });

  // Fetch each unique contact's gender (concurrency 5)
  const contactIds = [...new Set(inRange.map(o => o.contactId).filter(Boolean))];
  const contactById = {};
  const concurrency = 5;
  let idx = 0;
  async function worker() {
    while (idx < contactIds.length) {
      const i = idx++;
      const cid = contactIds[i];
      try {
        const r = await fetch(`${GHL_BASE}/contacts/${cid}`, { headers });
        if (r.ok) {
          const d = await r.json();
          contactById[cid] = d.contact || {};
        }
      } catch (_) { /* skip */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, contactIds.length) }, worker));

  // Aggregate by normalized sexo. Priority: GHL native gender → name heuristic
  // → sin-dato. Native gender is missing for contacts from flows that don't
  // ask sexo (formulario directo, some asesores paths).
  //
  // Pago: contact tag `bono_pagado` flipped on by stripe-webhook.js on a
  // successful Stripe checkout. `bono_pendiente` means booked but unpaid.
  const buckets = {};
  const ensure = (k) => { if (!buckets[k]) buckets[k] = { sexo: k, leads: 0, booked: 0, paid: 0 }; return buckets[k]; };
  for (const opp of inRange) {
    const contact = contactById[opp.contactId] || {};
    const g = (contact.gender || '').toLowerCase();
    let sexo = g === 'female' ? 'mujer' : g === 'male' ? 'hombre' : null;
    if (!sexo) {
      const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.name || '';
      sexo = inferSexoFromName(fullName);
    }
    sexo = sexo || 'sin-dato';
    const tags = Array.isArray(contact.tags) ? contact.tags : [];
    const hasPaid = tags.includes('bono_pagado');
    const isBooked = GHL_BOOKED_STAGES.has(opp.pipelineStageId);
    const b = ensure(sexo);
    b.leads++;
    if (isBooked) b.booked++;
    if (isBooked && hasPaid) b.paid++;
  }
  return Object.values(buckets).sort((a, b) => b.leads - a.leads);
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
      bySexo,
      byFunnelDimensions,
      adSpendByCampaign,
    ] = await Promise.all([
      // KPIs — all use count() for funnel consistency
      hogqlQuery(apiKey, `SELECT count(DISTINCT person_id) FROM events WHERE event = '$pageview' ${dateFilter}`),
      hogqlQuery(apiKey, `SELECT count() FROM events WHERE (event = 'short_quiz_started' OR (event = 'quiz_started' AND properties.$pathname NOT LIKE '%/rapido/%')) ${dateFilter}`),
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
      // NOTE: short flow emits both 'quiz_started' and 'short_quiz_started' on the
      // same CTA click, so we count short_quiz_started on /rapido/* and quiz_started
      // elsewhere to avoid double counting.
      // Non-landing paths (/agendar, /mi-cita, /test-*, /preview/*) are bucketed as
      // 'other' and filtered out so quiz_largo visits reflect only landing traffic.
      hogqlQuery(apiKey, `
        SELECT
          multiIf(
            properties.$pathname LIKE '%/rapido/%', 'quiz_corto',
            properties.$pathname LIKE '%/form/%', 'formulario_directo',
            properties.$pathname LIKE '/agendar%'
              OR properties.$pathname LIKE '/mi-cita%'
              OR properties.$pathname LIKE '/test-%'
              OR properties.$pathname LIKE '/preview/%'
              OR properties.$pathname LIKE '/admin%'
              OR properties.$pathname LIKE '/api/%', 'other',
            'quiz_largo'
          ) as funnel,
          count(DISTINCT if(event = '$pageview', person_id, NULL)) as visits,
          countIf(
            event = 'short_quiz_started'
            OR (event = 'quiz_started' AND properties.$pathname NOT LIKE '%/rapido/%')
          ) as started,
          countIf(event IN ('form_submitted', 'direct_form_submitted')) as leads
        FROM events
        WHERE event IN ('$pageview', 'quiz_started', 'short_quiz_started', 'form_submitted', 'direct_form_submitted')
          ${dateFilter}
        GROUP BY funnel
        HAVING funnel != 'other'
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

      // Quiz drop-off — use screen_viewed (fires on every screen render:
      // questions, info/social-proof intermissions, contact form, results),
      // not question_answered (which misses people who viewed a screen but
      // never clicked an option). Expose screen_type so the UI can label
      // info screens distinctly from questions.
      hogqlQuery(apiKey, `
        SELECT
          toString(properties.screen_id) as s_id,
          min(properties.screen_index) as s_idx,
          argMin(toString(properties.screen_type), properties.screen_index) as s_type,
          count(DISTINCT person_id) as users
        FROM events
        WHERE event = 'screen_viewed'
          AND properties.screen_id IS NOT NULL
          ${dateFilter}
        GROUP BY s_id
        ORDER BY s_idx ASC NULLS LAST
      `),

      // By sexo — resolve sexo at the PERSON level only (not the event level).
      // A single opportunity can have multiple appointment_booked events across
      // sync re-runs; some may have properties.sexo=null while others have it
      // populated. Grouping by the event-level field would split the same opp
      // across buckets. Person.properties.sexo is consistent across ALL events
      // of the same person (set once by GHL sync $set / $identify), so it gives
      // a stable per-opportunity bucket.
      hogqlQuery(apiKey, `
        SELECT
          coalesce(nullIf(lower(toString(person.properties.sexo)), ''), 'sin-dato') as sexo,
          count(DISTINCT if(event = '$pageview', person_id, NULL)) as visits,
          countIf(
            event = 'short_quiz_started'
            OR (event = 'quiz_started' AND properties.$pathname NOT LIKE '%/rapido/%')
          ) as started,
          countIf(event IN ('form_submitted', 'direct_form_submitted', 'lead_form_submitted')) as leads,
          uniqIf(toString(properties.opportunity_id),
                 event = 'appointment_booked'
                 AND (toString(properties.$insert_id) LIKE '%_v4' OR toString(properties.$insert_id) LIKE '%_v5')) as booked
        FROM events
        WHERE event IN (
          '$pageview',
          'quiz_started', 'short_quiz_started',
          'form_submitted', 'direct_form_submitted', 'lead_form_submitted',
          'appointment_booked'
        )
          ${dateFilter}
        GROUP BY sexo
        HAVING visits > 0 OR started > 0 OR leads > 0 OR booked > 0
        ORDER BY leads DESC
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
          countIf(
            event = 'short_quiz_started'
            OR (event = 'quiz_started' AND properties.$pathname NOT LIKE '%/rapido/%')
          ) as started,
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
        screen_type: row[2], // 'question' | 'social_proof' | 'contact_form' | 'results'
        users: row[3],
      })),
      by_sexo: bySexo.map(row => ({
        sexo: row[0],
        visits: row[1],
        started: row[2],
        leads: row[3],
        booked: row[4],
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

    // Override by_sexo with GHL-direct aggregation when available. GHL is the
    // source of truth for contact.gender; PostHog's person.properties.sexo
    // lags behind by an hour (sync cadence) and new leads won't appear
    // until the next cron tick. The PostHog fallback stays in place for when
    // GHL is unreachable or credentials are missing.
    try {
      const ghlBySexo = await fetchGhlBySexo(effectiveStart, effectiveEnd);
      if (ghlBySexo && ghlBySexo.length > 0) {
        result.by_sexo = ghlBySexo;
      }
    } catch (e) {
      console.log('[Dashboard] GHL by_sexo fallback to PostHog:', e.message);
    }

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
