import React, { useState } from 'react';
import {
  ChevronRight, CheckCircle2, ArrowLeft, ShieldCheck, Stethoscope,
  Sparkles, Dna, MapPin, Info, PhoneCall, Calendar, Download, FileText
} from 'lucide-react';

const HospitalCapilarQuiz = () => {
  const [stepIndex, setStepIndex] = useState(-1);
  const [answers, setAnswers] = useState({ probado: [], condicion: [] });
  const [showMicroTip, setShowMicroTip] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [finalResult, setFinalResult] = useState(null);

  const theme = { primary: '#4CA994', secondary: '#2C3E50', light: '#F0F7F6', white: '#FFFFFF' };

  const questions = [
    // BLOQUE 1: IDENTIFICACIÓN
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
    // BLOQUE 2: PROFUNDIDAD + EDUCACIÓN
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
    // BLOQUE 3: DISPOSICIÓN
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

  const getLabel = (qId, value) => {
    const q = questions.find(q => q.id === qId);
    if (!q) return value;
    const opt = q.options?.find(o => o.value === value);
    return opt ? opt.label : value;
  };

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

    setFinalResult({ ecp, score, frame, nombre: finalAnswers.nombre || 'Paciente' });
  };

  const handleNext = () => {
    if (currentQ.microTip && !showMicroTip) {
      setShowMicroTip(true);
      return;
    }
    setShowMicroTip(false);
    if (stepIndex < activeQuestions.length - 1) {
      setStepIndex(prev => prev + 1);
    } else {
      startAnalysis();
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setShowMicroTip(false);
      setStepIndex(prev => prev - 1);
    } else if (stepIndex === 0) {
      setStepIndex(-1);
    }
  };

  const handleAnswer = (value) => {
    if (currentQ.type === 'single') {
      const newAnswers = { ...answers, [currentQ.id]: value };
      setAnswers(newAnswers);
      setTimeout(() => {
        setShowMicroTip(false);
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

  const startAnalysis = () => {
    processResults(answers);
    setIsAnalyzing(true);
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
            onClick={() => setStepIndex(0)}
            className="w-full md:w-auto px-12 py-4 rounded-xl text-white font-bold text-lg shadow-lg hover:-translate-y-1 transition-transform"
            style={{ backgroundColor: theme.primary }}
          >
            Iniciar Pre-Diagnóstico
          </button>
        </div>
      </div>
    );
  }

  // PANTALLA ANÁLISIS
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
                <button className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg flex items-center justify-center gap-2 mb-4 hover:-translate-y-0.5 transition-transform" style={{ backgroundColor: theme.primary }}>
                  Reserva tu Consulta de Diagnóstico — 195€ <Calendar size={20} />
                </button>
                <button className="w-full py-3 rounded-xl text-gray-500 font-semibold text-sm hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors">
                  Prefiero que me llaméis primero <PhoneCall size={16} />
                </button>
              </div>
            )}
            {frame === 'FRAME_C' && (
              <div className="border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h4 className="font-bold text-xl text-gray-900 mb-2">Entendemos que quieras hablar antes</h4>
                <p className="text-gray-600 mb-6">Un asesor médico de Hospital Capilar te llamará en menos de 24h para resolver tus dudas, sin compromiso.</p>
                <button className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-transform" style={{ backgroundColor: theme.primary }}>
                  Solicita que te llamemos <PhoneCall size={20} />
                </button>
              </div>
            )}
            {frame === 'FRAME_D' && (
              <div className="border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h4 className="font-bold text-xl text-gray-900 mb-2">Recibe tu Guía Personalizada</h4>
                <p className="text-gray-600 mb-6">Parece que estás empezando a explorar opciones. Te hemos preparado una guía con todo lo que necesitas saber.</p>
                <button className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-transform" style={{ backgroundColor: theme.primary }}>
                  Descarga tu Guía (PDF) <Download size={20} />
                </button>
              </div>
            )}
            {frame === 'WAITLIST' && (
              <div className="border border-gray-200 rounded-2xl p-6 shadow-sm bg-gray-50">
                <h4 className="font-bold text-xl text-gray-900 mb-2">Próximas aperturas 2026</h4>
                <p className="text-gray-600 mb-6">Estamos abriendo 6 nuevas clínicas en 2026. Si te apuntas, serás el primero en enterarte cuando abramos en tu zona.</p>
                <button className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg flex items-center justify-center gap-2 mb-4 hover:-translate-y-0.5 transition-transform" style={{ backgroundColor: theme.primary }}>
                  Avísame cuando abráis cerca <MapPin size={20} />
                </button>
                <button className="w-full py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-bold text-sm hover:bg-white flex items-center justify-center gap-2 transition-colors">
                  ¿Ofrecéis videoconsulta médica? <PhoneCall size={16} />
                </button>
              </div>
            )}
            {isDerivacion && (
              <div className="border border-amber-200 rounded-2xl p-6 shadow-sm bg-amber-50">
                <h4 className="font-bold text-xl text-amber-900 mb-2">Información enviada</h4>
                <p className="text-amber-800 mb-6">Te hemos enviado a tu email información educativa sobre cómo manejar problemas del cuero cabelludo antes de visitar a tu dermatólogo.</p>
                <button className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 transition-colors">
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
                onClick={handleNext}
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
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-[#4CA994] outline-none" placeholder="Ej: Carlos García" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                <input type="email" value={answers.email || ''} onChange={(e) => setAnswers({...answers, email: e.target.value})}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-[#4CA994] outline-none" placeholder="correo@ejemplo.com" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Teléfono <span className="text-red-500">*</span></label>
                <input type="tel" value={answers.telefono || ''} onChange={(e) => setAnswers({...answers, telefono: e.target.value})}
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
                onClick={startAnalysis}
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
