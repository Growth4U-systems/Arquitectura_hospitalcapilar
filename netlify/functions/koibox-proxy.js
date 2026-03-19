const { updateLeadByEmail, getLeadSourceByEmail } = require('./lib/firebase-admin');

const KOIBOX_BASE = 'https://api.koibox.cloud/api';
const GHL_BASE = 'https://services.leadconnectorhq.com';
const POSTHOG_HOST = 'https://eu.i.posthog.com';

// Koibox service IDs
const SERVICES = {
  primera_consulta_diagnostico: 103385,  // Primera Consulta Médica Diagnóstico (€0)
  lead_fresquito:               103413,  // LEAD FRESQUITO (€0)
};

// Province IDs (Koibox uses numeric IDs)
const PROVINCIAS = {
  madrid:     680,
  murcia:     697,
  pontevedra: 718,
};

// Default employee IDs per clinic
// 30257 = hueco de agenda abierto para campaña quiz online (confirmado por María / Óscar, 2026-03-18)
const EMPLOYEES = {
  madrid: 30257,
  pontevedra: 30257,
  murcia: 30257,
};

// Working hours per clinic (24h format)
const WORKING_HOURS = {
  madrid:     { open: '09:00', close: '20:00' },
  pontevedra: { open: '09:00', close: '20:00' },
  murcia:     { open: '09:00', close: '20:00' },
};

const SLOT_DURATION = 30; // minutes

exports.handler = async (event) => {
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

  const apiKey = process.env.KOIBOX_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Koibox API key not configured' }) };
  }

  const koiboxHeaders = {
    'X-Koibox-Key': apiKey,
    'Content-Type': 'application/json',
  };

  try {
    const body = JSON.parse(event.body);
    const { action } = body;

    // Route by action
    if (action === 'sync_lead') {
      return await syncLead(body, koiboxHeaders, headers);
    }

    if (action === 'search_client') {
      return await searchClient(body, koiboxHeaders, headers);
    }

    if (action === 'get_availability') {
      return await getAvailability(body, koiboxHeaders, headers);
    }

    if (action === 'create_appointment') {
      return await createAppointment(body, koiboxHeaders, headers);
    }

    if (action === 'cancel_appointment') {
      return await cancelAppointment(body, koiboxHeaders, headers);
    }

    if (action === 'reschedule_appointment') {
      return await rescheduleAppointment(body, koiboxHeaders, headers);
    }

    if (action === 'get_appointment') {
      return await getAppointment(body, koiboxHeaders, headers);
    }

    if (action === 'get_contact_appointment') {
      return await getContactAppointment(body, koiboxHeaders, headers);
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `Unknown action: ${action}. Supported: sync_lead, search_client, get_availability, create_appointment, cancel_appointment, reschedule_appointment, get_appointment, get_contact_appointment` }),
    };
  } catch (err) {
    console.log('[Koibox] Exception:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

/**
 * Sync a lead from the quiz to Koibox as a client.
 * Checks for existing client by phone/email first to avoid duplicates.
 */
async function syncLead(body, koiboxHeaders, corsHeaders) {
  const { nombre, email, movil, ciudad, notas, sexo } = body;

  if (!nombre) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'nombre is required' }) };
  }

  // 1. Check for existing client by phone
  let existingClient = null;
  if (movil) {
    const searchRes = await fetch(`${KOIBOX_BASE}/clientes/?movil=${encodeURIComponent(movil)}`, {
      headers: koiboxHeaders,
    });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.count > 0) {
        existingClient = searchData.results[0];
        console.log('[Koibox] Found existing client by phone:', existingClient.id);
      }
    }
  }

  // 2. Check by email if not found by phone
  if (!existingClient && email) {
    const searchRes = await fetch(`${KOIBOX_BASE}/clientes/?email=${encodeURIComponent(email)}`, {
      headers: koiboxHeaders,
    });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.count > 0) {
        existingClient = searchData.results[0];
        console.log('[Koibox] Found existing client by email:', existingClient.id);
      }
    }
  }

  // 3. Create or update client
  const provinciaId = ciudad ? PROVINCIAS[ciudad.toLowerCase()] || null : null;

  // Split nombre into parts
  const nameParts = nombre.trim().split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

  const clientPayload = {
    nombre: firstName,
    apellido1: lastName,
    email: email || undefined,
    movil: movil || undefined,
    sexo: sexo === 'hombre' ? 'H' : sexo === 'mujer' ? 'M' : undefined,
    notas: notas || undefined,
    origen: 'w',  // w = web
  };
  if (provinciaId) clientPayload.provincia = provinciaId;

  let clientData;
  let clientId;
  let isNew;

  if (existingClient) {
    // Update existing client
    const updateRes = await fetch(`${KOIBOX_BASE}/clientes/${existingClient.id}/`, {
      method: 'PATCH',
      headers: koiboxHeaders,
      body: JSON.stringify({
        notas: notas
          ? `${existingClient.notas || ''}\n---\n[G4U Quiz] ${notas}`.trim()
          : undefined,
      }),
    });
    clientData = updateRes.ok ? await updateRes.json() : existingClient;
    clientId = existingClient.id;
    isNew = false;
    console.log('[Koibox] Updated existing client:', clientId);
  } else {
    // Create new client
    const createRes = await fetch(`${KOIBOX_BASE}/clientes/`, {
      method: 'POST',
      headers: koiboxHeaders,
      body: JSON.stringify(clientPayload),
    });
    clientData = await createRes.json();

    if (!createRes.ok) {
      console.log('[Koibox] Client creation failed:', JSON.stringify(clientData));
      return {
        statusCode: createRes.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Client creation failed', details: clientData }),
      };
    }
    clientId = clientData.id;
    isNew = true;
    console.log('[Koibox] Created new client:', clientId);
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      success: true,
      clientId,
      isNew,
      client: clientData,
    }),
  };
}

