#!/usr/bin/env node

/**
 * Test: Salesforce Booking Sync
 *
 * Tests the sendBookingToSalesforce() flow by calling the koibox-proxy
 * with a test booking payload. Uses the test slot (30257) and a test contact.
 *
 * Usage:
 *   node scripts/test-sf-booking-sync.js [BASE_URL]
 *
 * Default: https://diagnostico.hospitalcapilar.com
 * Local:   node scripts/test-sf-booking-sync.js http://localhost:8888
 */

const BASE_URL = process.argv[2] || 'https://diagnostico.hospitalcapilar.com';
const PROXY_URL = `${BASE_URL}/.netlify/functions/koibox-proxy`;

// Test data — uses a future date to avoid conflicts
const TEST_PAYLOAD = {
  action: 'create_appointment',
  nombre: 'Test SF-Sync',
  email: 'test-sf-sync@growth4u.io',
  movil: '+34600000001',
  fecha: '2026-04-15',
  hora_inicio: '10:00',
  hora_fin: '10:30',
  clinica: 'madrid',
  notas: 'TEST — Salesforce booking sync verification',
  // No ghl_contact_id — will test graceful fallback
};

async function run() {
  console.log('🧪 Testing Salesforce Booking Sync');
  console.log(`   Target: ${PROXY_URL}`);
  console.log('');

  // Step 1: Test payload structure (dry run — just verify endpoint responds)
  console.log('1️⃣  Sending test booking request...');
  try {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_PAYLOAD),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      console.log(`   ✅ Booking created — Koibox ID: ${data.appointmentId}`);
      console.log(`   ✅ GHL sync: ${data.ghlSync?.status || 'skipped'}`);
      console.log(`   ✅ Salesforce sync fired (check Netlify logs for [SF-Booking])`);
      console.log('');
      console.log('📋 Check Salesforce for a new lead with:');
      console.log('   - Email: test-sf-sync@growth4u.io');
      console.log('   - Origen: GU4');
      console.log('   - Clínica: Madrid');
      console.log('');

      // Cleanup: cancel the test appointment
      if (data.appointmentId) {
        console.log('2️⃣  Cleaning up — cancelling test appointment...');
        const cancelRes = await fetch(PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'cancel_appointment',
            koibox_id: data.appointmentId,
            reason: 'test_cleanup',
          }),
        });
        const cancelData = await cancelRes.json();
        console.log(`   ${cancelData.success ? '✅' : '❌'} Appointment ${data.appointmentId} ${cancelData.success ? 'cancelled' : 'cancel failed'}`);
      }
    } else {
      console.log(`   ❌ Booking failed: ${res.status}`, JSON.stringify(data));
    }
  } catch (err) {
    console.log(`   ❌ Request failed: ${err.message}`);
  }

  console.log('');
  console.log('📝 To verify Salesforce sync, check Netlify function logs:');
  console.log('   netlify functions:log koibox-proxy');
  console.log('   Look for: [SF-Booking] Web-To-Lead sent');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
