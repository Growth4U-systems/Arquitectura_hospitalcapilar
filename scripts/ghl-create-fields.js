#!/usr/bin/env node
/**
 * Creates the custom fields needed for appointment sync in GHL.
 * Run once: node scripts/ghl-create-fields.js
 */

import { readFileSync } from 'fs';
try {
  const envFile = readFileSync(new URL('../.env', import.meta.url), 'utf-8');
  for (const line of envFile.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch { /* .env not found */ }

const GHL_BASE = 'https://services.leadconnectorhq.com';
const API_KEY = process.env.VITE_GHL_API_KEY;
const LOCATION_ID = process.env.VITE_GHL_LOCATION_ID || 'U4SBRYIlQtGBDHLFwEUf';

if (!API_KEY) {
  console.error('VITE_GHL_API_KEY not set');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
  'Version': '2021-07-28',
};

const FIELDS_TO_CREATE = [
  { name: 'fecha_cita', dataType: 'DATE', placeholder: '2026-03-20' },
  { name: 'hora_cita', dataType: 'TEXT', placeholder: '10:00' },
  { name: 'clinica_cita', dataType: 'TEXT', placeholder: 'madrid' },
];

async function main() {
  // 1. List existing fields
  console.log('Fetching existing custom fields...');
  const listRes = await fetch(`${GHL_BASE}/locations/${LOCATION_ID}/customFields`, { headers });
  const listData = await listRes.json();
  const existing = listData.customFields || [];

  console.log(`Found ${existing.length} existing fields\n`);

  for (const field of FIELDS_TO_CREATE) {
    // Check if already exists
    const found = existing.find(f =>
      f.name?.toLowerCase() === field.name.toLowerCase() ||
      f.fieldKey?.includes(field.name)
    );

    if (found) {
      console.log(`✅ "${field.name}" already exists → ID: ${found.id}`);
      continue;
    }

    // Create the field
    console.log(`Creating "${field.name}" (${field.dataType})...`);
    const createRes = await fetch(`${GHL_BASE}/locations/${LOCATION_ID}/customFields`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: field.name,
        dataType: field.dataType,
        placeholder: field.placeholder,
      }),
    });

    const createData = await createRes.json();

    if (createRes.ok) {
      console.log(`✅ Created "${field.name}" → ID: ${createData.customField?.id || createData.id || 'unknown'}`);
    } else {
      console.log(`❌ Failed to create "${field.name}":`, createRes.status, JSON.stringify(createData));
    }
  }

  // 2. List all fields again to show final state
  console.log('\n--- Final custom fields ---');
  const finalRes = await fetch(`${GHL_BASE}/locations/${LOCATION_ID}/customFields`, { headers });
  const finalData = await finalRes.json();
  for (const f of (finalData.customFields || [])) {
    const highlight = FIELDS_TO_CREATE.some(fc => f.name?.toLowerCase() === fc.name) ? ' ← NEW' : '';
    console.log(`  ${f.id} | ${f.name} (${f.dataType})${highlight}`);
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
