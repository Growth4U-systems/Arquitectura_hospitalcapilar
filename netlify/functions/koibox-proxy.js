const KOIBOX_BASE = 'https://api.koibox.cloud/api';

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
const EMPLOYEES = {
  madrid: 4600,
  pontevedra: 4600,  // TODO: get real employee IDs from Koibox
  murcia: 4600,
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

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `Unknown action: ${action}. Supported: sync_lead, search_client, get_availability, create_appointment` }),
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
  const { nombre, email, movil, fecha, hora_inicio, hora_fin, clinica, notas } = body;

  if (!fecha || !hora_inicio || !hora_fin) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'fecha, hora_inicio, hora_fin required' }) };
  }

  const employeeId = EMPLOYEES[clinica] || EMPLOYEES.madrid;

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
    servicios: [{ id: SERVICES.primera_consulta_diagnostico }],
    notas: notas || 'Reserva desde quiz online — Bono Diagnóstico 195€ pagado',
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
    }),
  };
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
