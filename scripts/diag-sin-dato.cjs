// Inspecciona los contactos sin-dato del dashboard. Saca su source + tags + CFs
// para entender de dónde vienen realmente.
require('dotenv').config();

const KEY = process.env.VITE_GHL_API_KEY;
const LOC = process.env.VITE_GHL_LOCATION_ID || 'U4SBRYIlQtGBDHLFwEUf';
const PIPELINE = 'xXCgpUIEizlqdrmGrJkg';
const BASE = 'https://services.leadconnectorhq.com';
const h = { Authorization: 'Bearer ' + KEY, Version: '2021-07-28' };

const DOOR_CF = '2JYlfGk60lHbuyh9vcdV';
const FUNNEL_CF = 'liIshAFJMngl2BV9MtVw';

async function fetchAllOpps() {
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

async function fetchContact(id) {
  try {
    const r = await fetch(`${BASE}/contacts/${id}`, { headers: h });
    if (!r.ok) return null;
    const d = await r.json();
    return d.contact;
  } catch { return null; }
}

(async () => {
  const opps = await fetchAllOpps();
  const FROM_TS = new Date('2026-04-09T00:00:00Z').getTime();
  const TO_TS = new Date('2026-05-03T00:00:00Z').getTime();
  const inRange = opps.filter(o => {
    const t = new Date(o.createdAt||0).getTime();
    return t >= FROM_TS && t < TO_TS;
  });
  // Dedupe by contactId, keep most-progressed
  const oppByContact = new Map();
  for (const o of inRange) {
    if (!o.contactId) continue;
    if (!oppByContact.has(o.contactId)) oppByContact.set(o.contactId, o);
  }

  const contactIds = [...oppByContact.keys()];
  console.log('Total opps in range:', inRange.length, '| unique contacts:', contactIds.length);

  // Fetch all contacts
  const contacts = [];
  let i = 0;
  for (const cid of contactIds) {
    process.stdout.write(`\r  fetching ${++i}/${contactIds.length}`);
    const c = await fetchContact(cid);
    if (c) contacts.push(c);
  }
  console.log('\n');

  // Classify each contact's landing using same logic as dashboard
  const classify = (c) => {
    const cfs = c.customFields || [];
    const cfMap = {};
    cfs.forEach(f => { cfMap[f.id] = f.value || f.fieldValue || ''; });
    const door = (cfMap[DOOR_CF] || cfMap[FUNNEL_CF] || '').toLowerCase();
    const tags = (c.tags || []).map(t => (t||'').toLowerCase());
    const source = (c.source || '').toLowerCase();
    if (source.includes('social media instagram') || source.includes('social media facebook') || source.includes('manual')) {
      return { landing: 'EXCLUIDO_DM_O_MANUAL', door, source, tags: tags.join(',') };
    }
    if (door === 'quiz_largo') return { landing: 'quiz_largo', door, source, tags: tags.join(',') };
    if (door === 'quiz_corto') return { landing: 'quiz_corto', door, source, tags: tags.join(',') };
    if (door === 'form' || door === 'form_directo') return { landing: 'form_directo', door, source, tags: tags.join(',') };
    if (door === 'meta_form_directo' || tags.includes('meta_form_directo')) return { landing: 'form_meta_directo', door, source, tags: tags.join(',') };
    return { landing: 'sin-dato', door, source, tags: tags.join(',') };
  };

  const sinDato = [];
  contacts.forEach(c => {
    const cls = classify(c);
    if (cls.landing === 'sin-dato') {
      sinDato.push({
        id: c.id,
        name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.name,
        email: c.email,
        ...cls,
      });
    }
  });

  console.log('=== Contactos clasificados como sin-dato ===');
  console.log('Total:', sinDato.length);
  console.log('');
  console.log('--- Distribución por contact.source ---');
  const bySource = {};
  sinDato.forEach(c => {
    const s = c.source.slice(0, 60) || '(empty)';
    bySource[s] = (bySource[s] || 0) + 1;
  });
  Object.entries(bySource).sort((a,b)=>b[1]-a[1]).forEach(([s,n]) => console.log(' ', s.padEnd(60), n));

  console.log('');
  console.log('--- Muestra de 10 contactos sin-dato ---');
  sinDato.slice(0, 10).forEach(c => {
    console.log(' ', c.name?.slice(0,30).padEnd(30), '| source="'+c.source.slice(0,40)+'"', '| door="'+c.door+'"', '| tags=['+c.tags+']');
  });
})();
