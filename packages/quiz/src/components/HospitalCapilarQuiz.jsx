import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronRight, CheckCircle2, ArrowLeft, ShieldCheck, Stethoscope,
  Sparkles, Dna, MapPin, Info, PhoneCall, Calendar, Download, FileText
} from 'lucide-react';
import { useAnalytics } from '@hospital-capilar/shared/analytics';
import { getUTMParams } from '@hospital-capilar/shared/analytics';
import { db } from '@hospital-capilar/shared/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';

// ============================================
// GENERATE AGENT MESSAGE
// ============================================
function generateAgentMessage(answers, result, labels) {
  const { ecp, score, frame } = result;
  const nombre = (answers.nombre || 'Paciente').split(' ')[0];
  const sexo = answers.sexo === 'hombre' ? 'el paciente' : 'la paciente';
  const pronombre = answers.sexo === 'hombre' ? 'El' : 'Ella';

  const problemLabel = labels.problema || answers.problema;
  const tiempoLabel = labels.tiempo || answers.tiempo;
  const probadoLabels = (answers.probado || []).map(v => labels[`probado_${v}`] || v).join(', ') || 'nada';
  const impactoLabel = labels.impacto || answers.impacto;
  const inversionLabel = labels.inversion || answers.inversion;
  const formatoLabel = labels.formato || answers.formato;
  const edadLabel = labels.edad || answers.edad;
  const ubicacionLabel = labels.ubicacion || answers.ubicacion || 'no indicada';

  let urgencia = 'media';
  if (frame === 'FRAME_A' || score >= 60) urgencia = 'ALTA';
  else if (frame === 'FRAME_D' || score < 30) urgencia = 'baja';

  let intro = '';
  if (ecp === 'ECP1') intro = `${nombre} es un hombre que lleva ${tiempoLabel} con caída capilar. Ya probó ${probadoLabels} sin resultado. No tiene diagnóstico formal.`;
  else if (ecp === 'ECP2') intro = `${nombre} es una mujer con caída probablemente hormonal. Lleva ${tiempoLabel} con el problema.`;
  else if (ecp === 'ECP3') intro = `${nombre} es un joven (${edadLabel}) que está empezando a notar caída. Tiene poco o ningún tratamiento previo.`;
  else if (ecp === 'ECP4') intro = `${nombre} tuvo mala experiencia en ${labels.clinica_previa || 'otra clínica'}. Viene con desconfianza.`;
  else if (ecp === 'ECP5') intro = `${nombre} ya se hizo un trasplante (${labels.cirugia_lugar || 'no especificado'}) y necesita mantenimiento.`;
  else if (ecp === 'ECP6') intro = `${nombre} tiene caída desde el embarazo/parto. Lleva ${tiempoLabel} con el problema.`;
  else intro = `${nombre} tiene problemas de cuero cabelludo (caspa, irritación). NO es candidato/a — derivar a dermatología.`;

  const condicionesText = answers.sexo === 'mujer' && answers.condicion?.length > 0 && !answers.condicion.includes('desconocida')
    ? `\nCondiciones: ${answers.condicion.map(v => labels[`condicion_${v}`] || v).join(', ')}.`
    : '';

  const motivacionLabel = labels.motivacion || answers.motivacion;
  const conocimientoLabel = labels.conocimiento || answers.conocimiento;

  // Source info
  const sourceInfo = labels._utm_source
    ? `${labels._utm_source}/${labels._utm_medium || ''}${labels._utm_campaign ? ` (${labels._utm_campaign})` : ''}`
    : 'Directo / Orgánico';

  const message = `--- FICHA LEAD: ${answers.nombre || 'Sin nombre'} ---

URGENCIA: ${urgencia.toUpperCase()} | Score: ${score} | Perfil: ${ecp}
ORIGEN: ${sourceInfo}

RESUMEN:
${intro}${condicionesText}

DATOS CLAVE:
- Impacto emocional: ${impactoLabel}
- Conocimiento de su alopecia: ${conocimientoLabel}
- Motivacion: ${motivacionLabel}
- Inversion dispuesta: ${inversionLabel}
- Formato preferido: ${formatoLabel}
- Ubicacion: ${ubicacionLabel}

COMO CONTACTAR:
${frame === 'FRAME_A' ? `${pronombre} quiere reservar consulta. Contactar para confirmar cita (195 euros). Es lead caliente.` : ''}${frame === 'FRAME_C' ? `${pronombre} prefiere que le llamen. Contactar por telefono, sin presion. Explicar proceso y resolver dudas antes de ofrecer cita.` : ''}${frame === 'FRAME_D' ? `${pronombre} necesita mas informacion. Enviar guia PDF y hacer seguimiento suave en 3-5 dias.` : ''}${frame === 'WAITLIST' ? `${pronombre} no esta cerca de ninguna clinica operativa. Apuntar en lista de espera y avisar cuando abramos en su zona.` : ''}${frame === 'DERIVACION' ? `NO contactar comercialmente. Enviar email educativo sobre cuero cabelludo y recomendar dermatologo.` : ''}

TIPS PARA LA LLAMADA:
${ecp === 'ECP1' ? `- Mencionar que el 40-60% no responden a minoxidil sin diagnostico. Enfatizar que el problema es la falta de diagnostico, no los productos.` : ''}${ecp === 'ECP2' ? `- Hablar de la conexion pelo-hormonas. Mencionar que nadie cruza dermatologia con endocrinologia como nosotros.` : ''}${ecp === 'ECP3' ? `- No alarmar. Enfatizar que actuar temprano = mejores resultados. Ofrecer consulta informativa.` : ''}${ecp === 'ECP4' ? `- CUIDADO: viene con desconfianza. No presionar. Ser transparente. Ofrecer toda la info antes de pedir decision.` : ''}${ecp === 'ECP5' ? `- Hablar de proteger la inversion del trasplante. El pelo nativo necesita mantenimiento.` : ''}${ecp === 'ECP6' ? `- Tranquilizar: el 50% de madres lo sufren. Pero validar que necesita diagnostico para descartar AGA subyacente.` : ''}

CONTACTO:
- Nombre: ${answers.nombre || 'N/A'}
- Email: ${answers.email || 'N/A'}
- Telefono: ${answers.telefono || 'N/A'}
---`;

  return message;
}

