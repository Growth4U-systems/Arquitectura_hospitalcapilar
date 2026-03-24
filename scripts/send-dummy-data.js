#!/usr/bin/env node
/**
 * Send realistic dummy data to PostHog for dashboard validation.
 * All events dated within the last 7 days so you can filter "Last 7 days".
 *
 * Usage: node scripts/send-dummy-data.js
 */

const POSTHOG_KEY = process.env.VITE_POSTHOG_KEY || 'phc_mULGdOq6RenSrAyLPMgBQLbP4os7c9l0K7Xq1AKwUBx';
const POSTHOG_HOST = 'https://eu.i.posthog.com';

// ---- CONFIG ----
const SOURCES = [
  { name: 'meta',       weight: 0.42, utm_source: 'facebook', utm_medium: 'cpc', fbclid: 'fb_abc123' },
  { name: 'google_ads', weight: 0.25, utm_source: 'google',   utm_medium: 'cpc', gclid: 'gads_xyz789' },
  { name: 'seo',        weight: 0.15, utm_source: 'google',   utm_medium: 'organic' },
  { name: 'tiktok',     weight: 0.08, utm_source: 'tiktok',   utm_medium: 'cpc' },
  { name: 'direct',     weight: 0.07 },
  { name: 'other',      weight: 0.03, utm_source: 'referral', utm_medium: 'link' },
];

const FUNNELS = [
  { name: 'quiz_largo',          weight: 0.55, path: '/' },
  { name: 'quiz_corto',          weight: 0.28, path: '/rapido/' },
  { name: 'formulario_directo',  weight: 0.17, path: '/form/' },
];

const NICHOS = [
  { name: 'la-farmacia',          weight: 0.22 },  // 💊 La Farmacia — OTC frustrado
  { name: 'que-me-pasa',         weight: 0.20 },  // ❓ ¿Qué Me Pasa? — sin diagnóstico (gateway)
  { name: 'el-espejo',           weight: 0.18 },  // 🪞 El Espejo — hombre joven 20-28
  { name: 'es-normal',           weight: 0.13 },  // 👩 "Es Normal" — mujer menopausia 45-55
  { name: 'postparto',           weight: 0.10 },  // 🍼 Lo Que Vino Con el Bebé — postparto
  { name: 'ya-me-engañaron',     weight: 0.09 },  // 🏪 Ya Me Engañaron — insatisfecho otra clínica
  { name: 'la-inversion',        weight: 0.08 },  // 💸 La Inversión — operado sin mantenimiento
];

const ECPS = [
  { name: 'Hombre con caida sin diagnostico', weight: 0.32 },
  { name: 'OTC frustrado sin resultado',      weight: 0.18 },
  { name: 'Sin diagnostico gateway',          weight: 0.15 },
  { name: 'Joven con alopecia temprana',       weight: 0.10 },
  { name: 'Mujer con caida hormonal',          weight: 0.08 },
  { name: 'Caida postparto',                   weight: 0.06 },
  { name: 'Mala experiencia otra clinica',     weight: 0.05 },
  { name: 'Post-trasplante mantenimiento',     weight: 0.04 },
  { name: 'No candidato - cuero cabelludo',    weight: 0.02 },
];

const FRAMES = ['FRAME_A', 'FRAME_C', 'FRAME_D', 'WAITLIST', 'DERIVACION'];

// Quiz question answer options (weighted)
const QUIZ_QUESTIONS = [
  { id: 'sexo', options: [
    { value: 'hombre', weight: 0.65 }, { value: 'mujer', weight: 0.35 },
  ]},
  { id: 'edad', options: [
    { value: '18-25', weight: 0.18 }, { value: '26-35', weight: 0.30 }, { value: '36-45', weight: 0.25 },
    { value: '46-55', weight: 0.17 }, { value: '55+', weight: 0.10 },
  ]},
  { id: 'problema', options: [
    { value: 'caida', weight: 0.40 }, { value: 'densidad', weight: 0.25 },
    { value: 'entradas', weight: 0.15 }, { value: 'postparto', weight: 0.08 },
    { value: 'cuero-cabelludo', weight: 0.07 }, { value: 'otro', weight: 0.05 },
  ]},
  { id: 'tiempo', options: [
    { value: '<3m', weight: 0.12 }, { value: '3-12m', weight: 0.28 },
    { value: '1-3a', weight: 0.35 }, { value: '3a+', weight: 0.25 },
  ]},
  { id: 'patron_perdida', options: [
    { value: 'entradas', weight: 0.30 }, { value: 'coronilla', weight: 0.25 },
    { value: 'difusa', weight: 0.20 }, { value: 'frontal', weight: 0.15 }, { value: 'no-se', weight: 0.10 },
  ]},
  { id: 'antecedentes', options: [
    { value: 'padre', weight: 0.35 }, { value: 'madre', weight: 0.15 },
    { value: 'ambos', weight: 0.20 }, { value: 'ninguno', weight: 0.20 }, { value: 'no-se', weight: 0.10 },
  ]},
  { id: 'diagnostico_previo', options: [
    { value: 'nunca', weight: 0.45 }, { value: 'dermatologo', weight: 0.25 },
    { value: 'clinica-capilar', weight: 0.15 }, { value: 'medico-cabecera', weight: 0.10 },
    { value: 'frontal-fibrosante', weight: 0.03 }, { value: 'areata', weight: 0.02 },
  ]},
  { id: 'motivacion', options: [
    { value: 'frenar', weight: 0.35 }, { value: 'recuperar', weight: 0.30 },
    { value: 'diagnostico', weight: 0.20 }, { value: 'segunda-opinion', weight: 0.15 },
  ]},
  { id: 'inversion', options: [
    { value: 'hasta-100', weight: 0.20 }, { value: '100-300', weight: 0.30 },
    { value: '300-500', weight: 0.25 }, { value: '500+', weight: 0.15 }, { value: 'no-se', weight: 0.10 },
  ]},
];

