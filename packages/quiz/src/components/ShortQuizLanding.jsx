import React, { useState, useRef } from 'react';
import { ArrowRight, ArrowLeft, CheckCircle2, Loader2, Phone, ShieldCheck, Stethoscope, Clock } from 'lucide-react';
import { useAnalytics, getUTMParams } from '@hospital-capilar/shared/analytics';
import { db } from '@hospital-capilar/shared/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { NICHOS } from './nichoConfig';
import {
  TopBar,
  StatsSection,
  PainPointsSection,
  SolutionSection,
  TestimonialsSection,
  FAQSection,
  Footer,
} from './LandingSections';

const WhatsAppIcon = ({ size = 24, className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const UbicacionSelect = ({ value, onChange, className }) => (
  <select name="provincia" value={value} onChange={onChange} className={className}>
    <option value="" disabled>Selecciona una ubicación...</option>
    <optgroup label="Clínicas Operativas">
      <option value="madrid">Madrid</option>
      <option value="murcia">Murcia</option>
      <option value="pontevedra">Pontevedra</option>
    </optgroup>
    <optgroup label="Próximas aperturas (Lista Prioritaria)">
      <option value="acoruna">A Coruña (2026)</option>
      <option value="mostoles">Móstoles (2026)</option>
      <option value="albacete">Albacete (2026)</option>
      <option value="valladolid">Valladolid (2026)</option>
      <option value="burgos">Burgos (2026)</option>
      <option value="valencia">Valencia (2026)</option>
    </optgroup>
    <option value="otra">Otra ciudad</option>
  </select>
);

// ECP mapping from situacion answer
const SITUACION_ECP = {
  'caida-sin-diagnostico': 'Hombre con caida sin diagnostico',
  'entradas-coronilla': 'Hombre con caida sin diagnostico',
  'joven-perdida': 'Joven con alopecia temprana',
  'postparto': 'Caida postparto',
  'hormonal': 'Mujer con caida hormonal',
  'post-cirugia': 'Post-trasplante mantenimiento',
  'mala-experiencia': 'Mala experiencia otra clinica',
  'cuero-cabelludo': 'No candidato - cuero cabelludo',
};

// ECP result messages (short version)
const ECP_MESSAGES = {
  'Hombre con caida sin diagnostico': {
    title: 'Tu caída necesita un diagnóstico profesional',
    body: 'Sin una tricoscopía y analítica, cualquier tratamiento es una apuesta. En 30 minutos sabrás exactamente qué tienes.',
  },
  'Joven con alopecia temprana': {
    title: 'Actuar temprano es la mejor decisión',
    body: 'Cuanto antes se diagnostica, más opciones tienes. La caída no se frena sola — pero con diagnóstico a tiempo, los resultados son excelentes.',
  },
  'Mujer con caida hormonal': {
    title: 'Tu caída puede estar conectada a un desbalance hormonal',
    body: 'Necesitas una analítica hormonal cruzada con estudio capilar. Es la pieza que falta entre tu pelo y tu salud.',
  },
  'Caida postparto': {
    title: 'Necesitas saber si es temporal o algo más',
    body: 'El efluvio postparto es temporal en la mayoría de casos. Pero a veces revela una alopecia subyacente. Un diagnóstico te saca de dudas.',
  },
  'Post-trasplante mantenimiento': {
    title: 'Tu trasplante necesita un plan de mantenimiento',
    body: 'El pelo trasplantado no se cae, pero el nativo sí. Un diagnóstico evalúa tu situación actual y protege tu inversión.',
  },
  'Mala experiencia otra clinica': {
    title: 'Entendemos que tengas dudas',
    body: 'Hospital Capilar es un centro médico, no estético. Médicos que diagnostican con datos y te dicen la verdad. Sin presión.',
  },
  'No candidato - cuero cabelludo': {
    title: 'Tu caso requiere un dermatólogo',
    body: 'Lo que describes parece un problema dermatológico del cuero cabelludo. Te recomendamos visitar un dermatólogo especializado.',
  },
};

const ShortQuizLanding = ({ nicho = 'hombres-caida' }) => {
  const config = NICHOS[nicho] || NICHOS['hombres-caida'];
  const analytics = useAnalytics();
  const [utmParams] = useState(() => getUTMParams());

  // Phases: landing → quiz → analyzing → results
  const [phase, setPhase] = useState('landing');
  const [step, setStep] = useState(0); // 0=sexo, 1=situacion, 2=tiempo, 3=urgencia, 4=form
  const [answers, setAnswers] = useState({ sexo: '', situacion: '', tiempo: '', urgencia: '' });
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', provincia: '' });
  const [submitting, setSubmitting] = useState(false);
  const quizRef = useRef(null);

  const handleStartQuiz = () => {
    analytics.trackEvent('short_quiz_started', { nicho });
    window.scrollTo(0, 0);
    setPhase('quiz');
  };

  const handleSelect = (key, value) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
    // Auto-advance after selection
    setTimeout(() => setStep(s => s + 1), 300);
  };

  const handleBack = () => {
    if (step > 0) setStep(s => s - 1);
    else setPhase('landing');
  };

  const handleSubmit = async () => {
    if (!form.nombre || !form.email || !form.telefono || !form.provincia) return;
    setSubmitting(true);
    setPhase('analyzing');

    const ecp = SITUACION_ECP[answers.situacion] || config.ecp;
    const nameParts = form.nombre.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const sourceChannel = utmParams.utm_source
      ? `${utmParams.utm_source}/${utmParams.utm_medium || 'unknown'}`
      : document.referrer ? 'organic/referral' : 'direct';

    // contact_score
    const clinicasOperativas = ['madrid', 'murcia', 'pontevedra'];
    const isOperativa = clinicasOperativas.includes(form.provincia);
    let contactScore = 'NORMAL';
    if (isOperativa) contactScore = 'NORMAL'; // quiz_corto + operativa = NORMAL
    else if (form.provincia === 'otra' || !form.provincia) contactScore = 'OUT';

    const ubicacionMap = {
      madrid: 'Madrid', murcia: 'Murcia', pontevedra: 'Pontevedra',
      acoruna: 'A Coruña', mostoles: 'Móstoles', albacete: 'Albacete',
      valladolid: 'Valladolid', burgos: 'Burgos', valencia: 'Valencia', otra: 'Otra ciudad',
    };

    const tiempoMap = { '<3m': 'menos de 3 meses', '3-12m': '3-12 meses', '1-3a': '1-3 años', '3a+': 'más de 3 años' };
    const urgenciaMap = { alta: 'alta (quiere actuar ya)', media: 'media (quiere entender opciones)', baja: 'baja (solo se informa)' };

    const agentMsg = `Lead quiz corto (${nicho}). Sexo: ${answers.sexo || 'N/A'}. ECP: ${ecp}. Tiempo con el problema: ${tiempoMap[answers.tiempo] || answers.tiempo}. Urgencia: ${urgenciaMap[answers.urgencia] || answers.urgencia}. Ciudad: ${ubicacionMap[form.provincia] || form.provincia}. Canal: ${sourceChannel}.`;

    // GHL Custom Field IDs
    const CF = {
      door:          'qLfWQzqlmfFqLSkPpCwn',
      sexo:          'Z9pZhDFJWJ4QTSGGCYaG',
      ecp:           '7GWpUzewyhIoa6P1Qs6R',
      agent_message: 'b3c4PXftlQRi8zgDqRce',
      contact_score: 'LvOZm5SZe1WR2e1JrEm1',
      utm_source:    'MisB9YJJAH7cnh8JOtQn',
      utm_medium:    'vykx7m6bcfbYMXRqToYP',
      utm_campaign:  '3fUI7GO9o7oZ7ddMNnFf',
      utm_content:   'dydSaUSYbb5R7nYOboLq',
      utm_term:      'eLdhsOthmyD38al527tG',
    };

    const customFields = [
      { id: CF.door, field_value: 'quiz_corto' },
      { id: CF.sexo, field_value: answers.sexo || '' },
      { id: CF.ecp, field_value: ecp },
      { id: CF.agent_message, field_value: agentMsg },
      { id: CF.contact_score, field_value: contactScore },
    ];
    if (utmParams.utm_source) customFields.push({ id: CF.utm_source, field_value: utmParams.utm_source });
    if (utmParams.utm_medium) customFields.push({ id: CF.utm_medium, field_value: utmParams.utm_medium });
    if (utmParams.utm_campaign) customFields.push({ id: CF.utm_campaign, field_value: utmParams.utm_campaign });
    if (utmParams.utm_content) customFields.push({ id: CF.utm_content, field_value: utmParams.utm_content });
    if (utmParams.utm_term) customFields.push({ id: CF.utm_term, field_value: utmParams.utm_term });

    const payload = {
      locationId: import.meta.env.VITE_GHL_LOCATION_ID || 'U4SBRYIlQtGBDHLFwEUf',
      firstName, lastName,
      email: form.email || '',
      phone: form.telefono,
      gender: answers.sexo === 'hombre' ? 'male' : answers.sexo === 'mujer' ? 'female' : '',
      city: ubicacionMap[form.provincia] || form.provincia || '',
      country: 'Spain',
      tags: ['new_lead'],
      source: utmParams.utm_source
        ? `Quiz Corto HC - ${utmParams.utm_source}/${utmParams.utm_medium || ''}`
        : `Quiz Corto Hospital Capilar - ${nicho}`,
      customFields,
      _agentMessage: agentMsg,
      _quizAnswers: JSON.stringify(answers),
      _contactScore: contactScore,
    };

    let ghlResult = { status: 'pending' };
    try {
      const response = await fetch('/.netlify/functions/ghl-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      ghlResult = { status: response.ok ? 'ok' : 'error', contactId: data.contactId || null };
    } catch (err) {
      ghlResult = { status: 'error', error: err.message };
    }

    try {
      await addDoc(collection(db, 'quiz_leads'), {
        nombre: form.nombre, email: form.email, telefono: form.telefono,
        ubicacion: form.provincia, sexo: answers.sexo, nicho, ecp,
        door: 'quiz_corto',
        answersRaw: answers,
        agentMessage: agentMsg,
        source: {
          channel: sourceChannel,
          utm_source: utmParams.utm_source || null, utm_medium: utmParams.utm_medium || null,
          utm_campaign: utmParams.utm_campaign || null, referrer: document.referrer || 'direct',
          landing_url: window.location.href, door: 'quiz_corto',
        },
        ghl: ghlResult, status: 'new', createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Firestore save error:', err);
    }

    analytics.trackEvent('short_quiz_completed', { nicho, ecp, contactScore });

    // Fake analysis delay
    setTimeout(() => {
      setPhase('results');
      setSubmitting(false);
    }, 2500);
  };

  // ==========================================
  // ANALYZING SCREEN
  // ==========================================
  if (phase === 'analyzing') {
    return (
      <div className="min-h-screen bg-white font-sans flex items-center justify-center">
        <div className="text-center px-6">
          <Loader2 size={48} className="text-[#4CA994] animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Analizando tus respuestas...</h2>
          <p className="text-gray-500">Nuestro sistema está preparando tu pre-diagnóstico.</p>
        </div>
      </div>
    );
  }

  // ==========================================
  // RESULTS SCREEN
  // ==========================================
  if (phase === 'results') {
    const ecp = SITUACION_ECP[answers.situacion] || config.ecp;
    const ecpMsg = ECP_MESSAGES[ecp] || ECP_MESSAGES['Hombre con caida sin diagnostico'];
    const isDerivacion = ecp === 'No candidato - cuero cabelludo';
    const WA_PHONE = '34600000000';
    const waText = encodeURIComponent(
      `Hola, soy ${form.nombre.split(' ')[0]}. Acabo de completar el diagnóstico rápido en Hospital Capilar. Me gustaría recibir más información.`
    );
    const waUrl = `https://wa.me/${WA_PHONE}?text=${waText}`;

    // Readable labels for what the user answered
    const situacionLabels = {
      'caida-sin-diagnostico': 'Caída sin diagnóstico',
      'entradas-coronilla': 'Entradas / coronilla',
      'joven-perdida': 'Pérdida temprana de pelo',
      'postparto': 'Caída desde embarazo/parto',
      'hormonal': 'Caída hormonal',
      'post-cirugia': 'Post-trasplante',
      'mala-experiencia': 'Mala experiencia previa',
      'cuero-cabelludo': 'Problema de cuero cabelludo',
    };
    const tiempoLabels = { '<3m': 'Menos de 3 meses', '3-12m': '3-12 meses', '1-3a': '1-3 años', '3a+': 'Más de 3 años' };
    const urgenciaLabels = { alta: 'Quiere actuar ya', media: 'Quiere entender opciones', baja: 'Solo se informa' };

    // Contextual recommendation based on urgency + time
    const getRecommendation = () => {
      if (isDerivacion) return null;
      if (answers.urgencia === 'alta' && (answers.tiempo === '1-3a' || answers.tiempo === '3a+')) {
        return 'Llevas tiempo con este problema y estás listo para actuar. Es el momento perfecto para un diagnóstico profesional que te dé respuestas concretas.';
      }
      if (answers.urgencia === 'alta') {
        return 'Tu disposición a actuar es clave. Un diagnóstico profesional ahora puede ahorrarte meses de tratamientos que no funcionan.';
      }
      if (answers.tiempo === '3a+') {
        return 'Llevas más de 3 años con este problema. Cuanto más tiempo pasa, menos opciones hay. Un diagnóstico a tiempo marca la diferencia.';
      }
      if (answers.tiempo === '1-3a') {
        return 'Con 1-3 años de evolución, estás a tiempo de frenar la progresión. Un diagnóstico profesional es el primer paso.';
      }
      return 'Un diagnóstico profesional es el mejor primer paso. Te permite entender exactamente qué ocurre y qué opciones tienes.';
    };

    return (
      <div className="min-h-screen bg-gradient-to-b from-[#2C3E50] via-[#2C3E50] to-white font-sans">
        <div className="h-1.5 w-full bg-[#4CA994]" />

        <div className="max-w-2xl mx-auto px-5 pt-5 pb-6">
          <div className="flex justify-center mb-5">
            <img src="/logo-hc.svg" alt="Hospital Capilar" className="h-7" style={{ filter: 'brightness(0) invert(1)' }} />
          </div>
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 bg-[#4CA994]/20 text-[#4CA994] text-xs font-bold px-3 py-1 rounded-full mb-3">
              <CheckCircle2 size={13} /> Diagnóstico completado
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-1">
              {form.nombre.split(' ')[0]}, aquí tienes tu resultado
            </h2>
            <p className="text-gray-400 text-sm">Basado en tus respuestas, este es nuestro análisis.</p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-5 -mt-2">
          {/* Summary of answers */}
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 mb-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Situación</p>
              <p className="text-white text-xs font-semibold">{situacionLabels[answers.situacion] || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Tiempo</p>
              <p className="text-white text-xs font-semibold">{tiempoLabels[answers.tiempo] || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Urgencia</p>
              <p className="text-white text-xs font-semibold">{urgenciaLabels[answers.urgencia] || '—'}</p>
            </div>
          </div>

          {/* Profile card */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-4">
            <div className="bg-gradient-to-r from-[#4CA994] to-[#3D8B7A] px-5 py-3 flex items-center gap-2.5">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Stethoscope size={16} className="text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">Tu Perfil Capilar</h3>
                <p className="text-white/70 text-xs">{situacionLabels[answers.situacion] || 'Pre-diagnóstico'}</p>
              </div>
            </div>
            <div className="p-4 space-y-2">
              <h4 className="font-bold text-gray-900">{ecpMsg.title}</h4>
              <p className="text-gray-600 text-sm leading-relaxed">{ecpMsg.body}</p>
              {getRecommendation() && (
                <div className="bg-[#F0F7F6] rounded-lg p-3 mt-2 border-l-3 border-[#4CA994]">
                  <p className="text-[#2C3E50] text-sm font-medium leading-relaxed">{getRecommendation()}</p>
                </div>
              )}
            </div>
          </div>

          {/* CTA */}
          {!isDerivacion ? (
            <div className="bg-white rounded-2xl shadow-xl border border-[#4CA994] p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#4CA994] text-white text-xs font-bold px-3 py-1 rounded-bl-lg">SIGUIENTE PASO</div>
              <h4 className="font-bold text-lg text-gray-900 mb-1 mt-2">Te contactamos en menos de 24h</h4>
              <p className="text-sm text-gray-600 mb-4">Un asesor médico revisará tu caso y te llamará para orientarte. Sin compromiso.</p>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => analytics.trackEvent('short_quiz_whatsapp_clicked', { nicho, ecp })}
                className="w-full py-3.5 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white font-bold text-base shadow-lg flex items-center justify-center gap-2 mb-3 hover:-translate-y-0.5 transition-transform"
              >
                <WhatsAppIcon size={20} className="text-white" /> Escríbenos por WhatsApp
              </a>
              <a
                href="tel:900907733"
                className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <Phone size={14} /> Llamar al 900 907 733
              </a>
            </div>
          ) : (
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
              <h4 className="font-bold text-lg text-amber-900 mb-1">Te recomendamos visitar un dermatólogo</h4>
              <p className="text-sm text-amber-800">Los problemas de cuero cabelludo requieren atención dermatológica especializada.</p>
            </div>
          )}

          <div className="flex items-center justify-center gap-6 py-6 text-gray-400 text-sm">
            <div className="flex items-center gap-2"><ShieldCheck size={16} /><span>100% confidencial</span></div>
            <div className="flex items-center gap-2"><Stethoscope size={16} /><span>Centro médico</span></div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // QUIZ PHASE (4 steps)
  // ==========================================
  if (phase === 'quiz') {
    const totalSteps = 5;
    const progress = ((step + 1) / totalSteps) * 100;

    return (
      <div className="min-h-screen bg-white font-sans flex flex-col">
        {/* Progress bar */}
        <div className="h-1.5 w-full bg-gray-100 fixed top-0 z-40">
          <div className="h-full transition-all duration-500 ease-out bg-[#4CA994]" style={{ width: `${progress}%` }} />
        </div>

        <div className="flex-1 max-w-2xl mx-auto w-full px-5 pt-8 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <button onClick={handleBack} className="text-gray-400 hover:text-gray-600 p-1.5 -ml-1.5 rounded-full hover:bg-gray-50">
              <ArrowLeft size={20} />
            </button>
            <img src="/logo-hc.svg" alt="Hospital Capilar" className="h-6" />
            <div className="w-8" />
          </div>

          {/* Step 0: Sexo */}
          {step === 0 && (
            <>
              <div className="mb-5">
                <span className="text-xs font-bold tracking-wider text-[#4CA994] uppercase mb-1.5 block">Paso 1 de {totalSteps}</span>
                <h2 className="text-xl font-bold text-gray-900 mb-1 leading-tight">¿Cuál es tu sexo biológico?</h2>
                <p className="text-gray-500 text-sm">La caída capilar tiene causas hormonales distintas en hombres y mujeres. Necesitamos saberlo para un diagnóstico preciso.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Hombre', value: 'hombre', icon: '👨' },
                  { label: 'Mujer', value: 'mujer', icon: '👩' },
                ].map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect('sexo', opt.value)}
                    className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all ${
                      answers.sexo === opt.value ? 'border-[#4CA994] bg-[#F0F7F6]' : 'border-gray-100 hover:border-[#4CA994]/50'
                    }`}
                  >
                    <span className="text-3xl">{opt.icon}</span>
                    <span className={`font-semibold text-[15px] ${answers.sexo === opt.value ? 'text-[#2C3E50]' : 'text-gray-700'}`}>
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 1: Situación */}
          {step === 1 && (
            <>
              <div className="mb-5">
                <span className="text-xs font-bold tracking-wider text-[#4CA994] uppercase mb-1.5 block">Paso 2 de {totalSteps}</span>
                <h2 className="text-xl font-bold text-gray-900 mb-1 leading-tight">¿Qué describe mejor tu situación?</h2>
              </div>
              <div className="grid gap-2">
                {[
                  { label: 'Se me cae el pelo y no sé por qué', value: 'caida-sin-diagnostico' },
                  { label: 'Noto las entradas / la coronilla', value: 'entradas-coronilla' },
                  { label: 'Soy joven y ya estoy perdiendo pelo', value: 'joven-perdida' },
                  { label: 'Pierdo pelo desde el embarazo/parto', value: 'postparto' },
                  { label: 'Creo que mi caída es hormonal', value: 'hormonal' },
                  { label: 'Ya me operé pero sigo perdiendo', value: 'post-cirugia' },
                  { label: 'Tuve mala experiencia en otra clínica', value: 'mala-experiencia' },
                  { label: 'Problemas en el cuero cabelludo', value: 'cuero-cabelludo' },
                ].map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect('situacion', opt.value)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                      answers.situacion === opt.value ? 'border-[#4CA994] bg-[#F0F7F6]' : 'border-gray-100 hover:border-[#4CA994]/50'
                    }`}
                  >
                    <span className={`flex-1 font-semibold text-[15px] ${answers.situacion === opt.value ? 'text-[#2C3E50]' : 'text-gray-700'}`}>
                      {opt.label}
                    </span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      answers.situacion === opt.value ? 'border-[#4CA994] bg-[#4CA994]' : 'border-gray-300'
                    }`}>
                      {answers.situacion === opt.value && <CheckCircle2 size={13} className="text-white" />}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 2: Tiempo */}
          {step === 2 && (
            <>
              <div className="mb-5">
                <span className="text-xs font-bold tracking-wider text-[#4CA994] uppercase mb-1.5 block">Paso 3 de {totalSteps}</span>
                <h2 className="text-xl font-bold text-gray-900 mb-1 leading-tight">¿Hace cuánto notas este problema?</h2>
              </div>
              <div className="grid gap-2">
                {[
                  { label: 'Menos de 3 meses', value: '<3m' },
                  { label: '3 - 12 meses', value: '3-12m' },
                  { label: '1 - 3 años', value: '1-3a' },
                  { label: 'Más de 3 años', value: '3a+' },
                ].map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect('tiempo', opt.value)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                      answers.tiempo === opt.value ? 'border-[#4CA994] bg-[#F0F7F6]' : 'border-gray-100 hover:border-[#4CA994]/50'
                    }`}
                  >
                    <span className={`flex-1 font-semibold text-[15px] ${answers.tiempo === opt.value ? 'text-[#2C3E50]' : 'text-gray-700'}`}>
                      {opt.label}
                    </span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      answers.tiempo === opt.value ? 'border-[#4CA994] bg-[#4CA994]' : 'border-gray-300'
                    }`}>
                      {answers.tiempo === opt.value && <CheckCircle2 size={13} className="text-white" />}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 3: Urgencia */}
          {step === 3 && (
            <>
              <div className="mb-5">
                <span className="text-xs font-bold tracking-wider text-[#4CA994] uppercase mb-1.5 block">Paso 4 de {totalSteps}</span>
                <h2 className="text-xl font-bold text-gray-900 mb-1 leading-tight">¿Cómo de urgente es para ti resolver esto?</h2>
              </div>
              <div className="grid gap-2">
                {[
                  { label: 'Quiero solución ya, estoy listo/a para actuar', value: 'alta' },
                  { label: 'Me preocupa pero quiero entender mis opciones', value: 'media' },
                  { label: 'Solo quiero informarme por ahora', value: 'baja' },
                ].map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect('urgencia', opt.value)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                      answers.urgencia === opt.value ? 'border-[#4CA994] bg-[#F0F7F6]' : 'border-gray-100 hover:border-[#4CA994]/50'
                    }`}
                  >
                    <span className={`flex-1 font-semibold text-[15px] ${answers.urgencia === opt.value ? 'text-[#2C3E50]' : 'text-gray-700'}`}>
                      {opt.label}
                    </span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      answers.urgencia === opt.value ? 'border-[#4CA994] bg-[#4CA994]' : 'border-gray-300'
                    }`}>
                      {answers.urgencia === opt.value && <CheckCircle2 size={13} className="text-white" />}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 4: Form */}
          {step === 4 && (
            <div>
              <div className="mb-5">
                <span className="text-xs font-bold tracking-wider text-[#4CA994] uppercase mb-1.5 block">Paso 5 de {totalSteps}</span>
                <h2 className="text-xl font-bold text-gray-900 mb-1 leading-tight">¡Ya casi está!</h2>
                <p className="text-gray-500 text-sm">Para preparar tu pre-diagnóstico, necesitamos tus datos:</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre completo <span className="text-red-500">*</span></label>
                  <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                    className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#4CA994] outline-none text-sm" placeholder="Ej: Carlos García" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#4CA994] outline-none text-sm" placeholder="correo@ejemplo.com" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Teléfono <span className="text-red-500">*</span></label>
                  <input type="tel" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })}
                    className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#4CA994] outline-none text-sm" placeholder="+34 612 345 678" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">¿Cerca de qué clínica te queda mejor? <span className="text-red-500">*</span></label>
                  <UbicacionSelect
                    value={form.provincia}
                    onChange={e => setForm({ ...form, provincia: e.target.value })}
                    className="w-full p-3 border-2 border-gray-200 rounded-xl bg-white focus:border-[#4CA994] outline-none text-sm font-medium"
                  />
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={!form.nombre || !form.email || !form.telefono || !form.provincia || submitting}
                  className="w-full py-3.5 rounded-xl text-white font-bold text-base shadow-lg mt-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all bg-[#4CA994] hover:-translate-y-0.5"
                >
                  {submitting ? <Loader2 size={20} className="animate-spin" /> : <>Ver mi pre-diagnóstico <ArrowRight size={18} /></>}
                </button>
                <p className="text-xs text-center text-gray-400 mt-3 px-4">
                  Acepto la política de privacidad. Tus datos están protegidos y solo se usarán para enviarte el pre-diagnóstico.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 text-center border-t border-gray-100 bg-gray-50 flex justify-center gap-6">
          <p className="text-xs text-gray-400 font-medium flex items-center gap-1"><ShieldCheck size={14} /> 100% Confidencial</p>
          <p className="text-xs text-gray-400 font-medium flex items-center gap-1"><Clock size={14} /> 1 minuto</p>
        </div>
      </div>
    );
  }

  // ==========================================
  // LANDING PHASE
  // ==========================================
  return (
    <div className="min-h-screen bg-white font-sans text-gray-800">
      <TopBar />

      {/* Hero */}
      <div className="relative bg-[#2C3E50] text-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
          <div className="flex items-center gap-3 mb-6">
            <img src="/logo-hc.svg" alt="Hospital Capilar" className="h-10" style={{ filter: 'brightness(0) invert(1)' }} />
          </div>
          <p className="text-[#4CA994] text-sm font-bold tracking-widest uppercase mb-4">{config.badge}</p>
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight mb-4 max-w-3xl">{config.headline}</h1>
          <p className="text-lg text-gray-300 max-w-2xl mb-10">{config.subheadline}</p>

          <button
            onClick={handleStartQuiz}
            className="inline-flex items-center gap-3 px-10 py-5 rounded-2xl text-white font-bold text-lg shadow-xl hover:-translate-y-1 hover:shadow-2xl transition-all bg-[#4CA994]"
          >
            Diagnóstico rápido (1 min)
            <ArrowRight size={22} />
          </button>
          <p className="text-sm text-gray-400 mt-4">5 preguntas | 100% confidencial | Sin compromiso</p>
        </div>
      </div>

      <StatsSection stats={config.stats} />
      <PainPointsSection painPoints={config.painPoints} />
      <SolutionSection solution={config.solution} />
      <TestimonialsSection testimonials={config.testimonials} />
      <FAQSection faqs={config.faqs} />

      {/* Final CTA */}
      <section className="bg-[#2C3E50] py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
            El primer paso es saber dónde estás
          </h2>
          <p className="text-lg text-gray-300 mb-8">
            Responde 4 preguntas y recibe un pre-diagnóstico personalizado en 1 minuto.
          </p>
          <button
            onClick={handleStartQuiz}
            className="inline-flex items-center gap-3 px-10 py-5 rounded-2xl text-white font-bold text-lg shadow-xl hover:-translate-y-1 hover:shadow-2xl transition-all bg-[#4CA994]"
          >
            Diagnóstico rápido (1 min)
            <ArrowRight size={22} />
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ShortQuizLanding;
