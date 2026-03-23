/**
 * Alert utility — sends failure alerts via email (Resend) and PostHog event.
 * Used by health-check and critical error paths.
 */

const POSTHOG_HOST = 'https://eu.i.posthog.com';

/**
 * Send an alert when something critical fails.
 * @param {string} source - e.g. 'health-check', 'stripe-webhook', 'ghl-proxy'
 * @param {string} message - Human-readable description
 * @param {object} details - Extra context (error messages, status codes, etc.)
 */
async function sendAlert(source, message, details = {}) {
  const timestamp = new Date().toISOString();
  console.error(`[ALERT][${source}] ${message}`, JSON.stringify(details));

  // 1. Track in PostHog as a system_alert event
  const posthogKey = process.env.VITE_POSTHOG_KEY;
  if (posthogKey) {
    try {
      await fetch(`${POSTHOG_HOST}/capture/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: posthogKey,
          event: 'system_alert',
          properties: {
            distinct_id: 'system-monitor',
            $lib: 'server-netlify',
            alert_source: source,
            alert_message: message,
            alert_details: JSON.stringify(details),
            severity: details.severity || 'critical',
            timestamp,
          },
        }),
      });
    } catch (_) {
      // PostHog itself might be down
    }
  }

  // 2. Send email alert via Resend
  const resendKey = process.env.RESEND_API_KEY;
  const alertEmail = process.env.ALERT_EMAIL || 'philipe@growth4u.io';
  if (resendKey) {
    try {
      const { Resend } = require('resend');
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: 'Hospital Capilar Alerts <noreply@hospitalcapilar.com>',
        to: [alertEmail],
        subject: `⚠️ [${source}] ${message}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #E74C3C;">⚠️ System Alert</h2>
            <p><strong>Source:</strong> ${source}</p>
            <p><strong>Message:</strong> ${message}</p>
            <p><strong>Time:</strong> ${timestamp}</p>
            <pre style="background: #f4f4f4; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 13px;">${JSON.stringify(details, null, 2)}</pre>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
            <p style="color: #999; font-size: 12px;">diagnostico.hospitalcapilar.com — automated alert</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error('[Alert] Email send failed:', emailErr.message);
    }
  }
}

module.exports = { sendAlert };