/**
 * Get available time slots for a given date and clinic.
 * Queries existing appointments and calculates free slots.
 */
async function getAvailability(body, koiboxHeaders, corsHeaders) {
  const { fecha, clinica } = body;

  if (!fecha || !clinica) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'fecha and clinica required' }) };
  }

  const hours = WORKING_HOURS[clinica] || WORKING_HOURS.madrid;

  // Get all appointments for the given date
  const res = await fetch(
    `${KOIBOX_BASE}/agenda/?fecha__gte=${fecha}&fecha__lte=${fecha}&limit=50`,
    { headers: koiboxHeaders }
  );

  if (!res.ok) {
    console.log('[Koibox] Availability fetch failed:', res.status);
    return { statusCode: res.status, headers: corsHeaders, body: JSON.stringify({ error: 'Failed to fetch appointments' }) };
  }

  const data = await res.json();
  const appointments = data.results || [];

  // Build set of occupied time ranges
  const occupied = appointments.map(a => ({
    start: a.hora_inicio,
    end: a.hora_fin,
  }));

  // Generate all possible slots
  const slots = [];
  let [h, m] = hours.open.split(':').map(Number);
  const [closeH, closeM] = hours.close.split(':').map(Number);
  const closeMin = closeH * 60 + closeM;

  while (h * 60 + m + SLOT_DURATION <= closeMin) {
    const startStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const endM = m + SLOT_DURATION;
    const endH = h + Math.floor(endM / 60);
    const endMm = endM % 60;
    const endStr = `${String(endH).padStart(2, '0')}:${String(endMm).padStart(2, '0')}`;

    // Check if this slot overlaps with any existing appointment
    const isOccupied = occupied.some(occ => {
      return startStr < occ.end && endStr > occ.start;
    });

    slots.push({
      hora_inicio: startStr,
      hora_fin: endStr,
      disponible: !isOccupied,
    });

    // Advance to next slot
    m += SLOT_DURATION;
    if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      fecha,
      clinica,
      horario: hours,
      total_slots: slots.length,
      disponibles: slots.filter(s => s.disponible).length,
      slots,
    }),
  };
}

/**
 * Create an appointment in Koibox.
 */
