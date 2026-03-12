#!/usr/bin/env node
/**
 * GHL Discovery Script
 * Lists custom fields, calendars, and pipeline stages from GHL.
 * Used to get the IDs needed for Koibox→GHL appointment sync.
 *
 * Usage:
 *   node scripts/ghl-discover.js
 *
 * Requires env vars: VITE_GHL_API_KEY, VITE_GHL_LOCATION_ID
 * (reads from .env file if present)
 */

// Load .env manually (no dotenv dependency)
import { readFileSync } from 'fs';
try {
  const envFile = readFileSync(new URL('../.env', import.meta.url), 'utf-8');
  for (const line of envFile.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch { /* .env not found, rely on exported env vars */ }

const GHL_BASE = 'https://services.leadconnectorhq.com';
const API_KEY = process.env.VITE_GHL_API_KEY;
const LOCATION_ID = process.env.VITE_GHL_LOCATION_ID || 'U4SBRYIlQtGBDHLFwEUf';

if (!API_KEY) {
  console.error('❌ VITE_GHL_API_KEY not set. Add it to .env or export it.');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
  'Version': '2021-07-28',
};

async function listCustomFields() {
  console.log('\n═══════════════════════════════════════');
  console.log('📋 CUSTOM FIELDS (Contact level)');
  console.log('═══════════════════════════════════════');

  const res = await fetch(`${GHL_BASE}/locations/${LOCATION_ID}/customFields`, { headers });
  const data = await res.json();

  if (!res.ok) {
    console.error('Error:', res.status, JSON.stringify(data));
    return;
  }

  const fields = data.customFields || [];
  console.log(`Found ${fields.length} custom fields:\n`);

  // Group by category
  const grouped = {};
  for (const f of fields) {
    const group = f.fieldKey?.split('.')[0] || 'other';
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(f);
  }

  for (const [group, groupFields] of Object.entries(grouped)) {
    console.log(`  [${group}]`);
    for (const f of groupFields) {
      const dateFlag = f.dataType === 'DATE' ? ' 📅' : '';
      console.log(`    ${f.id} | ${f.name} (${f.dataType || f.fieldKey})${dateFlag}`);
    }
    console.log('');
  }

  // Check if fecha_cita exists
  const fechaCita = fields.find(f => f.name?.toLowerCase().includes('fecha_cita') || f.fieldKey?.includes('fecha_cita'));
  if (fechaCita) {
    console.log(`✅ fecha_cita already exists: ${fechaCita.id}`);
  } else {
    console.log('⚠️  fecha_cita NOT found. You need to create it.');
    console.log('   → Go to GHL > Settings > Custom Fields > Create');
    console.log('   → Name: "fecha_cita", Type: Date, Object: Contact');
  }
}

async function listCalendars() {
  console.log('\n═══════════════════════════════════════');
  console.log('📅 CALENDARS');
  console.log('═══════════════════════════════════════');

  const res = await fetch(`${GHL_BASE}/calendars/?locationId=${LOCATION_ID}`, { headers });
  const data = await res.json();

  if (!res.ok) {
    console.error('Error:', res.status, JSON.stringify(data));
    return;
  }

  const calendars = data.calendars || [];
  console.log(`Found ${calendars.length} calendars:\n`);

  for (const cal of calendars) {
    console.log(`  ${cal.id} | ${cal.name} (${cal.calendarType || 'unknown'})`);
    if (cal.description) console.log(`    → ${cal.description}`);
  }

  if (calendars.length === 0) {
    console.log('  No calendars found. You may need to create one in GHL.');
  }
}

async function listPipelineStages() {
  console.log('\n═══════════════════════════════════════');
  console.log('🔄 PIPELINE STAGES');
  console.log('═══════════════════════════════════════');

  const res = await fetch(`${GHL_BASE}/opportunities/pipelines?locationId=${LOCATION_ID}`, { headers });
  const data = await res.json();

  if (!res.ok) {
    console.error('Error:', res.status, JSON.stringify(data));
    return;
  }

  const pipelines = data.pipelines || [];
  for (const pipeline of pipelines) {
    console.log(`\n  Pipeline: ${pipeline.name} (${pipeline.id})`);
    for (const stage of pipeline.stages || []) {
      console.log(`    ${stage.id} | ${stage.name}`);
    }
  }
}

async function main() {
  console.log('🔍 GHL Discovery — Location:', LOCATION_ID);
  console.log('   API Key:', API_KEY.slice(0, 10) + '...');

  await listCustomFields();
  await listCalendars();
  await listPipelineStages();

  console.log('\n═══════════════════════════════════════');
  console.log('📌 NEXT STEPS');
  console.log('═══════════════════════════════════════');
  console.log('1. If fecha_cita, hora_cita, clinica_cita custom fields don\'t exist:');
  console.log('   → Create them in GHL Settings > Custom Fields');
  console.log('2. Copy the calendar ID you want to use for appointments');
  console.log('3. Copy the pipeline stage ID for "Cita Agendada"');
  console.log('4. Update koibox-proxy.js with these IDs\n');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
