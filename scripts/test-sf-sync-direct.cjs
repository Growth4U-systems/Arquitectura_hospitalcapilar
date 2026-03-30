#!/usr/bin/env node

/**
 * Direct test of Salesforce Web-To-Lead booking sync.
 * Tests the payload WITHOUT creating a real Koibox appointment.
 *
 * Usage: node scripts/test-sf-sync-direct.cjs [--dry-run]
 *
 * --dry-run: Only show the payload, don't send to Salesforce
 */

// Load .env manually (no dotenv dependency needed)
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && !key.startsWith('#')) process.env[key.trim()] = val.join('=').trim();
  });
}

const SALESFORCE_URL = 'https://webto.salesforce.com/servlet/servlet.WebToLead?encoding=UTF-8&orgId=00D090000047Cb3';

const SF = {
  oid:                     '00D090000047Cb3',
  cita_asesoria:           '00NIV00001XhtqX',
  interesado_en:           '00N0900000CPq2Y',
  tipo_proceso_venta:      '00N0900000CPq2U',
  owner_id:                '00509000008tZrfAAE',
  clinica_pck:             '00NbE000006pqPJ',
  lopd_firmada:            '00N0900000CPq2F',
  acepta_comunicaciones:   '00N0900000CPq1v',
  g4u_id:                  '00NbE000006ougH',
  g4u_perfil_clinico:      '00NbE000006pt3p',
  g4u_score:               '00NbE000006psAz',
  g4u_door:                '00NbE000006pqXP',
  genero:                  '00N0900000CPq2O',
  g4u_edad:                '00NbE000006pvbt',
  g4u_condicion:           '00NbE000006ptTd',
  g4u_motivacion:          '00NbE000006ptJx',
  g4u_formato:             '00NbE000006ptOn',
  g4u_mensaje_comercial:   '00NbE000006ptWr',
};

const isDryRun = process.argv.includes('--dry-run');

async function run() {
  console.log('🧪 Test #2: Salesforce Web-To-Lead Booking Sync');
  console.log(`   Mode: ${isDryRun ? 'DRY RUN (no envío)' : 'LIVE (envío real a SF)'}`);
  console.log('');

  // Simulate booking data — with ALL fields this time
  const testData = {
    firstName: 'NO TOCAR Test',
    lastName: 'G4U-Sync-v2',
    email: 'test-sf-sync-v2@growth4u.io',
    phone: '+34600000002',
    clinica: 'Madrid',
    // Cita asesoría — try ISO date format for SF compatibility
    citaDateTime: '2026-04-15T10:00:00',
    ecp: 'Alopecia androgenética masculina',
    score: '85',
    door: 'quiz_largo',
    sexo: 'Masculino',
    edad: '35',
    condicion: 'Entradas, Corona',
    motivacion: 'Recuperar confianza',
    formato: 'Presencial',
    agentMessage: 'NO TOCAR — Test #2 para validar campos faltantes (estado, cita, condición, edad)',
  };

  // Build payload
  const params = new URLSearchParams();
  params.append('oid', SF.oid);
  params.append('retURL', 'http://');
  params.append('first_name', testData.firstName);
  params.append('last_name', testData.lastName);
  params.append('email', testData.email);
  params.append('phone', testData.phone);
  params.append('lead_source', 'GU4');
  // Estado: try both standard field name AND the Status field directly
  params.append('Status', 'Cita agendada con asesor');
  // Cita asesoría — ISO format
  params.append(SF.cita_asesoria, testData.citaDateTime);
  params.append(SF.interesado_en, testData.ecp);
  params.append(SF.tipo_proceso_venta, testData.formato);
  params.append(SF.clinica_pck, testData.clinica);
  params.append('ownerId', SF.owner_id);
  params.append(SF.g4u_id, 'test-contact-id-v2');
  params.append(SF.g4u_perfil_clinico, testData.ecp);
  params.append(SF.g4u_score, testData.score);
  params.append(SF.g4u_door, testData.door);
  params.append(SF.genero, testData.sexo);
  params.append(SF.g4u_edad, testData.edad);
  params.append(SF.g4u_condicion, testData.condicion);
  params.append(SF.g4u_motivacion, testData.motivacion);
  params.append(SF.g4u_formato, testData.formato);
  params.append(SF.g4u_mensaje_comercial, testData.agentMessage);
  params.append(SF.lopd_firmada, 'Sí');
  params.append(SF.acepta_comunicaciones, '1');

  // Display readable payload
  console.log('📋 Payload para Salesforce:');
  console.log('─'.repeat(55));
  const readable = {
    'first_name': testData.firstName,
    'last_name': testData.lastName,
    'email': testData.email,
    'phone': testData.phone,
    'lead_source': 'GU4',
    'Status': 'Cita agendada con asesor',
    'ownerId (Noemí)': SF.owner_id,
    'Cita asesoría': testData.citaDateTime,
    'Interesado en': testData.ecp,
    'Tipo proceso venta': testData.formato,
    'Clínica': testData.clinica,
    'G4U Score': testData.score,
    'G4U Door': testData.door,
    'G4U Perfil Clínico': testData.ecp,
    'Género': testData.sexo,
    'G4U Edad': testData.edad,
    'G4U Condición': testData.condicion,
    'G4U Motivación': testData.motivacion,
    'G4U Mensaje comercial': testData.agentMessage,
    'LOPD Firmada': 'Sí',
  };
  for (const [key, val] of Object.entries(readable)) {
    console.log(`   ${key}: ${val}`);
  }
  console.log('─'.repeat(55));
  console.log('');

  if (isDryRun) {
    console.log('✅ Dry run completado. Payload válido.');
    console.log('   Ejecuta sin --dry-run para enviar a Salesforce.');
    return;
  }

  // Send to Salesforce
  console.log('📤 Enviando a Salesforce Web-To-Lead...');
  try {
    const res = await fetch(SALESFORCE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    console.log(`   Status: ${res.status}`);
    if (res.ok) {
      console.log('   ✅ Enviado correctamente');
      console.log('');
      console.log('📋 Verifica en Salesforce:');
      console.log('   Busca: test-sf-sync-v2@growth4u.io');
      console.log('   Campos corregidos a verificar:');
      console.log('      - Estado: "Cita agendada con asesor" (antes: Nuevo)');
      console.log('      - Cita asesoría: 2026-04-15T10:00:00 (antes: vacío)');
      console.log('      - G4U Condición: "Entradas, Corona" (antes: vacío)');
      console.log('      - G4U Edad: 35 (antes: vacío)');
      console.log('');
      console.log('   ⚠️  NO TOCAR — Bryan avisado');
    } else {
      console.log(`   ❌ Error: ${res.status} ${res.statusText}`);
      const body = await res.text();
      console.log('   Response:', body.substring(0, 200));
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }
}

run().catch(console.error);