// ============================================
// MAIN COMPONENT
// ============================================
const HospitalCapilarQuiz = () => {
  const [stepIndex, setStepIndex] = useState(-1);
  const [answers, setAnswers] = useState({ probado: [], condicion: [] });
  const [showMicroTip, setShowMicroTip] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [finalResult, setFinalResult] = useState(null);
  const [returningLead, setReturningLead] = useState(null);
  const [utmParams] = useState(() => getUTMParams());

  // Analytics
  const analytics = useAnalytics();
  const questionStartTime = useRef(Date.now());
  const quizStartTime = useRef(null);

  const theme = { primary: '#4CA994', secondary: '#2C3E50', light: '#F0F7F6', white: '#FFFFFF' };

  // ============================================
  // RETURNING LEAD DETECTION
  // ============================================
  useEffect(() => {
    try {
      const stored = localStorage.getItem('hc_quiz_lead');
      if (stored) {
        const lead = JSON.parse(stored);
        if (lead.nombre && lead.ecp) {
          setReturningLead(lead);
        }
      }
    } catch {}
  }, []);

  // ============================================
  // QUESTIONS
  // ============================================
  const questions = [
    // BLOQUE 1: IDENTIFICACION
    {
      id: 'sexo', block: 1,
      title: 'Empecemos. ¿Cuál es tu sexo?',
      type: 'single',
      options: [
        { label: 'Hombre', value: 'hombre', icon: '👨' },
        { label: 'Mujer', value: 'mujer', icon: '👩' }
      ]
    },
    {
      id: 'edad', block: 1,
      title: '¿En qué rango de edad estás?',
      type: 'single',
      options: [
        { label: '18 - 25 años', value: '18-25' },
        { label: '26 - 35 años', value: '26-35' },
        { label: '36 - 45 años', value: '36-45' },
        { label: '46 - 55 años', value: '46-55' },
        { label: 'Más de 55 años', value: '56+' }
      ]
    },
    {
      id: 'problema', block: 1,
      title: '¿Cuál es tu principal preocupación con tu pelo?',
      type: 'single',
      optionsFn: (ans) => ans.sexo === 'hombre' ? [
        { label: 'Se me cae el pelo / pierdo densidad', value: 'caida-densidad' },
        { label: 'Las entradas retroceden', value: 'entradas' },
        { label: 'Me operé y el pelo sigue cayendo', value: 'post-cirugia' },
        { label: 'Tuve mala experiencia en otra clínica', value: 'mala-experiencia' },
        { label: 'Problemas en el cuero cabelludo (caspa, granos, irritación)', value: 'cuero-cabelludo' }
      ] : [
        { label: 'Noto que pierdo densidad / se me ve el cuero cabelludo', value: 'densidad-mujer' },
        { label: 'Se me cae desde el embarazo / parto', value: 'postparto' },
        { label: 'Creo que es hormonal (tiroides, ovarios, menopausia, píldora)', value: 'hormonal' },
        { label: 'Se me cae mucho más de lo normal (estrés, cambio de estación)', value: 'caida-general' },
        { label: 'Problemas en el cuero cabelludo (caspa, granos, irritación)', value: 'cuero-cabelludo' }
      ]
    },
    {
      id: 'tiempo', block: 1,
      title: '¿Hace cuánto notas este problema?',
      type: 'single',
      options: [
        { label: 'Menos de 3 meses', value: '<3m' },
        { label: '3 - 12 meses', value: '3-12m' },
        { label: '1 - 3 años', value: '1-3a' },
        { label: 'Más de 3 años', value: '3a+' }
      ]
    },
    {
      id: 'probado', block: 1,
      title: '¿Qué has probado hasta ahora para frenar la caída?',
      subtitle: 'Puedes marcar varias opciones.',
      type: 'multiple',
      options: [
        { label: 'Nada todavía', value: 'nada', exclusive: true },
        { label: 'Champú anticaída / suplementos (Pilexil, biotina, Olistic...)', value: 'otc' },
        { label: 'Minoxidil', value: 'minoxidil' },
        { label: 'Finasteride / Dutasteride', value: 'finasteride' },
        { label: 'Tratamientos en clínica (PRP, mesoterapia, láser...)', value: 'clinica' },
        { label: 'Trasplante capilar', value: 'trasplante' },
        { label: 'Otro tratamiento médico', value: 'otro' }
      ]
    },
    // CONDICIONALES BLOQUE 1
    {
      id: 'condicion', block: 1,
      title: '¿Tienes alguna de estas condiciones?',
      subtitle: 'Puedes marcar varias.',
      dependsOn: (ans) => ans.sexo === 'mujer' && ['hormonal', 'densidad-mujer', 'caida-general'].includes(ans.problema),
      type: 'multiple',
      options: [
        { label: 'Ovarios poliquísticos (SOP/PCOS)', value: 'pcos' },
        { label: 'Problemas de tiroides', value: 'tiroides' },
        { label: 'Menopausia o perimenopausia', value: 'menopausia' },
        { label: 'Dejé anticonceptivos recientemente', value: 'post-aco' },
        { label: 'Anemia o déficit de hierro', value: 'anemia' },
        { label: 'Ninguna de estas / No lo sé', value: 'desconocida', exclusive: true }
      ]
    },
    {
      id: 'cirugia_lugar', block: 1,
      title: '¿Dónde te operaste?',
      dependsOn: (ans) => ans.problema === 'post-cirugia',
      type: 'single',
      options: [
        { label: 'En Hospital Capilar', value: 'hc' },
        { label: 'En otra clínica en España', value: 'españa' },
        { label: 'En Turquía', value: 'turquia' },
        { label: 'En otro país', value: 'otro' }
      ]
    },
    {
      id: 'clinica_previa', block: 1,
      title: '¿En qué clínica fue?',
      dependsOn: (ans) => ans.problema === 'mala-experiencia',
      type: 'single',
      options: [
        { label: 'Insparya', value: 'insparya' },
        { label: 'Svenson', value: 'svenson' },
        { label: 'Medical Hair', value: 'medicalhair' },
        { label: 'IMD (Instituto Médico Dermatológico)', value: 'imd' },
        { label: 'Dorsia', value: 'dorsia' },
        { label: 'Otra', value: 'otra' }
      ]
    },
    // BLOQUE 2: PROFUNDIDAD + EDUCACION
    {
      id: 'impacto', block: 2,
      title: '¿Cuánto te afecta este problema en tu día a día?',
      type: 'single',
      microTip: 'La pérdida de pelo afecta a la autoestima del 75% de las personas que la sufren. No estás solo/a.',
      options: [
        { label: 'Poco — me preocupa pero no me limita', value: 'bajo' },
        { label: 'Bastante — evito ciertas situaciones o peinados', value: 'medio' },
        { label: 'Mucho — afecta mi autoestima y mi vida social', value: 'alto' },
        { label: 'Es lo que más me preocupa de mi salud ahora mismo', value: 'critico' }
      ]
    },
    {
      id: 'conocimiento', block: 2,
      title: '¿Sabes qué tipo de alopecia tienes?',
      type: 'single',
      microTip: 'Existen más de 20 tipos de alopecia con tratamientos distintos. Sin un diagnóstico preciso, cualquier tratamiento es una apuesta.',
      options: [
        { label: 'Sí, me lo diagnosticó un médico', value: 'diagnosticado' },
        { label: 'Creo saberlo pero no tengo diagnóstico formal', value: 'sospecha' },
        { label: 'No tengo ni idea', value: 'ninguno' }
      ]
    },
    {
      id: 'motivacion', block: 2,
      title: '¿Qué necesitarías para dar el siguiente paso?',
      type: 'single',
      microTip: 'En Hospital Capilar, la primera consulta incluye tricoscopía + analítica hormonal + 30 minutos con tu médico. Un diagnóstico real, no una consulta comercial.',
      options: [
        { label: 'Saber exactamente qué tengo y qué opciones hay', value: 'diagnostico' },
        { label: 'Ver resultados de personas como yo', value: 'prueba-social' },
        { label: 'Que un médico me explique mi caso sin presión', value: 'confianza' },
        { label: 'Que el precio sea razonable', value: 'precio' }
      ]
    },
    {
      id: 'efectos', block: 2,
      title: '¿Te preocupan los efectos secundarios de los tratamientos capilares?',
      dependsOn: (ans) => ans.sexo === 'hombre' || (ans.probado || []).includes('minoxidil') || (ans.probado || []).includes('finasteride'),
      type: 'single',
      microTip: 'Los efectos secundarios de tipo sexual del finasteride oral se dan en un porcentaje mínimo de pacientes y son reversibles. Además, existen alternativas sin esos efectos. Un médico especialista te puede explicar todas las opciones.',
      options: [
        { label: 'Sí, mucho — es lo que me frena', value: 'preocupado' },
        { label: 'Algo, pero estoy dispuesto/a si hay supervisión médica', value: 'moderado' },
        { label: 'No especialmente', value: 'no-preocupado' }
      ]
    },
    {
      id: 'profesional', block: 2,
      title: '¿Has visitado algún profesional por este tema?',
      dependsOn: (ans) => !(ans.sexo === 'hombre' || (ans.probado || []).includes('minoxidil') || (ans.probado || []).includes('finasteride')),
      type: 'single',
      microTip: 'El 80% de las personas que consultan por caída de pelo reciben una receta genérica de minoxidil en menos de 5 minutos. Un diagnóstico integral lleva 30 minutos porque hay mucho más que mirar.',
      options: [
        { label: 'No, es la primera vez que busco ayuda profesional', value: 'nunca' },
        { label: 'Sí, un dermatólogo general', value: 'dermatologo' },
        { label: 'Sí, otra clínica capilar', value: 'clinica' },
        { label: 'Sí, mi médico de cabecera', value: 'cabecera' }
      ]
    },
    // BLOQUE 3: DISPOSICION
    {
      id: 'expectativa', block: 3,
      title: '¿Qué resultado esperas conseguir?',
      type: 'single',
      options: [
        { label: 'Frenar la caída — que no vaya a más', value: 'frenar' },
        { label: 'Recuperar densidad sin cirugía', value: 'densidad' },
        { label: 'Saber si necesito cirugía o tratamiento', value: 'diagnostico' },
        { label: 'Mantener los resultados de mi cirugía', value: 'mantenimiento' }
      ]
    },
    {
      id: 'inversion', block: 3,
      title: '¿Cuánto estarías dispuesto/a a invertir al mes en el cuidado de tu pelo si vieras resultados?',
      type: 'single',
      microTip: 'La mayoría de personas que buscan solución para su caída han gastado entre 200€ y 1.000€ en productos sin diagnóstico previo. Un diagnóstico correcto es lo primero — todo lo demás viene después.',
      options: [
        { label: 'Menos de 50€/mes', value: '<50' },
        { label: '50€ - 150€/mes', value: '50-150' },
        { label: '150€ - 300€/mes', value: '150-300' },
        { label: 'Lo que sea necesario si funciona', value: 'abierto' }
      ]
    },
    {
      id: 'formato', block: 3,
      title: '¿Cómo te gustaría dar el siguiente paso?',
      type: 'single',
      options: [
        { label: 'Quiero reservar una consulta presencial', value: 'presencial' },
        { label: 'Prefiero que me llamen para explicarme', value: 'llamada' },
        { label: 'Quiero empezar ya — si hay un plan, lo quiero', value: 'directo' },
        { label: 'Necesito más información antes de decidir', value: 'info' }
      ]
    },
    // BLOQUE 4: CAPTURA
    {
      id: 'captura', block: 4,
      title: '¡Ya casi está!',
      subtitle: 'Para preparar tu diagnóstico personalizado, necesitamos tus datos:',
      type: 'form',
      options: []
    }
  ];

  const activeQuestions = questions.filter(q => !q.dependsOn || q.dependsOn(answers));
  const currentQ = activeQuestions[stepIndex >= 0 ? stepIndex : 0];

  // ============================================
  // LABEL HELPERS (for agent message + display)
  // ============================================
  const getLabel = (qId, value) => {
    const q = questions.find(q => q.id === qId);
    if (!q) return value;
    const opts = q.optionsFn ? q.optionsFn(answers) : q.options;
    const opt = opts?.find(o => o.value === value);
    return opt ? opt.label : value;
  };

  const buildAllLabels = useCallback((ans) => {
    const labels = {};
    for (const q of questions) {
      const val = ans[q.id];
      if (val === undefined || val === null) continue;
      const opts = q.optionsFn ? q.optionsFn(ans) : q.options;
      if (Array.isArray(val)) {
        val.forEach(v => {
          const opt = opts?.find(o => o.value === v);
          labels[`${q.id}_${v}`] = opt ? opt.label : v;
        });
      } else {
        const opt = opts?.find(o => o.value === val);
        labels[q.id] = opt ? opt.label : val;
      }
    }
    // Add location label
    const ubicacionMap = {
      madrid: 'Madrid', murcia: 'Murcia', pontevedra: 'Pontevedra',
      acoruna: 'A Coruña', mostoles: 'Mostoles', albacete: 'Albacete',
      valladolid: 'Valladolid', burgos: 'Burgos', valencia: 'Valencia', otra: 'Otra ciudad'
    };
    if (ans.ubicacion) labels.ubicacion = ubicacionMap[ans.ubicacion] || ans.ubicacion;
    return labels;
  }, []);

  // Build readable answers object for storage
  const buildReadableAnswers = useCallback((ans) => {
    const labels = buildAllLabels(ans);
    const readable = {};
    for (const q of questions) {
      const val = ans[q.id];
      if (val === undefined || val === null || q.type === 'form') continue;
      if (Array.isArray(val)) {
        readable[q.id] = {
          question: q.title,
          values: val,
          labels: val.map(v => labels[`${q.id}_${v}`] || v),
        };
      } else {
        readable[q.id] = {
          question: q.title,
          value: val,
          label: labels[q.id] || val,
        };
      }
    }
    return readable;
  }, [buildAllLabels]);

  // ============================================
  // SCORING ENGINE
  // ============================================
  const processResults = (finalAnswers) => {
    let ecp = 'ECP1';
    let score = 0;

    if (finalAnswers.problema === 'cuero-cabelludo') ecp = 'DERIVACION';
    else if (finalAnswers.problema === 'post-cirugia' || (finalAnswers.probado || []).includes('trasplante')) ecp = 'ECP5';
    else if (finalAnswers.problema === 'mala-experiencia') ecp = 'ECP4';
    else if (finalAnswers.sexo === 'mujer' && finalAnswers.problema === 'postparto') ecp = 'ECP6';
    else if (finalAnswers.sexo === 'mujer' && ['hormonal', 'densidad-mujer', 'caida-general'].includes(finalAnswers.problema)) ecp = 'ECP2';
    else if (finalAnswers.sexo === 'hombre' && finalAnswers.edad === '18-25' && ((finalAnswers.probado || []).includes('nada') || (finalAnswers.probado || []).includes('otc'))) ecp = 'ECP3';

    if (finalAnswers.tiempo === '3a+') score += 30;
    else if (finalAnswers.tiempo === '1-3a') score += 20;
    else if (finalAnswers.tiempo === '<3m' && (finalAnswers.probado || []).includes('nada')) score -= 15;

    if ((finalAnswers.probado || []).includes('minoxidil') || (finalAnswers.probado || []).includes('finasteride')) score += 15;
    if ((finalAnswers.probado || []).includes('clinica')) score += 20;
    if ((finalAnswers.probado || []).includes('trasplante')) score += 25;
    if (finalAnswers.sexo === 'mujer' && finalAnswers.condicion?.length > 0 && !finalAnswers.condicion.includes('desconocida')) score += 15;
    if (['26-35', '36-45'].includes(finalAnswers.edad)) score += 10;

    const ubi = finalAnswers.ubicacion || '';
    if (['madrid', 'murcia', 'pontevedra'].includes(ubi)) score += 15;
    else if (['acoruna', 'mostoles', 'albacete', 'valladolid', 'burgos', 'valencia'].includes(ubi)) score += 5;
    else score -= 20;

    if (['alto', 'critico'].includes(finalAnswers.impacto)) score += 15;
    if (finalAnswers.conocimiento === 'sospecha' || finalAnswers.conocimiento === 'ninguno') score += 10;
    if (finalAnswers.motivacion === 'diagnostico') score += 10;
    if (finalAnswers.efectos === 'moderado') score += 5;
    if (['50-150', '150-300'].includes(finalAnswers.inversion)) score += 10;
    if (finalAnswers.inversion === 'abierto') score += 20;
    if (finalAnswers.formato === 'presencial') score += 15;
    if (finalAnswers.formato === 'directo') score += 25;
    if (finalAnswers.formato === 'info') score -= 10;

    let frame = '';
    if (ecp === 'DERIVACION') frame = 'DERIVACION';
    else if (!['madrid', 'murcia', 'pontevedra'].includes(ubi) && ubi !== '') frame = 'WAITLIST';
    else if (finalAnswers.formato === 'llamada' || ecp === 'ECP4') frame = 'FRAME_C';
    else if (finalAnswers.formato === 'info' || score < 40) frame = 'FRAME_D';
    else frame = 'FRAME_A';

    const result = { ecp, score, frame, nombre: finalAnswers.nombre || 'Paciente' };
    setFinalResult(result);

    // Generate labels and agent message
    const labels = {
      ...buildAllLabels(finalAnswers),
      _utm_source: utmParams.utm_source || null,
      _utm_medium: utmParams.utm_medium || null,
      _utm_campaign: utmParams.utm_campaign || null,
    };
    const agentMessage = generateAgentMessage(finalAnswers, result, labels);
    const readableAnswers = buildReadableAnswers(finalAnswers);

    // Save lead
    saveLead(finalAnswers, result, readableAnswers, agentMessage);

    // Send to GHL
    sendToGoHighLevel(finalAnswers, result, agentMessage);

    // Track completion
    const totalTime = quizStartTime.current ? Date.now() - quizStartTime.current : 0;
    analytics.trackQuizCompleted(finalAnswers);
    analytics.trackEvent('quiz_result', {
      ecp: result.ecp,
      score: result.score,
      frame: result.frame,
      total_time_ms: totalTime,
    });
  };

  // ============================================
  // SAVE LEAD TO FIRESTORE
  // ============================================
  const saveLead = async (data, result, readableAnswers, agentMessage) => {
    try {
      const totalTime = quizStartTime.current ? Math.round((Date.now() - quizStartTime.current) / 1000) : 0;

      // Determine source channel from UTMs
      const sourceChannel = utmParams.utm_source
        ? `${utmParams.utm_source}/${utmParams.utm_medium || 'unknown'}`
        : document.referrer ? 'organic/referral' : 'direct';

      const leadDoc = {
        // Contact info
        nombre: data.nombre || '',
        email: data.email || '',
        telefono: data.telefono || '',
        ubicacion: data.ubicacion || '',

        // Classification
        ecp: result.ecp,
        score: result.score,
        frame: result.frame,

        // All answers (raw + readable)
        answersRaw: { ...data },
        answersReadable: readableAnswers,

        // Agent message
        agentMessage,

        // Behavior
        behavior: {
          totalTimeSeconds: totalTime,
          totalQuestions: activeQuestions.length,
          sessionId: analytics.sessionId || null,
        },

        // Attribution / UTMs
        source: {
          channel: sourceChannel,
          utm_source: utmParams.utm_source || null,
          utm_medium: utmParams.utm_medium || null,
          utm_campaign: utmParams.utm_campaign || null,
          utm_content: utmParams.utm_content || null,
          utm_term: utmParams.utm_term || null,
          referrer: document.referrer || 'direct',
          landing_url: window.location.href,
        },

        // Metadata
        status: 'new',
        createdAt: serverTimestamp(),
      };

      // Remove form fields from answersRaw
      delete leadDoc.answersRaw.nombre;
      delete leadDoc.answersRaw.email;
      delete leadDoc.answersRaw.telefono;

      const leadsRef = collection(db, 'quiz_leads');
      await addDoc(leadsRef, leadDoc);

      // Save to localStorage for returning lead detection
      localStorage.setItem('hc_quiz_lead', JSON.stringify({
        nombre: data.nombre,
        email: data.email,
        ecp: result.ecp,
        frame: result.frame,
        score: result.score,
        completedAt: new Date().toISOString(),
      }));

    } catch (err) {
      console.error('Firestore save error:', err);
    }
  };

  // ============================================
  // GHL SYNC
  // ============================================
  const sendToGoHighLevel = async (data, result, agentMessage) => {
    const apiKey = import.meta.env.VITE_GHL_API_KEY;
    const locationId = import.meta.env.VITE_GHL_LOCATION_ID;
    if (!apiKey || !locationId) return;

    const nameParts = (data.nombre || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Build source tag from UTMs
    const sourceTag = utmParams.utm_source
      ? `src-${utmParams.utm_source}`
      : 'src-direct';
    const campaignTag = utmParams.utm_campaign
      ? `camp-${utmParams.utm_campaign}`
      : null;

    try {
      await fetch('https://services.leadconnectorhq.com/contacts/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28',
        },
        body: JSON.stringify({
          locationId,
          firstName,
          lastName,
          email: data.email || '',
          phone: data.telefono || '',
          tags: [result.ecp, result.frame, `score-${result.score}`, sourceTag, campaignTag].filter(Boolean),
          source: utmParams.utm_source
            ? `Quiz HC — ${utmParams.utm_source}/${utmParams.utm_medium || ''}`
            : 'Quiz Hospital Capilar',
          customFields: [
            { key: 'ecp', field_value: result.ecp },
            { key: 'lead_score', field_value: String(result.score) },
            { key: 'frame', field_value: result.frame },
            { key: 'ubicacion', field_value: data.ubicacion || '' },
            { key: 'sexo', field_value: data.sexo || '' },
            { key: 'edad', field_value: data.edad || '' },
            { key: 'problema', field_value: data.problema || '' },
            { key: 'tiempo', field_value: data.tiempo || '' },
            { key: 'probado', field_value: (data.probado || []).join(', ') },
            { key: 'impacto', field_value: data.impacto || '' },
            { key: 'conocimiento', field_value: data.conocimiento || '' },
            { key: 'motivacion', field_value: data.motivacion || '' },
            { key: 'efectos', field_value: data.efectos || '' },
            { key: 'profesional', field_value: data.profesional || '' },
            { key: 'expectativa', field_value: data.expectativa || '' },
            { key: 'inversion', field_value: data.inversion || '' },
            { key: 'formato', field_value: data.formato || '' },
            { key: 'condicion', field_value: (data.condicion || []).join(', ') },
            { key: 'cirugia_lugar', field_value: data.cirugia_lugar || '' },
            { key: 'clinica_previa', field_value: data.clinica_previa || '' },
            { key: 'utm_source', field_value: utmParams.utm_source || '' },
            { key: 'utm_medium', field_value: utmParams.utm_medium || '' },
            { key: 'utm_campaign', field_value: utmParams.utm_campaign || '' },
            { key: 'utm_content', field_value: utmParams.utm_content || '' },
            { key: 'utm_term', field_value: utmParams.utm_term || '' },
          ],
          notes: agentMessage,
        }),
      });
    } catch (err) {
      console.error('GHL sync error:', err);
    }
  };

  // ============================================
  // NAVIGATION HANDLERS
  // ============================================
  const handleNext = () => {
    if (currentQ.microTip && !showMicroTip) {
      setShowMicroTip(true);
      return;
    }
    setShowMicroTip(false);
    if (stepIndex < activeQuestions.length - 1) {
      setStepIndex(prev => prev + 1);
      questionStartTime.current = Date.now();
    } else {
      startAnalysis();
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setShowMicroTip(false);
      analytics.trackBackButtonClicked(currentQ.id, activeQuestions[stepIndex - 1]?.id);
      setStepIndex(prev => prev - 1);
      questionStartTime.current = Date.now();
    } else if (stepIndex === 0) {
      setStepIndex(-1);
    }
  };

  const handleAnswer = (value) => {
    const timeSpent = Date.now() - questionStartTime.current;

    if (currentQ.type === 'single') {
      const newAnswers = { ...answers, [currentQ.id]: value };
      setAnswers(newAnswers);

      // Track answer
      analytics.trackQuestionAnswered(currentQ.id, stepIndex, value);
      analytics.trackEvent('question_time', {
        question_id: currentQ.id,
        time_spent_ms: timeSpent,
      });

      setTimeout(() => {
        setShowMicroTip(false);
        questionStartTime.current = Date.now();
        if (stepIndex < activeQuestions.length - 1) {
          setStepIndex(prev => prev + 1);
        } else {
          startAnalysis();
        }
      }, 350);
    } else if (currentQ.type === 'multiple') {
      let currentArr = answers[currentQ.id] || [];
      const option = currentQ.options.find(o => o.value === value);
      if (option.exclusive) {
        currentArr = [value];
      } else {
        currentArr = currentArr.filter(v => {
          const opt = currentQ.options.find(o => o.value === v);
          return !opt?.exclusive;
        });
        if (currentArr.includes(value)) {
          currentArr = currentArr.filter(v => v !== value);
        } else {
          currentArr = [...currentArr, value];
        }
      }
      setAnswers({ ...answers, [currentQ.id]: currentArr });
    }
  };

  const handleMultipleNext = () => {
    const timeSpent = Date.now() - questionStartTime.current;
    analytics.trackQuestionAnswered(currentQ.id, stepIndex, answers[currentQ.id]);
    analytics.trackEvent('question_time', {
      question_id: currentQ.id,
      time_spent_ms: timeSpent,
    });
    handleNext();
  };

  const startAnalysis = () => {
    processResults(answers);
    setIsAnalyzing(true);
    analytics.trackEvent('analysis_started', { answers_count: Object.keys(answers).length });
    let progress = 0;
    const interval = setInterval(() => {
      progress += 2;
      setAnalysisProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setIsAnalyzing(false);
        setStepIndex(activeQuestions.length);
      }
    }, 40);
  };

  // ============================================
  // TRACK QUESTION VIEWS
  // ============================================
  useEffect(() => {
    if (stepIndex >= 0 && stepIndex < activeQuestions.length) {
      const q = activeQuestions[stepIndex];
      analytics.trackEvent('question_viewed', {
        question_id: q.id,
        question_index: stepIndex,
        total_questions: activeQuestions.length,
        block: q.block,
      });
      questionStartTime.current = Date.now();
    }
  }, [stepIndex]);

  // ============================================
  // TRACK CTA CLICKS
  // ============================================
  const handleCTAClick = (ctaType) => {
    analytics.trackEvent('cta_clicked', {
      cta_type: ctaType,
      frame: finalResult?.frame,
      ecp: finalResult?.ecp,
      score: finalResult?.score,
    });
  };

  // ============================================
  // RETURNING LEAD SCREEN
  // ============================================
  if (returningLead && stepIndex === -1) {
    return (
      <div className="min-h-screen bg-white font-sans text-gray-800 flex flex-col items-center justify-center p-6 relative">
        <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: theme.primary }}></div>
        <div className="font-bold text-2xl tracking-tight text-gray-800 flex items-center gap-2 mb-12">
          <div className="w-8 h-8 rounded-full" style={{ backgroundColor: theme.primary }}></div>
          HOSPITAL<span style={{ color: theme.primary }}>CAPILAR</span>
        </div>
        <div className="max-w-xl text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4 leading-tight">
            ¡Hola de nuevo, {returningLead.nombre.split(' ')[0]}!
          </h1>
          <p className="text-lg text-gray-500 mb-8 leading-relaxed">
            Ya completaste tu diagnóstico capilar. ¿Qué te gustaría hacer?
          </p>
          <div className="space-y-3">
            <button
              onClick={() => { setReturningLead(null); analytics.trackEvent('returning_lead_action', { action: 'retake' }); }}
              className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg hover:-translate-y-1 transition-transform"
              style={{ backgroundColor: theme.primary }}
            >
              Repetir el diagnóstico
            </button>
            <button
              onClick={() => { handleCTAClick('returning_contact'); }}
              className="w-full py-4 rounded-xl border-2 border-gray-200 text-gray-700 font-bold text-lg hover:bg-gray-50 transition-colors"
            >
              Quiero que me contacten
            </button>
          </div>
        </div>
      </div>
    );
  }

  // PANTALLA INTRO
  if (stepIndex === -1) {
    return (
      <div className="min-h-screen bg-white font-sans text-gray-800 flex flex-col items-center justify-center p-6 relative">
        <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: theme.primary }}></div>
        <div className="font-bold text-2xl tracking-tight text-gray-800 flex items-center gap-2 mb-12">
          <div className="w-8 h-8 rounded-full" style={{ backgroundColor: theme.primary }}></div>
          HOSPITAL<span style={{ color: theme.primary }}>CAPILAR</span>
        </div>
        <div className="max-w-xl text-center">
          <div className="bg-[#E6F0F0] text-[#2E4C4C] px-4 py-1.5 rounded-full text-sm font-bold mb-6 inline-flex items-center gap-2">
            <Stethoscope size={16} /> Experiencia Diagnóstica Online
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6 leading-tight">
            Descubre si tu caso es <br/>
            <span style={{ color: theme.primary }}>tratable o quirúrgico</span>
          </h1>
          <p className="text-lg text-gray-500 mb-10 leading-relaxed">
            Responde a este diagnóstico interactivo (3-4 min). Nuestro sistema evaluará tu nivel de caída y definirá un pre-diagnóstico preciso.
          </p>
          <button
            onClick={() => {
              setStepIndex(0);
              quizStartTime.current = Date.now();
              questionStartTime.current = Date.now();
              analytics.trackQuizStarted();
            }}
            className="w-full md:w-auto px-12 py-4 rounded-xl text-white font-bold text-lg shadow-lg hover:-translate-y-1 transition-transform"
            style={{ backgroundColor: theme.primary }}
          >
            Iniciar Pre-Diagnóstico
          </button>
        </div>
      </div>
    );
  }

  // PANTALLA ANALISIS
  if (isAnalyzing) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="relative w-24 h-24 mb-8">
          <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: theme.primary }}></div>
          <Dna className="absolute inset-0 m-auto text-gray-400" size={32} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Evaluando tu caso...</h2>
        <div className="w-full max-w-xs bg-gray-200 rounded-full h-2 mb-4">
          <div className="h-full rounded-full transition-all duration-75" style={{ width: `${analysisProgress}%`, backgroundColor: theme.primary }}></div>
        </div>
        <p className="text-sm text-gray-500 font-mono">Calculando Score Médico...</p>
      </div>
    );
  }

  // PANTALLA RESULTADOS
  if (finalResult && stepIndex === activeQuestions.length) {
    const { ecp, frame, nombre } = finalResult;
    const isDerivacion = frame === 'DERIVACION';
    const strTiempo = getLabel('tiempo', answers.tiempo);
    const arrProbado = (answers.probado || []).map(v => getLabel('probado', v)).join(', ') || 'tratamientos';
    const strClinica = getLabel('clinica_previa', answers.clinica_previa) || 'otra clínica';
    const strCirugiaLugar = getLabel('cirugia_lugar', answers.cirugia_lugar) || 'otra clínica';

    return (
      <div className="min-h-screen bg-white font-sans">
        <div className="h-1.5 w-full" style={{ backgroundColor: theme.primary }}></div>
        <div className="max-w-2xl mx-auto p-6 pt-12">
          <button
            onClick={() => { setStepIndex(activeQuestions.length - 1); setFinalResult(null); }}
            className="flex items-center gap-2 text-gray-400 hover:text-gray-600 mb-8 p-2 -ml-2 rounded-full hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Gracias por tus respuestas, {nombre.split(' ')[0]}.</h2>

          <div className="prose prose-emerald max-w-none mb-10 bg-gray-50 p-6 rounded-2xl border border-gray-100">
            <h3 className="text-lg font-bold text-[#4CA994] mb-3 uppercase tracking-wide text-sm">Tu Perfil Capilar</h3>

            {ecp === 'ECP1' && (
              <>
                <p className="text-gray-700 leading-relaxed mb-4">Llevas <strong>{strTiempo.toLowerCase()}</strong> tratando tu caída capilar con {arrProbado.toLowerCase()} sin los resultados que esperabas.</p>
                <p className="text-gray-700 leading-relaxed mb-4">Esto es más común de lo que piensas — el 40-60% de personas no responden a minoxidil. Y en muchos casos, el problema no es el producto sino que <strong>nunca se diagnosticó correctamente la causa de tu caída</strong>. Sin una tricoscopía y analítica hormonal, cualquier tratamiento es una apuesta.</p>
                <p className="text-gray-700 leading-relaxed font-medium"><strong>Te recomendamos:</strong> Un diagnóstico integral presencial donde nuestro equipo médico evalúa tu caso con microscopio capilar + analítica completa + valoración médica personalizada. En 30 minutos sabrás exactamente qué tienes y qué opciones reales hay.</p>
              </>
            )}
            {ecp === 'ECP2' && (
              <>
                <p className="text-gray-700 leading-relaxed mb-4">Tu caída de pelo está probablemente conectada a un <strong>desbalance hormonal</strong> que nadie ha evaluado en relación con tu pelo.</p>
                <p className="text-gray-700 leading-relaxed mb-4">La caída femenina por causa hormonal es una de las menos diagnosticadas correctamente. Los dermatólogos tratan el pelo, los ginecólogos tratan las hormonas — pero nadie cruza ambas cosas.</p>
                <p className="text-gray-700 leading-relaxed font-medium"><strong>Te recomendamos:</strong> Una consulta diagnóstica que incluye analítica hormonal completa cruzada con un estudio capilar con microscopio. Es la pieza que falta entre tu pelo y tu salud.</p>
              </>
            )}
            {ecp === 'ECP3' && (
              <>
                <p className="text-gray-700 leading-relaxed mb-4">Estás empezando a notar señales de caída y quieres saber si es momento de actuar o de esperar.</p>
                <p className="text-gray-700 leading-relaxed mb-4">Buena noticia: <strong>actuar temprano es la mejor decisión que puedes tomar</strong> con la alopecia. Cuanto antes se diagnostica, más opciones tienes y mejores resultados se consiguen. Mala noticia: la caída capilar NO se frena sola. Si llevas {strTiempo.toLowerCase()} notándolo, es probable que progrese.</p>
                <p className="text-gray-700 leading-relaxed font-medium"><strong>Te recomendamos:</strong> Hablar con nuestro equipo para entender tu caso concreto. Nada de presión — solo que sepas dónde estás y qué opciones existen a tu edad.</p>
              </>
            )}
            {ecp === 'ECP4' && (
              <>
                <p className="text-gray-700 leading-relaxed mb-4">Ya pasaste por una experiencia negativa en <strong>{strClinica}</strong> y entendemos que tengas dudas.</p>
                <p className="text-gray-700 leading-relaxed mb-4">Lo primero: lo sentimos. Sabemos que hay clínicas que prometen mucho y entregan poco. No es lo que hacemos. Hospital Capilar es un centro médico especializado — no un centro estético. Aquí no hay "consultas gratuitas" que son ventas disfrazadas. Hay médicos que te diagnostican con datos y te dicen la verdad, te guste o no.</p>
                <p className="text-gray-700 leading-relaxed font-medium"><strong>Te recomendamos:</strong> Que hables con nosotros sin compromiso. Preferimos que nos preguntes todo lo que necesites antes de tomar cualquier decisión.</p>
              </>
            )}
            {ecp === 'ECP5' && (
              <>
                <p className="text-gray-700 leading-relaxed mb-4">Te realizaste un trasplante capilar ({strCirugiaLugar}) y necesitas un plan para proteger tu inversión.</p>
                <p className="text-gray-700 leading-relaxed mb-4">Un trasplante capilar sin plan de mantenimiento pierde resultados con el tiempo. El pelo trasplantado no se cae, pero <strong>el pelo nativo sigue sometido a los mismos factores</strong> que causaron la caída original.</p>
                <p className="text-gray-700 leading-relaxed font-medium"><strong>Te recomendamos:</strong> Un diagnóstico para evaluar el estado actual de tu pelo nativo y diseñar un plan de mantenimiento personalizado que proteja los resultados de tu cirugía.</p>
              </>
            )}
            {ecp === 'ECP6' && (
              <>
                <p className="text-gray-700 leading-relaxed mb-4">Estás perdiendo pelo desde tu embarazo o parto y necesitas saber si es temporal o algo más.</p>
                <p className="text-gray-700 leading-relaxed mb-4">El efluvio postparto afecta al 50% de madres y en la mayoría de casos es temporal. Pero en algunas mujeres, <strong>el embarazo revela una alopecia subyacente (AGA)</strong> que estaba oculta y necesita tratamiento.</p>
                <p className="text-gray-700 leading-relaxed font-medium"><strong>Te recomendamos:</strong> Un diagnóstico que cruce tu perfil hormonal con tu estudio capilar. Si es efluvio temporal, te lo decimos y te ahorras preocupaciones. Si es algo más, actuamos a tiempo.</p>
              </>
            )}
            {isDerivacion && (
              <>
                <p className="text-gray-700 leading-relaxed mb-4">Lo que describes parece un <strong>problema dermatológico del cuero cabelludo</strong> más que una caída capilar.</p>
                <p className="text-gray-700 leading-relaxed mb-4">Problemas como la dermatitis seborreica, la caspa severa o las inflamaciones del cuero cabelludo requieren un enfoque dermatológico específico que no es nuestra especialidad.</p>
                <p className="text-gray-700 leading-relaxed font-medium"><strong>Te recomendamos:</strong> Visitar un dermatólogo que pueda evaluar tu cuero cabelludo directamente.</p>
              </>
            )}
          </div>

          <div className="bg-white">
            {frame === 'FRAME_A' && (
              <div className="border border-[#4CA994] rounded-2xl p-6 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-[#4CA994] text-white text-xs font-bold px-3 py-1 rounded-bl-lg">PASO RECOMENDADO</div>
                <h4 className="font-bold text-xl text-gray-900 mb-2 mt-2">Reserva tu diagnóstico presencial</h4>
                <p className="text-gray-600 mb-6">El siguiente paso es confirmar el pre-diagnóstico con un médico en clínica.</p>
                <button onClick={() => handleCTAClick('reserva_consulta')} className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg flex items-center justify-center gap-2 mb-4 hover:-translate-y-0.5 transition-transform" style={{ backgroundColor: theme.primary }}>
                  Reserva tu Consulta de Diagnóstico — 195€ <Calendar size={20} />
                </button>
                <button onClick={() => handleCTAClick('prefiero_llamada')} className="w-full py-3 rounded-xl text-gray-500 font-semibold text-sm hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors">
                  Prefiero que me llaméis primero <PhoneCall size={16} />
                </button>
              </div>
            )}
            {frame === 'FRAME_C' && (
              <div className="border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h4 className="font-bold text-xl text-gray-900 mb-2">Entendemos que quieras hablar antes</h4>
                <p className="text-gray-600 mb-6">Un asesor médico de Hospital Capilar te llamará en menos de 24h para resolver tus dudas, sin compromiso.</p>
                <button onClick={() => handleCTAClick('solicitar_llamada')} className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-transform" style={{ backgroundColor: theme.primary }}>
                  Solicita que te llamemos <PhoneCall size={20} />
                </button>
              </div>
            )}
            {frame === 'FRAME_D' && (
              <div className="border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h4 className="font-bold text-xl text-gray-900 mb-2">Recibe tu Guía Personalizada</h4>
                <p className="text-gray-600 mb-6">Parece que estás empezando a explorar opciones. Te hemos preparado una guía con todo lo que necesitas saber.</p>
                <button onClick={() => handleCTAClick('descarga_guia')} className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-transform" style={{ backgroundColor: theme.primary }}>
                  Descarga tu Guía (PDF) <Download size={20} />
                </button>
              </div>
            )}
            {frame === 'WAITLIST' && (
              <div className="border border-gray-200 rounded-2xl p-6 shadow-sm bg-gray-50">
                <h4 className="font-bold text-xl text-gray-900 mb-2">Próximas aperturas 2026</h4>
                <p className="text-gray-600 mb-6">Estamos abriendo 6 nuevas clínicas en 2026. Si te apuntas, serás el primero en enterarte cuando abramos en tu zona.</p>
                <button onClick={() => handleCTAClick('waitlist')} className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg flex items-center justify-center gap-2 mb-4 hover:-translate-y-0.5 transition-transform" style={{ backgroundColor: theme.primary }}>
                  Avísame cuando abráis cerca <MapPin size={20} />
                </button>
                <button onClick={() => handleCTAClick('videoconsulta')} className="w-full py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-bold text-sm hover:bg-white flex items-center justify-center gap-2 transition-colors">
                  ¿Ofrecéis videoconsulta médica? <PhoneCall size={16} />
                </button>
              </div>
            )}
            {isDerivacion && (
              <div className="border border-amber-200 rounded-2xl p-6 shadow-sm bg-amber-50">
                <h4 className="font-bold text-xl text-amber-900 mb-2">Información enviada</h4>
                <p className="text-amber-800 mb-6">Te hemos enviado a tu email información educativa sobre cómo manejar problemas del cuero cabelludo antes de visitar a tu dermatólogo.</p>
                <button onClick={() => handleCTAClick('articulo_derivacion')} className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 transition-colors">
                  Ir a leer el artículo <FileText size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // PREGUNTAS
  const progress = (stepIndex / activeQuestions.length) * 100;

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col relative overflow-hidden">

      {/* MICRO-TIP OVERLAY */}
      {showMicroTip && (
        <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#F0F7F6] border-2 border-[#4CA994]/20 p-8 rounded-3xl shadow-xl text-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Info size={32} style={{ color: theme.primary }} />
            </div>
            <h3 className="text-xl font-bold text-[#2C3E50] mb-4">¿Sabías que...?</h3>
            <p className="text-[#405B5B] text-lg leading-relaxed mb-8">{currentQ.microTip}</p>
            <button
              onClick={handleNext}
              className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-md hover:opacity-90 transition-opacity"
              style={{ backgroundColor: theme.primary }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="h-1.5 w-full bg-gray-100 fixed top-0 z-40">
        <div className="h-full transition-all duration-500 ease-out" style={{ width: `${progress}%`, backgroundColor: theme.primary }}></div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full p-6 pt-12 flex flex-col">
        <button onClick={handleBack} className="self-start text-gray-400 hover:text-gray-600 mb-8 p-2 -ml-2 rounded-full hover:bg-gray-50">
          <ArrowLeft size={24} />
        </button>

        {currentQ.type !== 'form' && (
          <>
            <div className="mb-8">
              <span className="text-xs font-bold tracking-wider text-[#4CA994] uppercase mb-2 block">
                Fase {currentQ.block} de 4
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 leading-tight">
                {currentQ.title}
              </h2>
              {currentQ.subtitle && <p className="text-gray-500 text-lg">{currentQ.subtitle}</p>}
            </div>

            <div className="grid gap-3 mb-6">
              {(currentQ.optionsFn ? currentQ.optionsFn(answers) : currentQ.options).map((option, idx) => {
                const isSelected = currentQ.type === 'single'
                  ? answers[currentQ.id] === option.value
                  : (answers[currentQ.id] || []).includes(option.value);
                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(option.value)}
                    className={`group flex items-center gap-4 p-5 rounded-xl border-2 transition-all duration-200 text-left ${
                      isSelected ? 'border-[#4CA994] bg-[#F0F7F6]' : 'border-gray-100 hover:border-[#4CA994]/50 hover:bg-gray-50'
                    }`}
                  >
                    {option.icon && <span className="text-2xl w-8 text-center">{option.icon}</span>}
                    <span className={`flex-1 font-bold text-lg ${isSelected ? 'text-[#2C3E50]' : 'text-gray-700'}`}>
                      {option.label}
                    </span>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-[#4CA994] bg-[#4CA994]' : 'border-gray-300'
                    }`}>
                      {isSelected && <CheckCircle2 size={16} className="text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {currentQ.type === 'multiple' && (answers[currentQ.id] && answers[currentQ.id].length > 0) && (
              <button
                onClick={handleMultipleNext}
                className="w-full py-4 rounded-xl text-white font-bold text-lg mt-4 shadow-lg hover:-translate-y-0.5 transition-transform"
                style={{ backgroundColor: theme.primary }}
              >
                Siguiente Pregunta <ChevronRight size={20} className="inline ml-1 -mt-1" />
              </button>
            )}
          </>
        )}

        {currentQ.type === 'form' && (
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 leading-tight">{currentQ.title}</h2>
            <p className="text-gray-500 text-lg mb-8">{currentQ.subtitle}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre completo <span className="text-red-500">*</span></label>
                <input type="text" value={answers.nombre || ''} onChange={(e) => setAnswers({...answers, nombre: e.target.value})}
                  onFocus={() => analytics.trackEvent('form_field_focused', { field: 'nombre' })}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-[#4CA994] outline-none" placeholder="Ej: Carlos García" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                <input type="email" value={answers.email || ''} onChange={(e) => setAnswers({...answers, email: e.target.value})}
                  onFocus={() => analytics.trackEvent('form_field_focused', { field: 'email' })}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-[#4CA994] outline-none" placeholder="correo@ejemplo.com" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Teléfono <span className="text-red-500">*</span></label>
                <input type="tel" value={answers.telefono || ''} onChange={(e) => setAnswers({...answers, telefono: e.target.value})}
                  onFocus={() => analytics.trackEvent('form_field_focused', { field: 'telefono' })}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-[#4CA994] outline-none" placeholder="+34 600 000 000" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">¿Cerca de qué clínica te queda mejor? <span className="text-red-500">*</span></label>
                <select className="w-full p-4 border-2 border-gray-200 rounded-xl bg-white focus:border-[#4CA994] outline-none font-medium"
                  onChange={(e) => setAnswers({...answers, ubicacion: e.target.value})} value={answers.ubicacion || ''}>
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
              </div>
              <button
                onClick={() => {
                  analytics.trackEvent('form_submitted', {
                    has_name: !!answers.nombre,
                    has_email: !!answers.email,
                    has_phone: !!answers.telefono,
                    ubicacion: answers.ubicacion,
                  });
                  if (answers.email) {
                    analytics.trackEvent('$identify', { email: answers.email, name: answers.nombre });
                  }
                  startAnalysis();
                }}
                disabled={!answers.ubicacion || !answers.nombre || !answers.email || !answers.telefono}
                className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg mt-6 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                style={{ backgroundColor: theme.primary }}
              >
                Ver mi diagnóstico <ChevronRight size={20} />
              </button>
              <p className="text-xs text-center text-gray-400 mt-4 px-4">
                Acepto la política de privacidad. Tus datos están protegidos y solo se usarán para enviarte el pre-diagnóstico capilar.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 text-center border-t border-gray-100 bg-gray-50 flex justify-center gap-6">
        <p className="text-xs text-gray-400 font-medium flex items-center gap-1"><ShieldCheck size={14}/> 100% Confidencial</p>
        <p className="text-xs text-gray-400 font-medium flex items-center gap-1"><Stethoscope size={14}/> Valoración Médica</p>
      </div>
    </div>
  );
};

export default HospitalCapilarQuiz;
