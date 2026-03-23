import { Resend } from 'resend';
import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

/**
 * Validate email: format check + MX record verification
 */
async function validateEmail(email) {
  // 1. Format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, reason: 'invalid_format' };
  }

  // 2. Extract domain and check MX records
  const domain = email.split('@')[1];
  try {
    const records = await resolveMx(domain);
    if (!records || records.length === 0) {
      return { valid: false, reason: 'no_mx_records' };
    }
    return { valid: true, domain, mxRecords: records.length };
  } catch (err) {
    return { valid: false, reason: 'dns_lookup_failed', error: err.code };
  }
}

/**
 * Build the welcome email HTML following HC brand style
 */
function buildWelcomeHTML({ nombre, ecp }) {
  const ecpSection = ecp
    ? `<tr>
        <td style="padding: 16px 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F0F7F6; border-radius: 12px;">
            <tr>
              <td style="padding: 16px 24px; text-align: center; font-family: Arial, sans-serif; font-size: 14px; color: #2C3E50;">
                <strong style="color: #4CA994;">Tu perfil capilar (ECP):</strong><br/>
                <span style="font-size: 16px; margin-top: 4px; display: inline-block;">${ecp}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido a Hospital Capilar</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; max-width: 600px;">

          <!-- Logo -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <img src="https://hospitalcapilar.com/wp-content/uploads/2023/07/logo-hospital-capilar.png" alt="Hospital Capilar" width="200" style="max-width: 200px; height: auto;" />
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 0 40px; text-align: center;">
              <h1 style="font-family: Arial, sans-serif; font-size: 22px; font-weight: 800; color: #2C3E50; margin: 0 0 20px;">
                Hola ${nombre},
              </h1>
            </td>
          </tr>

          <!-- Body text -->
          <tr>
            <td style="padding: 0 40px; text-align: center; font-family: Arial, sans-serif; font-size: 15px; line-height: 24px; color: #555555;">
              <p style="margin: 0 0 16px;">
                ¡Gracias por contactar con Hospital Capilar!<br/>
                Hemos recibido correctamente tu solicitud de información
                y nos alegra que hayas dado el primer paso para informarte.
              </p>
              <p style="margin: 0 0 16px;">
                Muy pronto, uno de nuestros especialistas capilares se pondrá
                en contacto contigo para resolver todas tus dudas y proceder
                con tu <strong>diagnóstico médico gratuito</strong>.
              </p>
              <p style="margin: 0;">
                Si lo prefieres, puedes contactar directamente llamando o
                escribirnos por WhatsApp.
              </p>
            </td>
          </tr>

          <!-- ECP Tag -->
          ${ecpSection}

          <!-- CTA Buttons -->
          <tr>
            <td style="padding: 30px 40px 0; text-align: center;">
              <table cellpadding="0" cellspacing="0" align="center">
                <tr>
                  <td style="padding-bottom: 12px;" align="center">
                    <a href="https://wa.me/34623278011" target="_blank" style="display: inline-block; background-color: #4CA994; color: #ffffff; font-family: Arial, sans-serif; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 8px; min-width: 180px; text-align: center;">
                      Enviar WhatsApp
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <a href="tel:+34623278011" style="display: inline-block; background-color: #4CA994; color: #ffffff; font-family: Arial, sans-serif; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 8px; min-width: 180px; text-align: center;">
                      Llamar Ahora
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px 40px; text-align: center; font-family: Arial, sans-serif; font-size: 15px; color: #2C3E50;">
              ¡Gracias por confiar en Hospital Capilar!
            </td>
          </tr>

          <!-- Social links -->
          <tr>
            <td style="padding: 0 40px 30px; text-align: center;">
              <a href="https://www.facebook.com/HospitalCapilar" style="text-decoration: none; margin: 0 6px;"><img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" width="24" height="24" alt="Facebook" style="border-radius: 4px;" /></a>
              <a href="https://www.instagram.com/hospitalcapilar/" style="text-decoration: none; margin: 0 6px;"><img src="https://cdn-icons-png.flaticon.com/512/733/733558.png" width="24" height="24" alt="Instagram" style="border-radius: 4px;" /></a>
              <a href="https://www.youtube.com/@HospitalCapilar" style="text-decoration: none; margin: 0 6px;"><img src="https://cdn-icons-png.flaticon.com/512/733/733579.png" width="24" height="24" alt="YouTube" style="border-radius: 4px;" /></a>
              <a href="https://www.linkedin.com/company/hospitalcapilar/" style="text-decoration: none; margin: 0 6px;"><img src="https://cdn-icons-png.flaticon.com/512/733/733561.png" width="24" height="24" alt="LinkedIn" style="border-radius: 4px;" /></a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[Email] RESEND_API_KEY not configured');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Email service not configured' }) };
  }

  try {
    const { email, nombre, ecp } = JSON.parse(event.body);

    if (!email) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email is required' }) };
    }

    // Validate email before sending
    const validation = await validateEmail(email);
    if (!validation.valid) {
      console.log(`[Email] Validation failed for ${email}: ${validation.reason}`);
      return {
        statusCode: 422,
        headers,
        body: JSON.stringify({
          error: 'Invalid email',
          reason: validation.reason,
          detail: validation.error || null,
        }),
      };
    }

    console.log(`[Email] Validated ${email} — domain: ${validation.domain}, MX records: ${validation.mxRecords}`);

    // Send welcome email via Resend
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: 'Hospital Capilar <noreply@hospitalcapilar.com>',
      to: [email],
      subject: '¡Gracias por contactar con Hospital Capilar!',
      html: buildWelcomeHTML({ nombre: nombre || '', ecp: ecp || '' }),
    });

    if (error) {
      console.log('[Email] Resend error:', JSON.stringify(error));
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to send email', detail: error }) };
    }

    console.log('[Email] Welcome email sent to:', email, 'id:', data?.id);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, emailId: data?.id, validation }),
    };
  } catch (err) {
    console.log('[Email] Exception:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
