// Scheduled every 15 min (netlify.toml). Closes the sync gap when staff edit
// or cancel appointments directly in Koibox — without this, GHL keeps the
// original hora_cita and sends WhatsApp reminders with the wrong time.
//
// Flow:
//   1. Pull Koibox agenda for [today, today+5 days].
//   2. Filter to our two services (diagnóstico 103385, asesoría 103373).
//   3. For each, find GHL contact (by koibox_id on opp, else by email/phone).
//   4. Compare fecha/hora/estado → update GHL contact + opp + add audit note.

const KOIBOX_BASE = 'https://api.koibox.cloud/api';
const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION = process.env.VITE_GHL_LOCATION_ID || 'U4SBRYIlQtGBDHLFwEUf';

const OUR_SERVICES = new Set([103385, 103373]); // diagnóstico, asesoría
const WINDOW_DAYS = 5;

const CONTACT_CF = {
  fecha_cita:   'yEjha5MpjAeDrrUfFmur',
  hora_cita:    'KX7eyTmYQKbi0937Wj9I',
  clinica_cita: 'upGgK5yc0bSDwqC99DkZ',
};

const OPP_CF = {
  koibox_id:      'x1MAP0Om3rUW3a10ZiUe',
  fecha_cita_opp: 'RXAkzlyYHnz4MjYuYaml',
  hora_cita_opp:  'age1q0r6Ek0PQztGZ4FJ',
};

const PIPELINE_STAGE_CANCELLED = 'c961b576-b14d-43a6-ac75-a26695886d58';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

function getCf(fields, id) {
  const f = (fields || []).find((x) => x.id === id);
  return (f?.value ?? f?.fieldValue ?? '').toString();
}

async function fetchKoiboxAppointments(from, to, headers) {
  const all = [];
  let url = `${KOIBOX_BASE}/agenda/?fecha__gte=${from}&fecha__lte=${to}&limit=50`;
  let pages = 0;
  while (url && pages < 40) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.log(`[Reconcile] Koibox fetch failed: ${res.status}`);
      break;
    }
    const data = await res.json();
    all.push(...(data.results || []));
    url = data.next || null;
    pages += 1;
    if (url) await sleep(100);
  }
  return all;
}

async function findGhlContact({ email, phone }, headers) {
  const tries = [];
  if (email) tries.push(`email=${encodeURIComponent(email)}`);
  if (phone) tries.push(`number=${encodeURIComponent(phone)}`);
  for (const q of tries) {
    const res = await fetch(
      `${GHL_BASE}/contacts/search/duplicate?locationId=${GHL_LOCATION}&${q}`,
      { headers }
    );
    if (!res.ok) continue;
    const data = await res.json();
    if (data?.contact?.id) return data.contact.id;
  }
  return null;
}

async function findOppByKoiboxId(contactId, koiboxId, headers) {
  const res = await fetch(
    `${GHL_BASE}/opportunities/search?location_id=${GHL_LOCATION}&contact_id=${contactId}`,
    { headers }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const opps = data?.opportunities || [];

  const byId = opps.find((o) => {
    const detailCf = o.customFields || [];
    return getCf(detailCf, OPP_CF.koibox_id) === String(koiboxId);
  });
  if (byId) return byId;

  for (const o of opps) {
    const detail = await fetch(`${GHL_BASE}/opportunities/${o.id}`, { headers });
    if (!detail.ok) continue;
    const od = await detail.json();
    if (getCf(od?.opportunity?.customFields, OPP_CF.koibox_id) === String(koiboxId)) {
      return od.opportunity;
    }
  }
  return opps[0] || null;
}

async function patchContact(contactId, fields, headers) {
  return fetch(`${GHL_BASE}/contacts/${contactId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ customFields: fields }),
  });
}

async function patchOpp(oppId, body, headers) {
  return fetch(`${GHL_BASE}/opportunities/${oppId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });
}

async function addNote(contactId, body, headers) {
  return fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ body }),
  });
}

function clinicaFromProvinciaId(id) {
  if (id === 680) return 'Madrid';
  if (id === 697) return 'Murcia';
  if (id === 718) return 'Pontevedra';
  return '';
}

