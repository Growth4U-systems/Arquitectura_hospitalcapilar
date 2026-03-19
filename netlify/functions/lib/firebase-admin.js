/**
 * Firebase Admin SDK singleton for Netlify functions.
 * Reads service account from FIREBASE_SERVICE_ACCOUNT env var (JSON string).
 * Falls back gracefully if not configured.
 */
const admin = require('firebase-admin');

let db = null;
let initialized = false;

function getFirestore() {
  if (initialized) return db;
  initialized = true;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    console.log('[Firebase Admin] FIREBASE_SERVICE_ACCOUNT not set, Firestore updates disabled');
    return null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    db = admin.firestore();
    console.log('[Firebase Admin] Initialized successfully');
    return db;
  } catch (err) {
    console.log('[Firebase Admin] Init failed:', err.message);
    return null;
  }
}

/**
 * Find and update a lead document in Firestore by email.
 * Uses Firebase Admin SDK (bypasses security rules).
 */
async function updateLeadByEmail(email, updateData) {
  const firestore = getFirestore();
  if (!firestore || !email) return;

  try {
    const snapshot = await firestore
      .collection('quiz_leads')
      .where('email', '==', email)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log('[Firestore] No lead found for email:', email);
      return;
    }

    const doc = snapshot.docs[0];
    await doc.ref.update({
      ...updateData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('[Firestore] Lead updated for:', email, 'doc:', doc.id);
  } catch (err) {
    console.log('[Firestore] Update error:', err.message);
  }
}

/**
 * Get source attribution data from a lead by email.
 * Returns { funnel_type, traffic_source, nicho } or empty object.
 */
async function getLeadSourceByEmail(email) {
  const firestore = getFirestore();
  if (!firestore || !email) return {};

  try {
    const snapshot = await firestore
      .collection('quiz_leads')
      .where('email', '==', email)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) return {};

    const source = snapshot.docs[0].data()?.source || {};
    return {
      funnel_type: source.funnel_type || null,
      traffic_source: source.traffic_source || null,
      nicho: source.nicho || null,
    };
  } catch (err) {
    console.log('[Firestore] getLeadSource error:', err.message);
    return {};
  }
}

module.exports = { getFirestore, updateLeadByEmail, getLeadSourceByEmail };