async function createAppointment(body, koiboxHeaders, corsHeaders) {
  const { nombre, email, movil, fecha, hora_inicio, hora_fin, clinica, notas, ghl_contact_id } = body;

  if (!fecha || !hora_inicio || !hora_fin) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'fecha, hora_inicio, hora_fin required' }) };
  }

  const employeeId = EMPLOYEES[clinica] || EMPLOYEES.madrid;

  // 0. Check GHL for payment status + ECP (to set notes and tags)
  let bonoPaid = false;
  let contactEcp = '';
  if (ghl_contact_id) {
    try {
      const ghlKey = process.env.VITE_GHL_API_KEY;
      const locationId = process.env.VITE_GHL_LOCATION_ID || 'U4SBRYIlQtGBDHLFwEUf';
      if (ghlKey) {
        const ghlHeaders = {
          'Authorization': `Bearer ${ghlKey}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28',
        };
        // Get contact to read ECP
        const contactRes = await fetch(`${GHL_BASE}/contacts/${ghl_contact_id}`, { headers: ghlHeaders });
        if (contactRes.ok) {
          const contactData = await contactRes.json();
          const cfs = contactData?.contact?.customFields || [];
          const ecpField = cfs.find(f => f.id === 'cFIcdJlT9sfnC3KMSwDD');
          contactEcp = ecpField?.value || '';
        }
        // Search opportunity for payment status
        const oppSearchRes = await fetch(
          `${GHL_BASE}/opportunities/search?location_id=${locationId}&contact_id=${ghl_contact_id}&status=open`,
          { headers: ghlHeaders }
        );
        if (oppSearchRes.ok) {
          const oppData = await oppSearchRes.json();
          const opp = (oppData?.opportunities || [])[0];
          if (opp?.id) {
            const oppDetailRes = await fetch(`${GHL_BASE}/opportunities/${opp.id}`, { headers: ghlHeaders });
            if (oppDetailRes.ok) {
              const oppDetail = await oppDetailRes.json();
              const oppCfs = oppDetail?.opportunity?.customFields || [];
              const statusField = oppCfs.find(f => f.id === 'Hk81fRW2HaTqlry4I1L0');
              bonoPaid = statusField?.value?.startsWith('paid');
            }
          }
        }
        console.log('[Koibox] GHL check — ECP:', contactEcp, 'bonoPaid:', bonoPaid);
      }
    } catch (err) {
      console.log('[Koibox] GHL payment check failed:', err.message);
    }
  }

  // 1. Sync client first (find or create)
  let clientId = body.koibox_client_id;
  if (!clientId && (email || movil)) {
    const syncResult = await syncLead(
      { nombre, email, movil, ciudad: clinica, notas: notas || 'Bono Diagnóstico 195€', sexo: body.sexo },
      koiboxHeaders,
      corsHeaders,
    );
    const syncData = JSON.parse(syncResult.body);
    if (syncData.clientId) {
      clientId = syncData.clientId;
    }
  }

  // 2. Create the appointment
  const appointmentPayload = {
    titulo: `Diagnóstico Capilar - ${nombre || 'Paciente'}`,
    fecha,
    hora_inicio,
    hora_fin,
    user: employeeId,
    servicios: [SERVICES.primera_consulta_diagnostico],
    notas: notas || (bonoPaid
      ? 'Reserva desde quiz online — ✅ BONO DIAGNÓSTICO PAGADO'
      : 'Reserva desde quiz online — Diagnóstico Capilar'),
  };
  if (clientId) {
    appointmentPayload.cliente = clientId;
  }

  console.log('[Koibox] Creating appointment:', JSON.stringify(appointmentPayload));

  const res = await fetch(`${KOIBOX_BASE}/agenda/`, {
    method: 'POST',
    headers: koiboxHeaders,
    body: JSON.stringify(appointmentPayload),
  });

  const appointmentData = await res.json();

  if (!res.ok) {
    console.log('[Koibox] Appointment creation failed:', res.status, JSON.stringify(appointmentData));
    return {
      statusCode: res.status,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Appointment creation failed', details: appointmentData }),
    };
  }

  console.log('[Koibox] Appointment created:', appointmentData.id);

  // 3. Sync to GHL: add tags + note + update opportunity stage
  let ghlSync = { status: 'skipped' };
  try {
    ghlSync = await syncAppointmentToGHL({ nombre, email, movil, fecha, hora_inicio, clinica, koiboxId: String(appointmentData.id || ''), ghl_contact_id, bonoPaid, contactEcp });
  } catch (err) {
    ghlSync = { status: 'error', error: err.message };
    console.log('[Koibox→GHL] Sync failed:', err.message);
  }

  // 4. Update Firestore lead with appointment info
  updateLeadByEmail(email, {
    appointmentStatus: 'booked',
    appointmentClinica: clinica || '',
    appointmentFecha: fecha || '',
    appointmentHora: hora_inicio || '',
    appointmentKoiboxId: String(appointmentData.id || ''),
    appointmentBookedAt: new Date().toISOString(),
  });

  // 5. Track in PostHog server-side (enrich with lead attribution)
  const leadSource = await getLeadSourceByEmail(email);
  trackServerEvent('appointment_booked', {
    clinica,
    fecha,
    hora_inicio,
    hora_fin,
    has_email: !!email,
    has_phone: !!movil,
    koibox_appointment_id: appointmentData.id,
    koibox_client_id: clientId,
    ...leadSource,
  }, email);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      success: true,
      appointmentId: appointmentData.id,
      fecha,
      hora_inicio,
      hora_fin,
      clinica,
      clientId,
      ghlSync,
    }),
  };
}

/**
 * Cancel an appointment in Koibox and update GHL accordingly.
 * Called when patient confirms they can't attend (48h reminder flow).
 * - PATCH Koibox appointment estado=5 (cancelled)
 * - Update GHL opportunity: tratamiento_status → cancelled, stage → cancelled
 * - Clear contact fecha_cita/hora_cita
 * - Add cancellation note
 */
async function cancelAppointment(body, koiboxHeaders, corsHeaders) {
  const { koibox_id, ghl_contact_id, reason } = body;

  if (!koibox_id) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'koibox_id required' }) };
  }

  // 1. Cancel in Koibox (estado 5 = cancelled)
  let koiboxResult = { status: 'skipped' };
  try {
    const cancelRes = await fetch(`${KOIBOX_BASE}/agenda/${koibox_id}/`, {
      method: 'PATCH',
      headers: koiboxHeaders,
      body: JSON.stringify({ estado: 5 }),
    });
    if (cancelRes.ok) {
      koiboxResult = { status: 'cancelled' };
      console.log('[Koibox] Appointment cancelled:', koibox_id);
    } else {
      const errData = await cancelRes.json().catch(() => ({}));
      koiboxResult = { status: 'error', code: cancelRes.status, details: errData };
      console.log('[Koibox] Cancel failed:', cancelRes.status, JSON.stringify(errData));
    }
  } catch (err) {
    koiboxResult = { status: 'error', error: err.message };
    console.log('[Koibox] Cancel exception:', err.message);
  }

  // 2. Update GHL: opportunity + contact + note
  let ghlResult = { status: 'skipped' };
  const ghlKey = process.env.VITE_GHL_API_KEY;
  if (ghl_contact_id && ghlKey) {
    try {
      ghlResult = await syncCancellationToGHL(ghl_contact_id, ghlKey, koibox_id, reason);
    } catch (err) {
      ghlResult = { status: 'error', error: err.message };
      console.log('[Koibox→GHL] Cancel sync failed:', err.message);
    }
  }

  // 3. Track in PostHog
  trackServerEvent('appointment_cancelled', {
    koibox_id,
    reason: reason || 'patient_cancelled',
    ghl_contact_id: ghl_contact_id || '',
  });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      success: koiboxResult.status === 'cancelled',
      koibox: koiboxResult,
      ghl: ghlResult,
    }),
  };
}

/**
 * Sync cancellation to GHL:
 * - Update opportunity: tratamiento_status → cancelled, move to Cancelled stage
 * - Clear contact fecha_cita/hora_cita fields
 * - Add cancellation note
 * - Add tag cita_cancelada
 */
async function syncCancellationToGHL(contactId, apiKey, koiboxId, reason) {
  const ghlHeaders = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Version': '2021-07-28',
  };
  const locationId = process.env.VITE_GHL_LOCATION_ID || 'U4SBRYIlQtGBDHLFwEUf';

  const PIPELINE_STAGE_CANCELLED = 'c961b576-b14d-43a6-ac75-a26695886d58'; // Lost/Cancelled

  // Contact custom field IDs
  const APPOINTMENT_CF = {
    fecha_cita:   'yEjha5MpjAeDrrUfFmur',
    hora_cita:    'KX7eyTmYQKbi0937Wj9I',
    clinica_cita: 'upGgK5yc0bSDwqC99DkZ',
  };

  // 1. Find and update opportunity
  try {
    const searchRes = await fetch(
      `${GHL_BASE}/opportunities/search?location_id=${locationId}&contact_id=${contactId}&status=open`,
      { headers: ghlHeaders }
    );
    const searchData = await searchRes.json();
    const opp = (searchData?.opportunities || [])[0];

    if (opp) {
      await fetch(`${GHL_BASE}/opportunities/${opp.id}`, {
        method: 'PUT',
        headers: ghlHeaders,
        // Note: tratamiento_status is NOT changed — it preserves payment state (not_paid/paid_195/paid_70)
        // Cancellation is tracked via pipelineStageId only
        body: JSON.stringify({
          pipelineStageId: PIPELINE_STAGE_CANCELLED,
          customFields: [
            { key: 'fecha_cita_opp', field_value: '' },
            { key: 'hora_cita_opp', field_value: '' },
            { key: 'koibox_id', field_value: '' },
          ],
        }),
      });
      console.log('[Cancel→GHL] Opportunity updated to cancelled:', opp.id);
    }
  } catch (err) {
    console.log('[Cancel→GHL] Opportunity update failed:', err.message);
  }

  // 2. Clear contact appointment fields
  try {
    await fetch(`${GHL_BASE}/contacts/${contactId}`, {
      method: 'PUT',
      headers: ghlHeaders,
      body: JSON.stringify({
        customFields: [
          { id: APPOINTMENT_CF.fecha_cita, field_value: '' },
          { id: APPOINTMENT_CF.hora_cita, field_value: '' },
          { id: APPOINTMENT_CF.clinica_cita, field_value: '' },
        ],
      }),
    });
    console.log('[Cancel→GHL] Contact appointment fields cleared');
  } catch (err) {
    console.log('[Cancel→GHL] Contact update failed:', err.message);
  }

  // 3. Add cancellation note
  const reasonText = reason || 'El paciente no puede asistir';
  const noteBody = `❌ CITA CANCELADA\nMotivo: ${reasonText}\nKoibox ID: ${koiboxId}\nFecha de cancelación: ${new Date().toISOString()}\nHueco liberado en la agenda.`;

  try {
    await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: ghlHeaders,
      body: JSON.stringify({ body: noteBody }),
    });
    console.log('[Cancel→GHL] Cancellation note added');
  } catch (err) {
    console.log('[Cancel→GHL] Note creation failed:', err.message);
  }

  // 4. Add tag for workflow trigger (Ramiro configures notification to commercial)
  try {
    await fetch(`${GHL_BASE}/contacts/${contactId}/tags`, {
      method: 'POST',
      headers: ghlHeaders,
      body: JSON.stringify({ tags: ['cita_cancelada'] }),
    });
    console.log('[Cancel→GHL] Tag cita_cancelada added');
  } catch (err) {
    console.log('[Cancel→GHL] Tag addition failed:', err.message);
  }

  return { status: 'ok', contactId };
}

/**
 * Get appointment details from Koibox by ID.
 * Used by the reagendar page to show current appointment info.
 */
async function getAppointment(body, koiboxHeaders, corsHeaders) {
  const { koibox_id } = body;

  if (!koibox_id) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'koibox_id required' }) };
  }

  try {
    const res = await fetch(`${KOIBOX_BASE}/agenda/${koibox_id}/`, { headers: koiboxHeaders });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { statusCode: res.status, headers: corsHeaders, body: JSON.stringify({ error: 'Appointment not found', details: errData }) };
    }
    const data = await res.json();
    // Return only the fields the frontend needs
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        id: data.id,
        fecha: data.fecha,
        hora_inicio: data.hora_inicio,
        hora_fin: data.hora_fin,
        estado: data.estado, // 1=pending, 2=confirmed, 5=cancelled
        titulo: data.titulo,
        cliente: data.cliente ? { nombre: data.cliente_nombre || data.cliente?.nombre, id: data.cliente } : null,
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
}

/**
 * Look up a contact's active appointment via GHL opportunity → Koibox.
 * Used by /mi-cita page: pass ghl_contact_id, get back appointment details + clinica.
 */
async function getContactAppointment(body, koiboxHeaders, corsHeaders) {
  const { ghl_contact_id } = body;

  if (!ghl_contact_id) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'ghl_contact_id required' }) };
  }

  const ghlKey = process.env.VITE_GHL_API_KEY;
  if (!ghlKey) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'GHL API key not configured' }) };
  }

  const ghlHeaders = {
    'Authorization': `Bearer ${ghlKey}`,
    'Content-Type': 'application/json',
    'Version': '2021-07-28',
  };
  const locationId = process.env.VITE_GHL_LOCATION_ID || 'U4SBRYIlQtGBDHLFwEUf';

  // 1. Get contact name from GHL
  let contactName = '';
  try {
    const contactRes = await fetch(`${GHL_BASE}/contacts/${ghl_contact_id}`, { headers: ghlHeaders });
    if (contactRes.ok) {
      const contactData = await contactRes.json();
      contactName = contactData?.contact?.firstName || contactData?.contact?.name || '';
    }
  } catch (err) {
    console.log('[GetContactAppt] Contact fetch failed:', err.message);
  }

  // 2. Find open opportunity with koibox_id
  let koiboxId = '';
  let clinica = '';
  try {
    const searchRes = await fetch(
      `${GHL_BASE}/opportunities/search?location_id=${locationId}&contact_id=${ghl_contact_id}&status=open`,
      { headers: ghlHeaders }
    );
    const searchData = await searchRes.json();
    const opp = (searchData?.opportunities || [])[0];

    if (opp?.id) {
      const oppDetailRes = await fetch(`${GHL_BASE}/opportunities/${opp.id}`, { headers: ghlHeaders });
      if (oppDetailRes.ok) {
        const oppDetail = await oppDetailRes.json();
        const cfs = oppDetail?.opportunity?.customFields || [];
        const koiboxField = cfs.find(f => f.id === 'x1MAP0Om3rUW3a10ZiUe');
        koiboxId = koiboxField?.fieldValue || koiboxField?.value || '';

        // Get clinica from contact custom fields
        const contactRes2 = await fetch(`${GHL_BASE}/contacts/${ghl_contact_id}`, { headers: ghlHeaders });
        if (contactRes2.ok) {
          const cData = await contactRes2.json();
          const contactCfs = cData?.contact?.customFields || [];
          const clinicaField = contactCfs.find(f => f.id === 'upGgK5yc0bSDwqC99DkZ');
          clinica = (clinicaField?.value || '').toLowerCase();
        }
      }
    }
  } catch (err) {
    console.log('[GetContactAppt] Opportunity search failed:', err.message);
  }

  if (!koiboxId) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ hasAppointment: false, contactName }),
    };
  }

  // 3. Get appointment from Koibox
  try {
    const res = await fetch(`${KOIBOX_BASE}/agenda/${koiboxId}/`, { headers: koiboxHeaders });
    if (!res.ok) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ hasAppointment: false, contactName }),
      };
    }
    const data = await res.json();

    // estado 5 = cancelled
    if (data.estado === 5) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ hasAppointment: false, contactName, previouslyCancelled: true }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        hasAppointment: true,
        contactName,
        koibox_id: koiboxId,
        clinica: clinica || '',
        appointment: {
          id: data.id,
          fecha: data.fecha,
          hora_inicio: data.hora_inicio,
          hora_fin: data.hora_fin,
          estado: data.estado,
        },
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
}

/**
 * Reschedule: cancel old appointment + create new one + update GHL.
 * Expects: koibox_id (old), ghl_contact_id, clinica, fecha, hora_inicio, hora_fin, nombre, email, movil
 */
async function rescheduleAppointment(body, koiboxHeaders, corsHeaders) {
  const { koibox_id, ghl_contact_id, clinica, fecha, hora_inicio, email } = body;

  if (!koibox_id || !fecha || !hora_inicio) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'koibox_id, fecha, hora_inicio required' }) };
  }

  // 1. Cancel old appointment in Koibox (estado 5)
  let cancelResult = { status: 'skipped' };
  try {
    const cancelRes = await fetch(`${KOIBOX_BASE}/agenda/${koibox_id}/`, {
      method: 'PATCH',
      headers: koiboxHeaders,
      body: JSON.stringify({ estado: 5 }),
    });
    cancelResult = cancelRes.ok ? { status: 'cancelled' } : { status: 'error', code: cancelRes.status };
    console.log('[Reschedule] Old appointment cancelled:', koibox_id, cancelResult.status);
  } catch (err) {
    cancelResult = { status: 'error', error: err.message };
    console.log('[Reschedule] Cancel failed:', err.message);
  }

  // 2. Create new appointment via the existing flow
  const createResult = await createAppointment(
    { ...body, action: 'create_appointment' },
    koiboxHeaders,
    corsHeaders,
  );

  const createData = JSON.parse(createResult.body);

  // 3. Track reschedule event
  trackServerEvent('appointment_rescheduled', {
    old_koibox_id: koibox_id,
    new_koibox_id: createData.appointmentId || '',
    clinica,
    fecha,
    hora_inicio,
    ghl_contact_id: ghl_contact_id || '',
  }, email);

  // 4. Add reschedule note to GHL
  const ghlKey = process.env.VITE_GHL_API_KEY;
  if (ghl_contact_id && ghlKey && createData.success) {
    try {
      const ghlHeaders = {
        'Authorization': `Bearer ${ghlKey}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28',
      };
      const noteBody = `🔄 CITA REAGENDADA\nCita anterior (Koibox #${koibox_id}) cancelada.\nNueva cita: ${fecha} a las ${hora_inicio} — ${clinica || ''}\nNuevo Koibox ID: ${createData.appointmentId}\nReagendado por el paciente: ${new Date().toISOString()}`;
      await fetch(`${GHL_BASE}/contacts/${ghl_contact_id}/notes`, {
        method: 'POST',
        headers: ghlHeaders,
        body: JSON.stringify({ body: noteBody }),
      });
      console.log('[Reschedule→GHL] Reschedule note added');
    } catch (err) {
      console.log('[Reschedule→GHL] Note failed:', err.message);
    }
  }

  return {
    statusCode: createResult.statusCode,
    headers: corsHeaders,
    body: JSON.stringify({
      success: createData.success,
      rescheduled: true,
      oldAppointmentId: koibox_id,
      oldCancelStatus: cancelResult.status,
      newAppointmentId: createData.appointmentId,
      fecha,
      hora_inicio,
      clinica,
      ghlSync: createData.ghlSync,
    }),
  };
}