async function reconcileOne(appt, ghlHeaders, stats) {
  const koiboxId = appt.id;
  const servicioIds = (appt.servicios || []).map((s) => s.id || s.value);
  if (!servicioIds.some((id) => OUR_SERVICES.has(id))) return;

  const email = appt.cliente?.email || '';
  const phone = appt.cliente?.movil || '';
  if (!email && !phone) return;

  const estadoId = appt.estado?.id;
  const isCancelled = estadoId === 5;
  const koiboxFecha = appt.fecha || '';
  const koiboxHora = (appt.hora_inicio || '').slice(0, 5);
  const clinica = clinicaFromProvinciaId(appt.cliente?.localidad) || '';

  const contactId = await findGhlContact({ email, phone }, ghlHeaders);
  if (!contactId) {
    stats.skippedNoContact += 1;
    return;
  }

  const contactRes = await fetch(`${GHL_BASE}/contacts/${contactId}`, { headers: ghlHeaders });
  if (!contactRes.ok) return;
  const contact = (await contactRes.json()).contact || {};
  const cfs = contact.customFields || [];

  const ghlFecha = getCf(cfs, CONTACT_CF.fecha_cita);
  const ghlHora = getCf(cfs, CONTACT_CF.hora_cita);

  const opp = await findOppByKoiboxId(contactId, koiboxId, ghlHeaders);

  if (isCancelled) {
    if (!ghlFecha && !ghlHora && (!opp || opp.pipelineStageId === PIPELINE_STAGE_CANCELLED)) return;

    await patchContact(
      contactId,
      [
        { id: CONTACT_CF.fecha_cita, field_value: '' },
        { id: CONTACT_CF.hora_cita, field_value: '' },
        { id: CONTACT_CF.clinica_cita, field_value: '' },
      ],
      ghlHeaders
    );

    if (opp && opp.pipelineStageId !== PIPELINE_STAGE_CANCELLED) {
      await patchOpp(
        opp.id,
        {
          pipelineStageId: PIPELINE_STAGE_CANCELLED,
          customFields: [
            { id: OPP_CF.fecha_cita_opp, field_value: '' },
            { id: OPP_CF.hora_cita_opp, field_value: '' },
            { id: OPP_CF.koibox_id, field_value: '' },
          ],
        },
        ghlHeaders
      );
    }

    await addNote(
      contactId,
      `🔄 RECONCILE — cita cancelada en Koibox (#${koiboxId}). Sincronizado a GHL. ${new Date().toISOString()}`,
      ghlHeaders
    );
    stats.cancelled += 1;
    console.log(`[Reconcile] Cancelled koibox=${koiboxId} contact=${contactId}`);
    return;
  }

  const fechaDiff = ghlFecha && ghlFecha !== koiboxFecha;
  const horaDiff = ghlHora && ghlHora !== koiboxHora;
  if (!fechaDiff && !horaDiff) return;

  await patchContact(
    contactId,
    [
      { id: CONTACT_CF.fecha_cita, field_value: koiboxFecha },
      { id: CONTACT_CF.hora_cita, field_value: koiboxHora },
      ...(clinica ? [{ id: CONTACT_CF.clinica_cita, field_value: clinica }] : []),
    ],
    ghlHeaders
  );

  if (opp) {
    await patchOpp(
      opp.id,
      {
        customFields: [
          { id: OPP_CF.fecha_cita_opp, field_value: koiboxFecha },
          { id: OPP_CF.hora_cita_opp, field_value: koiboxHora },
          { id: OPP_CF.koibox_id, field_value: String(koiboxId) },
        ],
      },
      ghlHeaders
    );
  }

  await addNote(
    contactId,
    `🔄 RECONCILE — cita reagendada en Koibox (#${koiboxId}). GHL: ${ghlFecha} ${ghlHora} → Koibox: ${koiboxFecha} ${koiboxHora}. ${new Date().toISOString()}`,
    ghlHeaders
  );

  stats.updated += 1;
  console.log(
    `[Reconcile] Updated koibox=${koiboxId} contact=${contactId} ${ghlFecha} ${ghlHora} → ${koiboxFecha} ${koiboxHora}`
  );
}

exports.handler = async () => {
  const koiboxKey = process.env.KOIBOX_API_KEY;
  const ghlKey = process.env.VITE_GHL_API_KEY;
  if (!koiboxKey || !ghlKey) {
    console.log('[Reconcile] Missing API keys, skipping');
    return { statusCode: 500, body: 'missing keys' };
  }

  const koiboxHeaders = { 'X-Koibox-Key': koiboxKey, 'Content-Type': 'application/json' };
  const ghlHeaders = {
    Authorization: `Bearer ${ghlKey}`,
    Version: '2021-07-28',
    'Content-Type': 'application/json',
  };

  const today = new Date();
  const end = new Date(today);
  end.setDate(today.getDate() + WINDOW_DAYS);

  const appts = await fetchKoiboxAppointments(ymd(today), ymd(end), koiboxHeaders);
  console.log(`[Reconcile] Koibox appointments in window: ${appts.length}`);

  const stats = { checked: 0, updated: 0, cancelled: 0, skippedNoContact: 0, errors: 0 };

  for (const appt of appts) {
    stats.checked += 1;
    try {
      await reconcileOne(appt, ghlHeaders, stats);
    } catch (err) {
      stats.errors += 1;
      console.log(`[Reconcile] Error koibox=${appt.id}: ${err.message}`);
    }
    await sleep(150);
  }

  console.log('[Reconcile] Done', JSON.stringify(stats));
  return { statusCode: 200, body: JSON.stringify(stats) };
};
