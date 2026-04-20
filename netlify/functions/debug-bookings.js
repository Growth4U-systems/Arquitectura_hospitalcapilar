// Debug endpoint: lista los eventos appointment_booked con detalle para identificar tests huérfanos
const POSTHOG_HOST = 'https://eu.i.posthog.com';
const PROJECT_ID = '137870';

async function hogqlQuery(apiKey, query) {
  const res = await fetch(`${POSTHOG_HOST}/api/projects/${PROJECT_ID}/query/`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });
  if (!res.ok) throw new Error(`PostHog ${res.status}: ${await res.text()}`);
  return (await res.json()).results || [];
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  const params = event.queryStringParameters || {};
  const secret = process.env.DASHBOARD_SECRET || 'hc-dashboard-2026';
  if (params.key !== secret) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing POSTHOG_PERSONAL_API_KEY' }) };

  try {
    const rows = await hogqlQuery(apiKey, `
      SELECT
        toString(properties.opportunity_id) as opp_id,
        toString(properties.contact_email) as email,
        toString(properties.contact_name) as name,
        toString(properties.$insert_id) as insert_id,
        toString(properties.$lib) as lib,
        toString(timestamp) as ts,
        toString(properties.traffic_source) as source
      FROM events
      WHERE event = 'appointment_booked'
        AND toString(properties.$insert_id) LIKE '%_v4'
        AND timestamp >= toDateTime('2026-04-09')
      ORDER BY timestamp DESC
    `);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        total: rows.length,
        events: rows.map(r => ({ opp_id: r[0], email: r[1], name: r[2], insert_id: r[3], lib: r[4], ts: r[5], source: r[6] })),
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