/**
 * After creating a Koibox appointment, sync status to GHL:
 * - Find contact by email/phone (or use provided ghl_contact_id)
 * - Update contact custom fields (fecha_cita, hora_cita, clinica_cita)
 * - Add note with appointment details
 * - Update opportunity: stage → Booked, tratamiento_status → booked, koibox_id, fecha, hora
 */
async function syncAppointmentToGHL({ nombre, email, movil, fecha, hora_inicio, clinica, koiboxId, ghl_contact_id, bonoPaid, contactEcp }) {
  const ghlKey = process.env.VITE_GHL_API_KEY;
  if (!ghlKey) {
    console.log('[Koibox→GHL] No GHL API key, skipping sync');
    return { status: 'skipped', reason: 'no_api_key' };
  }

  const ghlHeaders = {
    'Authorization': `Bearer ${ghlKey}`,
    'Content-Type': 'application/json',
    'Version': '2021-07-28',
  };

  // 1. Use provided GHL contact ID, or find by email/phone
  let contactId = ghl_contact_id || null;
  const locationId = process.env.VITE_GHL_LOCATION_ID || 'U4SBRYIlQtGBDHLFwEUf';

  if (!contactId && email) {
    const searchRes = await fetch(
      `${GHL_BASE}/contacts/search/duplicate?locationId=${locationId}&email=${encodeURIComponent(email)}`,
      { headers: ghlHeaders }
    );
    if (searchRes.ok) {
      const data = await searchRes.json();
      contactId = data?.contact?.id;
    }
  }

  if (!contactId && movil) {
    const searchRes = await fetch(
      `${GHL_BASE}/contacts/search/duplicate?locationId=${locationId}&phone=${encodeURIComponent(movil)}`,
      { headers: ghlHeaders }
    );
    if (searchRes.ok) {
      const data = await searchRes.json();
      contactId = data?.contact?.id;
    }
  }

  if (!contactId) {
    console.log('[Koibox→GHL] Contact not found for:', email || movil);
    return { status: 'error', reason: 'contact_not_found' };
  }

  console.log('[Koibox→GHL] Found contact:', contactId);

  // 2. No extra tags — Ramiro configures flows in GHL
  const clinicaName = clinica ? clinica.charAt(0).toUpperCase() + clinica.slice(1) : '';

  // 3. Save appointment date/time as contact custom fields (for workflow triggers)
  // Custom field IDs created via GHL API:
  const APPOINTMENT_CF = {
    fecha_cita:   'yEjha5MpjAeDrrUfFmur',  // DATE
    hora_cita:    'KX7eyTmYQKbi0937Wj9I',  // TEXT
    clinica_cita: 'upGgK5yc0bSDwqC99DkZ',  // TEXT
  };

  try {
    await fetch(`${GHL_BASE}/contacts/${contactId}`, {
      method: 'PUT',
      headers: ghlHeaders,
      body: JSON.stringify({
        customFields: [
          { id: APPOINTMENT_CF.fecha_cita, field_value: fecha || '' },
          { id: APPOINTMENT_CF.hora_cita, field_value: hora_inicio || '' },
          { id: APPOINTMENT_CF.clinica_cita, field_value: clinicaName || '' },
        ],
      }),
    });
    console.log('[Koibox→GHL] Contact custom fields updated (fecha_cita, hora_cita, clinica_cita)');
  } catch (err) {
    console.log('[Koibox→GHL] Contact custom fields update failed:', err.message);
  }

  // 4. Add note with appointment details
  const fechaDisplay = fecha || 'sin fecha';
  const horaDisplay = hora_inicio || 'sin hora';
  const noteBody = `📅 CITA AGENDADA — Diagnóstico Capilar\nClínica: Hospital Capilar ${clinicaName}\nFecha: ${fechaDisplay}\nHora: ${horaDisplay}\nReservado desde: Quiz online\nFecha de reserva: ${new Date().toISOString()}`;

  try {
    await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: ghlHeaders,
      body: JSON.stringify({ body: noteBody }),
    });
    console.log('[Koibox→GHL] Note added to contact');
  } catch (err) {
    console.log('[Koibox→GHL] Note creation failed:', err.message);
  }

  // 5. Update opportunity: move to "Booked" stage + update tratamiento_status, koibox_id, fecha, hora
  const PIPELINE_STAGE_BOOKED = 'f9e5c1cf-7701-4883-ac96-f16b3d78c0d5';
  // Opportunity custom field IDs
  const OPP_CF_BOOKING = {
    tratamiento_status: 'Hk81fRW2HaTqlry4I1L0',  // Tratamiento Status (SINGLE_OPTIONS)
    koibox_id:          'x1MAP0Om3rUW3a10ZiUe',  // koibox_id (TEXT)
    appointment_date:   'UTUymkHREIxPmmMzx5N1',  // appointment_date (DATE)
    appointment_hour:   'ftEDr8jnG1GEe5dObXCl',  // Appointment hour (TEXT)
    fecha_cita_opp:     'RXAkzlyYHnz4MjYuYaml',  // fecha_cita_opp (DATE) - mirrors contact.fecha_cita
    hora_cita_opp:      'age1q0r6Ek0PQztGZ4FJ',   // hora_cita_opp (TEXT) - mirrors contact.hora_cita
    link_reagendar:     'FuAgIVjPvnlMyIybL8fX',  // link_reagendar (TEXT) - patient self-service reschedule/cancel
  };

  try {
    const searchRes = await fetch(
      `${GHL_BASE}/opportunities/search?location_id=${locationId}&contact_id=${contactId}&status=open`,
      { headers: ghlHeaders }
    );
    const searchData = await searchRes.json();
    const opportunities = searchData?.opportunities || [];

    if (opportunities.length > 0) {
      const opp = opportunities[0];
      // Note: tratamiento_status is NOT updated here — it tracks payment (not_paid/paid_195/paid_70),
      // booking state is tracked via pipelineStageId
      // Generate reagendar link: uses contact_id directly (auto-detects appointment)
      const SITE_BASE = process.env.SITE_URL || 'https://diagnostico.hospitalcapilar.com';
      const linkReagendar = `${SITE_BASE}/mi-cita?c=${contactId}`;

      const customFields = [
        { key: 'koibox_id', field_value: koiboxId || '' },
        { key: 'fecha_cita_opp', field_value: fecha || '' },
        { key: 'hora_cita_opp', field_value: hora_inicio || '' },
        { key: 'link_reagendar', field_value: linkReagendar },
      ];
      await fetch(`${GHL_BASE}/opportunities/${opp.id}`, {
        method: 'PUT',
        headers: ghlHeaders,
        body: JSON.stringify({
          pipelineStageId: PIPELINE_STAGE_BOOKED,
          customFields,
        }),
      });
      console.log('[Koibox→GHL] Opportunity moved to Booked stage:', opp.id, 'koiboxId:', koiboxId, 'linkReagendar:', linkReagendar);
    }
  } catch (err) {
    console.log('[Koibox→GHL] Opportunity update failed:', err.message);
  }

  // 6. Tag bono_pendiente for women ECPs who haven't paid yet
  // ECP values from quiz: 'Mujer con caida hormonal', 'Caida postparto'
  const WOMEN_ECPS = ['mujer con caida hormonal', 'caida postparto'];
  const isWomanEcp = contactEcp && WOMEN_ECPS.some(e => contactEcp.toLowerCase().includes(e));

  if (isWomanEcp && !bonoPaid) {
    try {
      await fetch(`${GHL_BASE}/contacts/${contactId}/tags`, {
        method: 'POST',
        headers: ghlHeaders,
        body: JSON.stringify({ tags: ['bono_pendiente'] }),
      });
      console.log('[Koibox→GHL] Tag bono_pendiente added (ECP mujer, no payment yet)');
    } catch (err) {
      console.log('[Koibox→GHL] Tag bono_pendiente failed:', err.message);
    }
  } else if (isWomanEcp && bonoPaid) {
    try {
      await fetch(`${GHL_BASE}/contacts/${contactId}/tags`, {
        method: 'POST',
        headers: ghlHeaders,
        body: JSON.stringify({ tags: ['bono_pagado'] }),
      });
      console.log('[Koibox→GHL] Tag bono_pagado added (ECP mujer, already paid)');
    } catch (err) {
      console.log('[Koibox→GHL] Tag bono_pagado failed:', err.message);
    }
  }

  return { status: 'ok', contactId };
}

