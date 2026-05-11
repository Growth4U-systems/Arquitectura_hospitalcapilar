// One-shot: crear campos custom para el Meta Lead Form del nuevo flujo /quiz-hospitalcapilar/.
// SINGLE_OPTIONS con valores en minúscula para mapear con lo que envía Meta.
//
// Uso: node scripts/create-quiz-hc-fields.cjs
require('dotenv').config();

const KEY = process.env.VITE_GHL_API_KEY;
const LOC = process.env.VITE_GHL_LOCATION_ID || 'U4SBRYIlQtGBDHLFwEUf';
const BASE = 'https://services.leadconnectorhq.com';

if (!KEY) {
  console.error('❌ VITE_GHL_API_KEY no está en .env');
  process.exit(1);
}

const h = {
  Authorization: `Bearer ${KEY}`,
  Version: '2021-07-28',
  'Content-Type': 'application/json',
};

const FIELDS = [
  {
    name: 'Sexo Lead Form',
    dataType: 'SINGLE_OPTIONS',
    picklistOptions: ['mujer', 'hombre'],
  },
  {
    name: 'Preocupacion caida',
    dataType: 'SINGLE_OPTIONS',
    picklistOptions: ['si', 'no'],
  },
];

async function listExisting() {
  const res = await fetch(`${BASE}/locations/${LOC}/customFields`, { headers: h });
  if (!res.ok) throw new Error(`list: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.customFields || [];
}

async function createField({ name, dataType, picklistOptions }) {
  const body = { name, dataType };
  // GHL create endpoint accepts `options` as a plain string array; the GET endpoint
  // returns them as `picklistOptions` later. Inconsistent naming on Meta's side.
  if (picklistOptions) body.options = picklistOptions;
  const res = await fetch(`${BASE}/locations/${LOC}/customFields`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`create ${name}: ${res.status} ${JSON.stringify(json)}`);
  return json.customField || json;
}

(async () => {
  const existing = await listExisting();
  const byName = new Map(existing.map((f) => [f.name.trim().toLowerCase(), f]));

  for (const f of FIELDS) {
    const key = f.name.toLowerCase();
    if (byName.has(key)) {
      const e = byName.get(key);
      console.log(`= EXISTS  ${e.id}  ${e.name}  (${e.dataType})`);
      continue;
    }
    try {
      const created = await createField(f);
      console.log(`+ CREATED ${created.id}  ${created.name}  (${created.dataType})`);
    } catch (e) {
      console.error(`✗ FAIL    ${f.name}: ${e.message}`);
    }
  }
})();
