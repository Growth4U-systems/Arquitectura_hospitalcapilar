// Debug endpoint: lista los pixels asociados al Meta ad account.
// Sirve para obtener el Pixel ID que hay que hardcodear en lib/meta-capi.js
// (no podemos añadir nueva env var en este Netlify — saturado).
//
// Uso: GET /.netlify/functions/debug-meta-pixels?key=hc-dashboard-2026

const GRAPH_VERSION = 'v21.0';

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  const params = event.queryStringParameters || {};
  const secret = process.env.DASHBOARD_SECRET || 'hc-dashboard-2026';
  if (params.key !== secret) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing META_ACCESS_TOKEN or META_AD_ACCOUNT_ID' }) };
  }

  const out = { ad_account: adAccountId, pixels: [], token_debug: null, errors: [] };

  // 1. List pixels on the ad account
  try {
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${adAccountId}/adspixels?fields=id,name,last_fired_time,is_unavailable,code&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) {
      out.errors.push({ source: 'adspixels', status: res.status, error: data.error });
    } else {
      out.pixels = (data.data || []).map(p => ({
        id: p.id,
        name: p.name,
        last_fired_time: p.last_fired_time,
        is_unavailable: p.is_unavailable,
        has_code: !!p.code,
      }));
    }
  } catch (err) {
    out.errors.push({ source: 'adspixels', exception: err.message });
  }

  // 2. Inspect token permissions / scopes
  try {
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok && data.data) {
      out.token_debug = {
        app_id: data.data.app_id,
        type: data.data.type,
        is_valid: data.data.is_valid,
        scopes: data.data.scopes,
        expires_at: data.data.expires_at,
        granular_scopes: data.data.granular_scopes,
      };
    } else {
      out.errors.push({ source: 'debug_token', status: res.status, error: data.error });
    }
  } catch (err) {
    out.errors.push({ source: 'debug_token', exception: err.message });
  }

  return { statusCode: 200, headers, body: JSON.stringify(out, null, 2) };
};