/**
 * Track an event server-side to PostHog.
 * Fire-and-forget: does not block the response.
 */
function trackServerEvent(eventName, properties = {}, distinctId = null) {
  const posthogKey = process.env.VITE_POSTHOG_KEY;
  if (!posthogKey) return;

  const payload = {
    api_key: posthogKey,
    event: eventName,
    properties: {
      ...properties,
      distinct_id: distinctId || 'server-anonymous',
      $lib: 'server-netlify',
      timestamp: new Date().toISOString(),
    },
  };

  // Fire-and-forget
  fetch(`${POSTHOG_HOST}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(err => console.log('[PostHog] Server capture failed:', err.message));
}

/**
 * Search for a client by phone or email.
 */
async function searchClient(body, koiboxHeaders, corsHeaders) {
  const { movil, email } = body;

  if (!movil && !email) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'movil or email required' }) };
  }

  const param = movil
    ? `movil=${encodeURIComponent(movil)}`
    : `email=${encodeURIComponent(email)}`;

  const res = await fetch(`${KOIBOX_BASE}/clientes/?${param}`, {
    headers: koiboxHeaders,
  });

  if (!res.ok) {
    return { statusCode: res.status, headers: corsHeaders, body: JSON.stringify({ error: 'Search failed' }) };
  }

  const data = await res.json();
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      count: data.count,
      results: data.results.map(c => ({
        id: c.id,
        nombre: c.nombre,
        apellido1: c.apellido1,
        email: c.email,
        movil: c.movil,
        provincia: c.provincia,
      })),
    }),
  };
}
