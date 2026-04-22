#!/usr/bin/env node
// Smoke-test the new F3 master-funnel query against PostHog live.
// Verifies: HogQL syntax, person.properties coalesce, _v5 filter, columns.

const POSTHOG_HOST = 'https://eu.i.posthog.com';
const PROJECT_ID = '137870';
const LAUNCH_DATE = '2026-04-09';

const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
if (!apiKey) {
  console.error('Missing POSTHOG_PERSONAL_API_KEY');
  process.exit(1);
}

async function hogql(query) {
  const res = await fetch(`${POSTHOG_HOST}/api/projects/${PROJECT_ID}/query/`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${body.substring(0, 600)}`);
  return JSON.parse(body).results || [];
}

const dateFilter = `AND timestamp >= greatest(toDateTime('${LAUNCH_DATE}'), now() - interval 30 day)`;

(async () => {
  // 1. Master funnel query
  console.log('─── 1. Master funnel (5-dim) ───');
  try {
    const rows = await hogql(`
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
        uniqIf(toString(properties.$insert_id),
               event = 'appointment_booked' AND toString(properties.$insert_id) LIKE '%_v5') as booked,
        uniqIf(toString(properties.$insert_id),
               event = 'appointment_attended' AND toString(properties.$insert_id) LIKE '%_v5') as attended,
        uniqIf(toString(properties.$insert_id),
               event = 'appointment_no_show' AND toString(properties.$insert_id) LIKE '%_v5') as no_show
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
      LIMIT 15
    `);
    console.log(`Rows: ${rows.length}`);
    console.table(rows.map(r => ({
      ad: String(r[0]).substring(0, 20),
      landing: r[1],
      nicho: String(r[2]).substring(0, 18),
      sexo: r[3],
      pay: r[4],
      visits: r[5],
      started: r[6],
      completed: r[7],
      leads: r[8],
      booked: r[9],
    })));
  } catch (e) {
    console.error('FAIL master:', e.message);
  }

  // 2. Drop-off with question_index
  console.log('\n─── 2. Quiz drop-off (sequential by index) ───');
  try {
    const rows = await hogql(`
      SELECT
        toString(properties.question_id) as q_id,
        min(properties.question_index) as q_idx,
        count(DISTINCT person_id) as users
      FROM events
      WHERE event = 'question_answered'
        ${dateFilter}
      GROUP BY q_id
      ORDER BY q_idx ASC NULLS LAST
      LIMIT 20
    `);
    console.table(rows.map(r => ({ q_id: r[0], q_idx: r[1], users: r[2] })));
  } catch (e) {
    console.error('FAIL dropoff:', e.message);
  }

  // 3. Ad spend by campaign
  console.log('\n─── 3. Ad spend by campaign ───');
  try {
    const adFilter = `AND properties.date >= '${LAUNCH_DATE}'`;
    const rows = await hogql(`
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
        ${adFilter}
      GROUP BY ad_source, campaign_id, campaign_name
      ORDER BY spend DESC
      LIMIT 20
    `);
    console.table(rows.map(r => ({
      src: r[0], camp_id: r[1], camp_name: String(r[2]).substring(0, 30),
      spend: r[3], clicks: r[4], impressions: r[5],
    })));
  } catch (e) {
    console.error('FAIL adspend:', e.message);
  }
})().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