const NOMBRES = ['Carlos', 'María', 'Juan', 'Ana', 'Pedro', 'Laura', 'Miguel', 'Carmen', 'David', 'Lucía', 'Javier', 'Elena', 'Pablo', 'Sofía', 'Diego', 'Marta', 'Andrés', 'Patricia', 'Raúl', 'Isabel'];
const APELLIDOS = ['García', 'Martínez', 'López', 'Sánchez', 'González', 'Rodríguez', 'Fernández', 'Pérez', 'Gómez', 'Díaz', 'Ruiz', 'Hernández', 'Muñoz', 'Álvarez', 'Romero'];

// ---- HELPERS ----
function weightedRandom(items) {
  const r = Math.random();
  let cumulative = 0;
  for (const item of items) {
    cumulative += item.weight;
    if (r <= cumulative) return item;
  }
  return items[items.length - 1];
}

function randomDate(daysBack = 7) {
  const now = Date.now();
  const offset = Math.random() * daysBack * 86400000;
  return new Date(now - offset);
}

function randomEmail(nombre, apellido) {
  const n = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const a = apellido.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const num = Math.floor(Math.random() * 999);
  const domains = ['gmail.com', 'hotmail.com', 'yahoo.es', 'outlook.com'];
  return `${n}.${a}${num}@${domains[Math.floor(Math.random() * domains.length)]}`;
}

function randomPhone() {
  return `34${600 + Math.floor(Math.random() * 100)}${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`;
}

