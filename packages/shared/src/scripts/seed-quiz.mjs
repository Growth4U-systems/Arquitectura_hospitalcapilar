#!/usr/bin/env node
// CLI Script to seed Hospital Capilar Quiz directly to Firestore
// Usage: node seed-quiz.mjs [userId]

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';

// Firebase config - reads from environment variables
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey) {
  console.error('Missing VITE_FIREBASE_API_KEY. Set environment variables before running.');
  process.exit(1);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const HOSPITAL_CAPILAR_QUIZ = {
  name: 'Hospital Capilar - Diagnóstico Capilar',
  slug: 'hospital-capilar',
  status: 'published',
  branding: {
    primaryColor: '#4CA994',
    backgroundColor: '#FFFFFF',
    logoUrl: null,
  },
  settings: {
    showProgressBar: true,
    allowBack: true,
    requireConsent: true,
  },
  cta: {
    type: 'none',
    calendlyUrl: null,
    whatsappNumber: null,
    redirectUrl: null,
    buttonText: 'Solicitar Estudio Gratuito',
  },
  stats: {
    totalViews: 0,
    totalStarts: 0,
    totalCompletes: 0,
    totalLeads: 0,
  },
};

const SCREENS = [
  {
    order: 0,
    type: 'welcome',
    title: '¿Eres candidato para un\n*Injerto Capilar?*',
    subtitle: 'Nuestro algoritmo médico analiza 8 factores clave de tu perfil para ofrecerte un pre-diagnóstico de viabilidad gratuito.',
    options: [],
    config: {
      badge: 'Diagnóstico Capilar Online IA',
      buttonText: 'Comenzar Diagnóstico Gratuito',
      features: ['Análisis Completo', 'Revisión Médica', '100% Privado'],
      footerText: 'Más de 5.000 pacientes evaluados este año.',
    },
  },
  {
    order: 1,
    type: 'single_choice',
    title: 'Para comenzar, ¿cuál es tu género?',
    subtitle: 'El patrón de caída y el tratamiento varían biológicamente.',
    options: [
      { label: 'Hombre', value: 'hombre', icon: '👨' },
      { label: 'Mujer', value: 'mujer', icon: '👩' },
    ],
    config: {},
  },
  {
    order: 2,
    type: 'single_choice',
    title: '¿Cuál es tu rango de edad?',
    subtitle: 'La edad influye en la estabilidad de la zona donante.',
    options: [
      { label: 'Menos de 25 años', value: 'menos_25' },
      { label: '25 - 35 años', value: '25_35' },
      { label: '36 - 45 años', value: '36_45' },
      { label: '46 - 55 años', value: '46_55' },
      { label: 'Más de 55 años', value: 'mas_55' },
    ],
    config: {},
  },
  {
    order: 3,
    type: 'single_choice',
    title: '¿Tienes antecedentes familiares de alopecia?',
    subtitle: 'La genética es el factor determinante en el 90% de los casos.',
    options: [
      { label: 'Sí, padre o madre', value: 'padres', icon: '🧬' },
      { label: 'Sí, abuelos o tíos', value: 'abuelos', icon: '👴' },
      { label: 'No que yo sepa', value: 'no', icon: '🤷‍♂️' },
    ],
    config: {},
  },
  {
    order: 4,
    type: 'visual_choice',
    title: '¿Dónde notas mayor pérdida de cabello?',
    subtitle: 'Selecciona la imagen que más se parece a tu situación actual.',
    options: [
      { label: 'Entradas (Línea frontal)', value: 'entradas', description: 'Retroceso en la frente' },
      { label: 'Coronilla', value: 'coronilla', description: 'Pérdida en la zona superior trasera' },
      { label: 'Difusa / General', value: 'difusa', description: 'Pérdida de densidad global' },
      { label: 'Avanzada', value: 'avanzada', description: 'Zona frontal y coronilla unidas' },
    ],
    config: {},
  },
  {
    order: 5,
    type: 'single_choice',
    title: '¿Desde cuándo notas la caída?',
    subtitle: 'Nos ayuda a evaluar la velocidad de progresión de la alopecia.',
    options: [
      { label: 'Menos de 1 año (Reciente)', value: 'menos_1', icon: '⚡' },
      { label: 'Entre 1 y 5 años (Progresiva)', value: '1_5', icon: '📅' },
      { label: 'Más de 5 años (Estable)', value: 'mas_5', icon: '⏳' },
      { label: 'Siempre he tenido poco pelo', value: 'siempre', icon: '🧬' },
    ],
    config: {},
  },
  {
    order: 6,
    type: 'single_choice',
    title: '¿Cómo describirías tu tipo de pelo?',
    subtitle: 'El grosor y la forma determinan la técnica de injerto ideal (FUE/DHI).',
    options: [
      { label: 'Liso y fino', value: 'liso_fino', icon: '〰️' },
      { label: 'Liso y grueso', value: 'liso_grueso', icon: '➖' },
      { label: 'Ondulado / Rizado', value: 'ondulado', icon: '➰' },
      { label: 'Muy rizado / Afro', value: 'afro', icon: '🌀' },
    ],
    config: {},
  },
  {
    order: 7,
    type: 'single_choice',
    title: '¿Has seguido algún tratamiento médico antes?',
    subtitle: 'Como Minoxidil, Finasteride, mesoterapia o PRP.',
    options: [
      { label: 'No, nunca', value: 'nunca' },
      { label: 'Sí, actualmente lo uso', value: 'actualmente' },
      { label: 'Sí, en el pasado pero lo dejé', value: 'pasado' },
    ],
    config: {},
  },
  {
    order: 8,
    type: 'single_choice',
    title: 'Si fueras apto/a, ¿cuándo te gustaría realizar el tratamiento?',
    subtitle: 'Esto nos ayuda a comprobar la disponibilidad de quirófanos.',
    options: [
      { label: 'Lo antes posible', value: 'asap', icon: '🚀' },
      { label: 'En los próximos 3 meses', value: '3_meses', icon: '📅' },
      { label: 'En 6 meses o más', value: '6_meses', icon: '🗓️' },
      { label: 'Solo me estoy informando', value: 'informando', icon: '🔍' },
    ],
    config: {},
  },
  {
    order: 9,
    type: 'lead_form',
    title: 'Recibe tu Informe Médico + Presupuesto',
    subtitle: 'Nuestro equipo médico te enviará por WhatsApp/Email la valoración detallada de tu caso y una estimación de unidades foliculares necesarias.',
    options: [],
    config: {
      fields: ['name', 'phone', 'email'],
      resultBadge: 'Diagnóstico Preliminar: APTO',
      resultDescription: 'Hemos analizado tus 8 respuestas. Según tu perfil, eres un candidato potencial para una intervención con alta densidad.',
      consentText: 'Consiento el tratamiento de mis datos de salud para recibir el pre-diagnóstico médico personalizado.',
      trustBadges: ['ISHRS', 'WFI', 'FUE Europe'],
    },
  },
  {
    order: 10,
    type: 'result',
    title: '¡Solicitud Enviada!',
    subtitle: 'Nuestro equipo médico te contactará en las próximas 24-48 horas con tu informe personalizado.',
    options: [],
    config: {},
  },
];

async function seedHospitalCapilarQuiz(userId) {
  console.log('Seeding Hospital Capilar Quiz for user:', userId);

  // Check if quiz already exists
  const quizzesRef = collection(db, 'quizzes');
  const existingQuery = query(quizzesRef, where('slug', '==', 'hospital-capilar'));
  const existingDocs = await getDocs(existingQuery);

  if (!existingDocs.empty) {
    console.log('Quiz Hospital Capilar already exists with ID:', existingDocs.docs[0].id);
    return existingDocs.docs[0].id;
  }

  // Create quiz document
  const quizData = {
    ...HOSPITAL_CAPILAR_QUIZ,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const quizRef = await addDoc(quizzesRef, quizData);
  console.log('Quiz created with ID:', quizRef.id);

  // Create screens
  const screensRef = collection(db, 'quizzes', quizRef.id, 'screens');

  for (const screen of SCREENS) {
    await addDoc(screensRef, {
      ...screen,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log(`  Created screen: ${screen.type} (order ${screen.order})`);
  }

  console.log('Created', SCREENS.length, 'screens');
  console.log('\n✅ Quiz seeded successfully!');
  console.log(`\nView quiz at: http://localhost:5174/q/hospital-capilar`);

  return quizRef.id;
}

// Run seed
const userId = process.argv[2] || 'demo-user';
seedHospitalCapilarQuiz(userId)
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error seeding quiz:', error);
    process.exit(1);
  });
