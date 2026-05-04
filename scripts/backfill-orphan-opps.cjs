// Backfill: crea oportunidades en el pipeline G4U para contactos que tienen
// door=quiz_largo|quiz_corto|form|meta_form_directo pero ningún opp asociado.
//
// Causa: ghl-proxy.js a veces falla al crear la opp tras crear el contacto.
// Sin opp, el contacto es invisible en el dashboard y en el pipeline.
//
// DRY-RUN por defecto. Pasa --apply para crear las opps de verdad.
//
// Uso:
//   node scripts/backfill-orphan-opps.cjs              # dry-run
//   node scripts/backfill-orphan-opps.cjs --apply      # crea las opps

require('dotenv').config();

const KEY = process.env.VITE_GHL_API_KEY;
const LOC = process.env.VITE_GHL_LOCATION_ID || 'U4SBRYIlQtGBDHLFwEUf';
const PIPELINE = 'xXCgpUIEizlqdrmGrJkg';
const STAGE_NEW_LEAD = 'fbed92b1-5e91-4b86-820f-44b9f66f8b73';
const BASE = 'https://services.leadconnectorhq.com';
const h = { Authorization: 'Bearer ' + KEY, Version: '2021-07-28' };

const DOOR_CF = '2JYlfGk60lHbuyh9vcdV';
const APPLY = process.argv.includes('--apply');

const FROM = '2026-04-09';
const TO = '2026-05-03';

async function searchContactsInRange() {
  const all = [];
  let page = 1;
  while (page < 10) {
    const res = await fetch(BASE + '/contacts/search', {
      method: 'POST',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locationId: LOC,
        pageLimit: 100,
        page,
        sort: [{ field: 'dateAdded', direction: 'desc' }],
        filters: [{ field: 'dateAdded', operator: 'range', value: { gte: FROM, lte: TO } }],
      }),
    });
    if (!res.ok) break;
    const d = await res.json();
    const batch = d.contacts || [];
    all.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return all;
}

async function fetchAllOppsInPipeline() {
  let all = [], startAfterId = '', hasMore = true, guard = 0;
  while (hasMore && guard++ < 50) {
    const url = `${BASE}/opportunities/search?location_id=${LOC}&pipeline_id=${PIPELINE}&limit=100${startAfterId ? `&startAfterId=${startAfterId}` : ''}`;
    const r = await fetch(url, { headers: h });
    if (!r.ok) break;
    const d = await r.json();
    const opps = d.opportunities || [];
    all = all.concat(opps);
    hasMore = opps.length >= 100;
    if (hasMore) startAfterId = opps[opps.length - 1].id;
  }
  return all;
}

async function createOpp(contact, doorValue) {
  const oppName = [contact.firstName, contact.lastName].filter(Boolean).join(' ')
    || contact.name
    || contact.email
    || `Backfill ${contact.id}`;
  const body = {
    pipelineId: PIPELINE,
    locationId: LOC,
    name: oppName,
    pipelineStageId: STAGE_NEW_LEAD,
    status: 'open',
    contactId: contact.id,
    monetaryValue: 0,
  };
  const r = await fetch(`${BASE}/opportunities/`, {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`POST ${r.status}: ${txt.slice(0, 200)}`);
  }
  const d = await r.json();
  return d.opportunity || d;
}

(async () => {
  if (!KEY) { console.error('Missing VITE_GHL_API_KEY'); process.exit(1); }
  console.log(`Modo: ${APPLY ? '🔥 APPLY (crea opps reales)' : '🧪 DRY-RUN (no modifica nada)'}`);
  console.log('');

  console.log('Pulling contactos en rango...');
  const contacts = await searchContactsInRange();
  console.log('  →', contacts.length, 'contactos');

  console.log('Pulling opps en pipeline...');
  const opps = await fetchAllOppsInPipeline();
  const contactsWithOpp = new Set(opps.map(o => o.contactId).filter(Boolean));
  console.log('  →', opps.length, 'opps |', contactsWithOpp.size, 'contactos únicos con opp');
  console.log('');

  // Identify orphans: contacts WITH door but WITHOUT opp
  const orphans = [];
  for (const c of contacts) {
    const cfs = c.customFields || [];
    const doorVal = (cfs.find(f => f.id === DOOR_CF)?.value || cfs.find(f => f.id === DOOR_CF)?.fieldValue || '').toLowerCase();
    if (!doorVal) continue;
    if (contactsWithOpp.has(c.id)) continue;
    orphans.push({ contact: c, door: doorVal });
  }

  console.log('Huérfanos (door set pero sin opp):', orphans.length);
  console.log('');
  console.log('Distribución por door:');
  const byDoor = {};
  orphans.forEach(o => { byDoor[o.door] = (byDoor[o.door] || 0) + 1; });
  Object.entries(byDoor).forEach(([d,n]) => console.log(' ', d.padEnd(20), n));
  console.log('');

  if (!APPLY) {
    console.log('--- Lista de huérfanos (primeros 20) ---');
    orphans.slice(0, 20).forEach(o => {
      const name = [o.contact.firstName, o.contact.lastName].filter(Boolean).join(' ') || o.contact.name || '(sin nombre)';
      console.log(' ', name.padEnd(30), '| door='+o.door, '| email='+(o.contact.email||'(none)'));
    });
    console.log('');
    console.log('Re-corre con --apply para crear las opps.');
    return;
  }

  // APPLY mode
  console.log('Creando opps...');
  let created = 0, failed = 0;
  for (const o of orphans) {
    try {
      const opp = await createOpp(o.contact, o.door);
      console.log('  ✓ creada opp', opp.id, 'para', o.contact.email || o.contact.id);
      created++;
    } catch (e) {
      console.log('  ✗ failed para', o.contact.email || o.contact.id, '→', e.message);
      failed++;
    }
  }
  console.log('');
  console.log('Done — creadas:', created, '| fallidas:', failed);
})();