// ---- GENERATE EVENTS ----
function generateDummyData() {
  const events = [];
  const now = new Date();

  // Conversion rates
  const VISIT_TO_START = 0.68;
  const START_TO_COMPLETE = 0.50;
  const COMPLETE_TO_LEAD = 0.62;
  const LEAD_TO_BOOKED = 0.30;
  const BOOKED_TO_ATTENDED = 0.72;
  const BOOKED_TO_NOSHOW = 0.20;

  const NUM_VISITORS = 500;

  for (let i = 0; i < NUM_VISITORS; i++) {
    const source = weightedRandom(SOURCES);
    const funnel = weightedRandom(FUNNELS);
    const nicho = weightedRandom(NICHOS);
    const baseDate = randomDate(7);
    const distinctId = `dummy_${i}_${Date.now()}`;

    const baseProps = {
      traffic_source: source.name,
      funnel_type: funnel.name,
      nicho: nicho.name,
      utm_source: source.utm_source || '',
      utm_medium: source.utm_medium || '',
      ...(source.fbclid ? { fbclid: source.fbclid } : {}),
      ...(source.gclid ? { gclid: source.gclid } : {}),
      $lib: 'dummy-data',
    };

    // 1. Pageview
    events.push({
      event: '$pageview',
      properties: { distinct_id: distinctId, $current_url: `https://diagnostico.hospitalcapilar.com${funnel.path}${nicho.name}`, ...baseProps },
      timestamp: baseDate.toISOString(),
    });

    // 2. Quiz started?
    if (Math.random() > VISIT_TO_START) continue;
    const startDate = new Date(baseDate.getTime() + 5000 + Math.random() * 30000);
    events.push({
      event: 'quiz_started',
      properties: { distinct_id: distinctId, ...baseProps },
      timestamp: startDate.toISOString(),
    });

    // 2b. Question answers (for users who started the quiz)
    let answerTime = startDate.getTime() + 3000;
    const numQuestions = 5 + Math.floor(Math.random() * (QUIZ_QUESTIONS.length - 5)); // answer 5-9 questions
    for (let qi = 0; qi < numQuestions && qi < QUIZ_QUESTIONS.length; qi++) {
      const q = QUIZ_QUESTIONS[qi];
      const answer = weightedRandom(q.options);
      answerTime += 2000 + Math.random() * 8000;
      events.push({
        event: 'question_answered',
        properties: { distinct_id: distinctId, question_id: q.id, question_index: qi, answer_value: answer.value, ...baseProps },
        timestamp: new Date(answerTime).toISOString(),
      });
    }

    // 3. Quiz completed?
    if (Math.random() > START_TO_COMPLETE) continue;
    const completeDate = new Date(answerTime + 5000 + Math.random() * 30000);
    events.push({
      event: 'quiz_completed',
      properties: { distinct_id: distinctId, completion_time_seconds: Math.floor(60 + Math.random() * 180), ...baseProps },
      timestamp: completeDate.toISOString(),
    });

    // 4. Form submitted (lead)?
    if (Math.random() > COMPLETE_TO_LEAD) continue;
    const nombre = NOMBRES[Math.floor(Math.random() * NOMBRES.length)];
    const apellido = APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)];
    const email = randomEmail(nombre, apellido);
    const phone = randomPhone();
    const ecp = weightedRandom(ECPS);
    const frame = FRAMES[Math.floor(Math.random() * FRAMES.length)];
    const formDate = new Date(completeDate.getTime() + 10000 + Math.random() * 60000);

    events.push({
      event: 'form_submitted',
      properties: { distinct_id: distinctId, email, name: `${nombre} ${apellido}`, phone, ...baseProps },
      timestamp: formDate.toISOString(),
    });

    // Identify with email
    events.push({
      event: '$identify',
      properties: {
        distinct_id: distinctId,
        $anon_distinct_id: distinctId,
        $set: { email, name: `${nombre} ${apellido}`, phone, traffic_source: source.name, funnel_type: funnel.name, nicho: nicho.name },
      },
      timestamp: formDate.toISOString(),
    });

    // lead_classified
    events.push({
      event: 'lead_classified',
      properties: { distinct_id: distinctId, ecp: ecp.name, frame, ...baseProps },
      timestamp: new Date(formDate.getTime() + 2000).toISOString(),
    });

    // 5. Appointment booked?
    if (Math.random() > LEAD_TO_BOOKED) continue;
    const bookDate = new Date(formDate.getTime() + 3600000 + Math.random() * 86400000);
    events.push({
      event: 'appointment_booked',
      properties: { distinct_id: distinctId, email, clinica: 'Madrid', ...baseProps, $insert_id: `dummy_${i}_booked` },
      timestamp: bookDate.toISOString(),
    });

    // 6. Attended, no-show, or pending?
    const outcomeRoll = Math.random();
    if (outcomeRoll < BOOKED_TO_ATTENDED) {
      const attendDate = new Date(bookDate.getTime() + 86400000 + Math.random() * 172800000);
      events.push({
        event: 'appointment_attended',
        properties: { distinct_id: distinctId, email, ...baseProps, $insert_id: `dummy_${i}_attended` },
        timestamp: attendDate.toISOString(),
      });

      // Some attended → converted
      if (Math.random() < 0.45) {
        events.push({
          event: 'patient_converted',
          properties: { distinct_id: distinctId, email, monetary_value: Math.floor(2000 + Math.random() * 6000), ...baseProps, $insert_id: `dummy_${i}_converted` },
          timestamp: new Date(attendDate.getTime() + 1800000).toISOString(),
        });
      }
    } else if (outcomeRoll < BOOKED_TO_ATTENDED + BOOKED_TO_NOSHOW) {
      events.push({
        event: 'appointment_no_show',
        properties: { distinct_id: distinctId, email, ...baseProps, $insert_id: `dummy_${i}_noshow` },
        timestamp: new Date(bookDate.getTime() + 86400000).toISOString(),
      });
    }
    // else: pending (no event yet)
  }

  return events;
}

// ---- SEND ----
async function sendBatch(events) {
  const res = await fetch(`${POSTHOG_HOST}/batch/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: POSTHOG_KEY, batch: events }),
  });
  return res.ok;
}

async function main() {
  console.log('Generating dummy data...');
  const events = generateDummyData();

  // Summary
  const summary = {};
  for (const e of events) {
    summary[e.event] = (summary[e.event] || 0) + 1;
  }
  console.log(`Generated ${events.length} events:`);
  for (const [event, count] of Object.entries(summary).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${event}: ${count}`);
  }

  console.log('\nSending to PostHog...');
  let sent = 0;
  for (let i = 0; i < events.length; i += 50) {
    const batch = events.slice(i, i + 50);
    const ok = await sendBatch(batch);
    sent += ok ? batch.length : 0;
    process.stdout.write(`  Batch ${Math.floor(i / 50) + 1}/${Math.ceil(events.length / 50)}: ${ok ? 'OK' : 'FAIL'}\r`);
  }
  console.log(`\n\nDone! Sent ${sent}/${events.length} events.`);
  console.log('Wait 2-3 minutes, then refresh your dashboard with "Last 7 days" filter.');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
