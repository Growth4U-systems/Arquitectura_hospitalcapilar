import { useState, useEffect, useRef } from 'react';
import {
  ChevronRight,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
  Stethoscope,
  Clock,
  Sparkles,
  Dna,
  Pencil,
} from 'lucide-react';
import { useAnalytics } from '@hospital-capilar/shared/analytics';

// ============================================
// DECISION TREE ENGINE - Lógica condicional de resultados
// ============================================

// Evalúa una condición contra las respuestas del usuario
function evaluateCondition(condition, answers) {
  const { field, operator, value } = condition;
  const answerValue = answers[field];

  switch (operator) {
    case 'equals':
      return answerValue === value;
    case 'not_equals':
      return answerValue !== value;
    case 'contains':
      return answerValue?.includes?.(value);
    case 'in':
      return Array.isArray(value) && value.includes(answerValue);
    case 'not_in':
      return Array.isArray(value) && !value.includes(answerValue);
    default:
      return false;
  }
}

// Evalúa un grupo de condiciones (AND/OR)
function evaluateConditionGroup(group, answers) {
  const { logic = 'AND', conditions } = group;

  if (logic === 'AND') {
    return conditions.every(cond =>
      cond.conditions ? evaluateConditionGroup(cond, answers) : evaluateCondition(cond, answers)
    );
  } else {
    return conditions.some(cond =>
      cond.conditions ? evaluateConditionGroup(cond, answers) : evaluateCondition(cond, answers)
    );
  }
}

// Encuentra el resultado correcto basado en las reglas del árbol de decisión
export function evaluateDecisionTree(decisionTree, answers) {
  if (!decisionTree?.rules || decisionTree.rules.length === 0) {
    return decisionTree?.defaultResult || null;
  }

  // Evalúa las reglas en orden de prioridad
  for (const rule of decisionTree.rules.sort((a, b) => (a.priority || 0) - (b.priority || 0))) {
    if (evaluateConditionGroup(rule.conditions, answers)) {
      return rule.result;
    }
  }

  return decisionTree.defaultResult || null;
}

// Calcula puntuación basada en pesos de respuestas
export function calculateScore(scoreRules, answers) {
  if (!scoreRules) return 0;

  let totalScore = 0;

  for (const [questionId, answerValue] of Object.entries(answers)) {
    const questionRules = scoreRules[questionId];
    if (questionRules && questionRules[answerValue] !== undefined) {
      totalScore += questionRules[answerValue];
    }
  }

  return totalScore;
}

// Default quiz data
const DEFAULT_QUIZ_DATA = {
  theme: {
    primary: '#4CA994',
    secondary: '#2C3E50',
    light: '#F0F7F6',
    white: '#FFFFFF'
  },
  intro: {
    badge: 'Test Capilar Online IA',
    title: '¿Eres candidato para un\n*Injerto Capilar?*',
    subtitle: 'Nuestro algoritmo médico analiza 8 factores clave de tu perfil para ofrecerte un pre-análisis de viabilidad gratuito.',
    buttonText: 'Comenzar Test Gratuito',
    footerText: 'Más de 5.000 pacientes evaluados este año.',
    features: ['Análisis Completo', 'Revisión Médica', '100% Privado']
  },
  questions: [
    {
      id: 'gender',
      title: 'Para comenzar, ¿cuál es tu género?',
      subtitle: 'El patrón de caída y el tratamiento varían biológicamente.',
      type: 'single',
      options: [
        { label: 'Hombre', icon: '👨' },
        { label: 'Mujer', icon: '👩' }
      ]
    },
    {
      id: 'age',
      title: '¿Cuál es tu rango de edad?',
      subtitle: 'La edad influye en la estabilidad de la zona donante.',
      type: 'single',
      options: [
        { label: 'Menos de 25 años', icon: null },
        { label: '25 - 35 años', icon: null },
        { label: '36 - 45 años', icon: null },
        { label: '46 - 55 años', icon: null },
        { label: 'Más de 55 años', icon: null }
      ]
    },
    {
      id: 'genetics',
      title: '¿Tienes antecedentes familiares de alopecia?',
      subtitle: 'La genética es el factor determinante en el 90% de los casos.',
      type: 'single',
      options: [
        { label: 'Sí, padre o madre', icon: '🧬' },
        { label: 'Sí, abuelos o tíos', icon: '👴' },
        { label: 'No que yo sepa', icon: '🤷‍♂️' }
      ]
    },
    {
      id: 'area',
      title: '¿Dónde notas mayor pérdida de cabello?',
      subtitle: 'Selecciona la imagen que más se parece a tu situación actual.',
      type: 'visual',
      options: [
        { label: 'Entradas (Línea frontal)', desc: 'Retroceso en la frente', id: 'entradas' },
        { label: 'Coronilla', desc: 'Pérdida en la zona superior trasera', id: 'coronilla' },
        { label: 'Difusa / General', desc: 'Pérdida de densidad global', id: 'difusa' },
        { label: 'Avanzada', desc: 'Zona frontal y coronilla unidas', id: 'avanzada' }
      ]
    },
    {
      id: 'timeline',
      title: '¿Desde cuándo notas la caída?',
      subtitle: 'Nos ayuda a evaluar la velocidad de progresión de la alopecia.',
      type: 'single',
      options: [
        { label: 'Menos de 1 año (Reciente)', icon: '⚡' },
        { label: 'Entre 1 y 5 años (Progresiva)', icon: '📅' },
        { label: 'Más de 5 años (Estable)', icon: '⏳' },
        { label: 'Siempre he tenido poco pelo', icon: '🧬' }
      ]
    },
    {
      id: 'hairtype',
      title: '¿Cómo describirías tu tipo de pelo?',
      subtitle: 'El grosor y la forma determinan la técnica de injerto ideal (FUE/DHI).',
      type: 'single',
      options: [
        { label: 'Liso y fino', icon: '〰️' },
        { label: 'Liso y grueso', icon: '➖' },
        { label: 'Ondulado / Rizado', icon: '➰' },
        { label: 'Muy rizado / Afro', icon: '🌀' }
      ]
    },
    {
      id: 'medication',
      title: '¿Has seguido algún tratamiento médico antes?',
      subtitle: 'Como Minoxidil, Finasteride, mesoterapia o PRP.',
      type: 'single',
      options: [
        { label: 'No, nunca', icon: null },
        { label: 'Sí, actualmente lo uso', icon: null },
        { label: 'Sí, en el pasado pero lo dejé', icon: null }
      ]
    },
    {
      id: 'urgency',
      title: 'Si fueras apto/a, ¿cuándo te gustaría realizar el tratamiento?',
      subtitle: 'Esto nos ayuda a comprobar la disponibilidad de quirófanos.',
      type: 'single',
      options: [
        { label: 'Lo antes posible', icon: '🚀' },
        { label: 'En los próximos 3 meses', icon: '📅' },
        { label: 'En 6 meses o más', icon: '🗓️' },
        { label: 'Solo me estoy informando', icon: '🔍' }
      ]
    }
  ],
  leadForm: {
    formTitle: 'Recibe tu Informe Médico + Presupuesto',
    formSubtitle: 'Nuestro equipo médico te enviará por WhatsApp/Email la valoración detallada de tu caso y una estimación de unidades foliculares necesarias.',
    consentText: 'Consiento el tratamiento de mis datos de salud para recibir el pre-análisis médico personalizado.',
    trustBadges: ['ISHRS', 'WFI', 'FUE Europe']
  },
  // Árbol de decisión para resultados condicionales
  decisionTree: {
    // Reglas de puntuación por pregunta y respuesta
    scoreRules: {
      age: {
        'Menos de 25 años': 10,
        '25 - 35 años': 25,
        '36 - 45 años': 25,
        '46 - 55 años': 20,
        'Más de 55 años': 15
      },
      genetics: {
        'Sí, padre o madre': 15,
        'Sí, abuelos o tíos': 10,
        'No que yo sepa': 5
      },
      timeline: {
        'Menos de 1 año (Reciente)': 10,
        'Entre 1 y 5 años (Progresiva)': 20,
        'Más de 5 años (Estable)': 25,
        'Siempre he tenido poco pelo': 15
      },
      urgency: {
        'Lo antes posible': 30,
        'En los próximos 3 meses': 25,
        'En 6 meses o más': 15,
        'Solo me estoy informando': 5
      }
    },
    // Reglas condicionales para determinar el resultado
    rules: [
      {
        id: 'not_candidate_young',
        priority: 1,
        conditions: {
          logic: 'AND',
          conditions: [
            { field: 'age', operator: 'equals', value: 'Menos de 25 años' },
            { field: 'timeline', operator: 'equals', value: 'Menos de 1 año (Reciente)' }
          ]
        },
        result: {
          type: 'warning',
          title: 'Recomendamos Esperar',
          description: 'Dado tu perfil joven y la reciente aparición de la caída, nuestros médicos recomiendan un seguimiento antes de considerar un injerto.',
          color: 'amber',
          cta: { type: 'consultation', text: 'Reservar Test Capilar' }
        }
      },
      {
        id: 'excellent_candidate',
        priority: 2,
        conditions: {
          logic: 'AND',
          conditions: [
            { field: 'age', operator: 'in', value: ['25 - 35 años', '36 - 45 años'] },
            { field: 'timeline', operator: 'in', value: ['Más de 5 años (Estable)', 'Entre 1 y 5 años (Progresiva)'] },
            { field: 'urgency', operator: 'in', value: ['Lo antes posible', 'En los próximos 3 meses'] }
          ]
        },
        result: {
          type: 'success',
          title: 'Excelente Candidato',
          description: 'Tu perfil indica una alta compatibilidad para un injerto capilar con resultados óptimos. Zona donante estable y expectativas realistas.',
          color: 'green',
          score: 90,
          cta: { type: 'calendly', text: 'Agendar Valoración Gratuita' }
        }
      },
      {
        id: 'good_candidate',
        priority: 3,
        conditions: {
          logic: 'OR',
          conditions: [
            { field: 'genetics', operator: 'in', value: ['Sí, padre o madre', 'Sí, abuelos o tíos'] },
            { field: 'timeline', operator: 'equals', value: 'Más de 5 años (Estable)' }
          ]
        },
        result: {
          type: 'success',
          title: 'Análisis Preliminar: APTO',
          description: 'Hemos analizado tus 8 respuestas. Según tu perfil, eres un candidato potencial para una intervención con alta densidad.',
          color: 'green',
          cta: { type: 'form', text: 'Recibir Informe Personalizado' }
        }
      }
    ],
    // Resultado por defecto si ninguna regla aplica
    defaultResult: {
      type: 'info',
      title: 'Evaluación Requerida',
      description: 'Tu caso requiere una evaluación personalizada por nuestro equipo médico para determinar la mejor opción de tratamiento.',
      color: 'blue',
      cta: { type: 'form', text: 'Solicitar Evaluación' }
    }
  },
  result: {
    title: '¡Solicitud Enviada!',
    subtitle: 'Nuestro equipo médico te contactará en las próximas 24-48 horas con tu informe personalizado.'
  }
};

// Parse title with *highlighted* text
function parseTitle(title, primaryColor) {
  if (!title) return null;
  const parts = title.split(/\*([^*]+)\*/);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <span key={i} style={{ color: primaryColor }}>{part}</span>
      : part.split('\n').map((line, j, arr) => (
          <span key={`${i}-${j}`}>
            {line}
            {j < arr.length - 1 && <br />}
          </span>
        ))
  );
}

const Quiz = ({ editableData, decisionTree: propDecisionTree, onStepChange, isEditMode }) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [computedResult, setComputedResult] = useState(null);
  const [leadScore, setLeadScore] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    consent: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Use editable data or defaults
  const quizData = editableData || DEFAULT_QUIZ_DATA;
  const theme = quizData.theme || DEFAULT_QUIZ_DATA.theme;
  const intro = quizData.intro || DEFAULT_QUIZ_DATA.intro;
  const questions = quizData.questions || DEFAULT_QUIZ_DATA.questions;
  const leadForm = quizData.leadForm || DEFAULT_QUIZ_DATA.leadForm;
  const decisionTree = propDecisionTree || quizData.decisionTree || DEFAULT_QUIZ_DATA.decisionTree;
  const result = quizData.result || DEFAULT_QUIZ_DATA.result;

  // Analytics hook
  const {
    trackQuizStarted,
    trackQuestionAnswered,
    trackQuizCompleted,
    trackAnalysisStarted,
    trackAnalysisCompleted,
    trackFormViewed,
    trackFormFieldFocused,
    trackFormSubmitted,
    trackBackButtonClicked,
  } = useAnalytics();

  // Track form viewed when reaching results
  const hasTrackedFormView = useRef(false);

  // Sync step with parent
  useEffect(() => {
    if (onStepChange) {
      onStepChange(step);
    }
  }, [step, onStepChange]);

  // Handle starting the quiz
  const handleStartQuiz = () => {
    trackQuizStarted();
    setStep(1);
  };

  // Handle answering a question
  const handleAnswer = (questionId, answer) => {
    const questionIndex = step - 1;
    trackQuestionAnswered(questionId, questionIndex, answer);

    const newAnswers = { ...answers, [questionId]: answer };
    setAnswers(newAnswers);

    if (step < questions.length) {
      setTimeout(() => setStep(step + 1), 250);
    } else {
      trackQuizCompleted(newAnswers);
      startAnalysis(newAnswers);
    }
  };

  // Start analysis animation and evaluate decision tree
  const startAnalysis = (finalAnswers) => {
    trackAnalysisStarted();
    setIsAnalyzing(true);
    let progress = 0;

    // Calculate score while "analyzing"
    const score = calculateScore(decisionTree?.scoreRules, finalAnswers);
    setLeadScore(score);

    const interval = setInterval(() => {
      progress += 1;
      setAnalysisProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);

        // Evaluate decision tree to get result
        const evaluatedResult = evaluateDecisionTree(decisionTree, finalAnswers);
        setComputedResult(evaluatedResult);

        trackAnalysisCompleted(evaluatedResult?.title || 'APTO');
        setIsAnalyzing(false);
        setStep(questions.length + 1);
      }
    }, 50);
  };

  // Handle back button
  const handleBack = () => {
    if (step > 0 && !isAnalyzing) {
      trackBackButtonClicked(step, step - 1);
      setStep(step - 1);
    }
  };

  // Handle form field focus
  const handleFieldFocus = (fieldName, fieldOrder) => {
    trackFormFieldFocused(fieldName, fieldOrder);
  };

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Handle form submission
  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!formData.consent) {
      alert('Debes aceptar el consentimiento para continuar.');
      return;
    }

    setIsSubmitting(true);

    const leadScore = trackFormSubmitted(
      { name: formData.name, phone: formData.phone, email: formData.email },
      answers
    );

    console.log('Lead submitted:', {
      ...formData,
      answers,
      leadScore,
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  // Track form view when results are shown
  useEffect(() => {
    if (step > questions.length && !hasTrackedFormView.current) {
      trackFormViewed();
      hasTrackedFormView.current = true;
    }
  }, [step, questions.length, trackFormViewed]);

  // Edit mode indicator component
  const EditIndicator = ({ label }) => {
    if (!isEditMode) return null;
    return (
      <div className="absolute -top-2 -left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 z-10 opacity-75">
        <Pencil size={10} />
        {label}
      </div>
    );
  };

  // --- SCREEN COMPONENTS ---

  // 1. INTRO
  if (step === 0) {
    return (
      <div className="min-h-screen bg-white font-sans text-gray-800 relative overflow-hidden">
        <div className="h-2 w-full" style={{ backgroundColor: theme.primary }}></div>
        <nav className="p-4 flex justify-between items-center max-w-5xl mx-auto">
          <div className="font-bold text-xl tracking-tight text-gray-800 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full" style={{ backgroundColor: theme.primary }}></div>
            HOSPITAL<span style={{ color: theme.primary }}>CAPILAR</span>
          </div>
          <button className="text-sm font-medium text-gray-500">Volver a la web</button>
        </nav>

        <div className="max-w-xl mx-auto px-6 py-12 flex flex-col items-center text-center mt-8">
          <div className="relative">
            <EditIndicator label="Badge" />
            <div className="bg-emerald-50 text-emerald-800 px-4 py-1.5 rounded-full text-sm font-bold mb-6 inline-flex items-center gap-2">
              <Sparkles size={16} /> {intro.badge}
            </div>
          </div>

          <div className="relative">
            <EditIndicator label="Título" />
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6 leading-tight">
              {parseTitle(intro.title, theme.primary)}
            </h1>
          </div>

          <div className="relative">
            <EditIndicator label="Subtítulo" />
            <p className="text-lg text-gray-600 mb-10 max-w-md mx-auto leading-relaxed">
              {intro.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-10 text-left relative">
            <EditIndicator label="Features" />
            {[
              { icon: <Clock size={20} />, text: intro.features?.[0] || 'Análisis Completo' },
              { icon: <Stethoscope size={20} />, text: intro.features?.[1] || 'Revisión Médica' },
              { icon: <ShieldCheck size={20} />, text: intro.features?.[2] || '100% Privado' }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div style={{ color: theme.primary }}>{item.icon}</div>
                <span className="text-sm font-semibold text-gray-700">{item.text}</span>
              </div>
            ))}
          </div>

          <div className="relative">
            <EditIndicator label="CTA" />
            <button
              onClick={handleStartQuiz}
              className="w-full md:w-auto px-12 py-4 rounded-xl text-white font-bold text-lg shadow-lg hover:shadow-xl transform transition hover:-translate-y-1"
              style={{ backgroundColor: theme.primary }}
            >
              {intro.buttonText}
            </button>
          </div>

          <p className="mt-6 text-xs text-gray-400">
            {intro.footerText}
          </p>
        </div>
      </div>
    );
  }

  // 2. ANALYSIS (Loading Screen)
  if (isAnalyzing) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: `${theme.primary} transparent transparent transparent` }}></div>
            <Dna className="absolute inset-0 m-auto text-gray-400" size={32} />
          </div>

          <h2 className="text-2xl font-bold text-gray-800 mb-2">Analizando tu caso...</h2>
          <p className="text-gray-500 mb-8">Analizando viabilidad de zona donante vs receptora</p>

          <div className="w-full bg-gray-200 rounded-full h-3 mb-4 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-100 ease-out"
              style={{ width: `${analysisProgress}%`, backgroundColor: theme.primary }}
            ></div>
          </div>

          <div className="text-xs text-gray-500 font-mono space-y-1">
            <p className={analysisProgress > 20 ? 'text-emerald-600 font-bold' : ''}>✓ Verificando patrón de caída...</p>
            <p className={analysisProgress > 50 ? 'text-emerald-600 font-bold' : ''}>✓ Calculando unidades foliculares estimadas...</p>
            <p className={analysisProgress > 80 ? 'text-emerald-600 font-bold' : ''}>✓ Generando informe médico...</p>
          </div>
        </div>
      </div>
    );
  }

  // 3. LEAD CAPTURE FORM (Final)
  if (step > questions.length) {
    if (isSubmitted) {
      return (
        <div className="min-h-screen bg-white font-sans flex items-center justify-center">
          <div className="max-w-lg mx-auto p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="text-green-600" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{result.title}</h2>
            <p className="text-gray-500">{result.subtitle}</p>
          </div>
        </div>
      );
    }

    // Get result colors based on computedResult type
    const resultColors = {
      success: { bg: 'bg-green-50', border: 'border-green-100', icon: 'bg-green-100', iconText: 'text-green-600', title: 'text-green-800', text: 'text-green-700' },
      warning: { bg: 'bg-amber-50', border: 'border-amber-100', icon: 'bg-amber-100', iconText: 'text-amber-600', title: 'text-amber-800', text: 'text-amber-700' },
      info: { bg: 'bg-blue-50', border: 'border-blue-100', icon: 'bg-blue-100', iconText: 'text-blue-600', title: 'text-blue-800', text: 'text-blue-700' },
    };
    const colors = resultColors[computedResult?.type] || resultColors.success;
    const displayResult = computedResult || { title: 'Análisis Preliminar: APTO', description: 'Eres un candidato potencial.' };

    return (
      <div className="min-h-screen bg-white font-sans">
        <div className="h-2 w-full" style={{ backgroundColor: theme.primary }}></div>
        <div className="max-w-lg mx-auto p-6 pt-12">
          <div className={`${colors.bg} border ${colors.border} rounded-2xl p-6 mb-8 text-center relative`}>
            <EditIndicator label="Resultado" />
            <div className={`w-12 h-12 ${colors.icon} rounded-full flex items-center justify-center mx-auto mb-3`}>
              <CheckCircle2 className={colors.iconText} size={24} />
            </div>
            <h2 className={`text-xl font-bold ${colors.title} mb-1`}>{displayResult.title}</h2>
            <p className={`${colors.text} text-sm mt-2`}>
              {displayResult.description}
            </p>
            {leadScore > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <span className="text-xs text-gray-500">Puntuación de compatibilidad:</span>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${leadScore}%`, backgroundColor: theme.primary }}
                    />
                  </div>
                  <span className="text-sm font-bold" style={{ color: theme.primary }}>{leadScore}%</span>
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <EditIndicator label="Form" />
            <h3 className="text-2xl font-bold text-gray-800 mb-2 text-center">{leadForm.formTitle}</h3>
            <p className="text-gray-500 text-center mb-8 text-sm">{leadForm.formSubtitle}</p>
          </div>

          <form className="space-y-4" onSubmit={handleFormSubmit}>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre completo</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                onFocus={() => handleFieldFocus('name', 1)}
                required
                className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:outline-none transition"
                style={{ '--tw-ring-color': theme.primary }}
                placeholder="Ej: Juan Pérez"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Teléfono (Te enviaremos el informe aquí)</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                onFocus={() => handleFieldFocus('phone', 2)}
                required
                className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:outline-none transition"
                placeholder="+34 600 000 000"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Correo electrónico</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                onFocus={() => handleFieldFocus('email', 3)}
                required
                className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:outline-none transition"
                placeholder="juan@ejemplo.com"
              />
            </div>

            <div className="flex items-start gap-2 pt-2">
              <input
                type="checkbox"
                name="consent"
                checked={formData.consent}
                onChange={handleInputChange}
                className="mt-1 rounded"
                style={{ accentColor: theme.primary }}
              />
              <p className="text-xs text-gray-400 leading-snug">
                {leadForm.consentText}
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg mt-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: theme.primary }}
            >
              {isSubmitting ? (
                'Enviando...'
              ) : (
                <>
                  Solicitar Estudio Gratuito <ChevronRight size={20} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-3">Avalado por</p>
            <div className="flex justify-center items-center gap-6 opacity-50 grayscale">
              {(leadForm.trustBadges || ['ISHRS', 'WFI', 'FUE Europe']).map((badge, i) => (
                <div key={i} className="font-bold text-lg text-gray-400">{badge}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. QUESTIONS (Main Flow)
  const currentQ = questions[step - 1];
  const progress = ((step - 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      {/* Header Progress */}
      <div className="h-1.5 w-full bg-gray-100">
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%`, backgroundColor: theme.primary }}
        ></div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full p-6 flex flex-col">
        {/* Navigation */}
        <button
          onClick={handleBack}
          className="self-start text-gray-400 hover:text-gray-600 mb-8 p-2 -ml-2 rounded-full hover:bg-gray-50 transition"
        >
          <ArrowLeft size={24} />
        </button>

        {/* Question Text */}
        <div className="mb-8 relative">
          <EditIndicator label={`Pregunta ${step}`} />
          <span className="text-xs font-bold tracking-wider text-gray-400 uppercase mb-2 block">
            Paso {step} de {questions.length}
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 leading-tight">
            {currentQ.title}
          </h2>
          {currentQ.subtitle && (
            <p className="text-gray-500 text-lg">{currentQ.subtitle}</p>
          )}
        </div>

        {/* Options Grid */}
        <div className={`grid gap-4 ${currentQ.type === 'visual' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
          {currentQ.options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => handleAnswer(currentQ.id, option.label)}
              className="group relative flex items-center gap-4 p-5 rounded-xl border-2 border-gray-100 hover:bg-opacity-10 transition-all duration-200 text-left"
              style={{
                '--hover-border': theme.primary,
                '--hover-bg': theme.light
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = theme.primary;
                e.currentTarget.style.backgroundColor = theme.light;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#f3f4f6';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {/* Visual Selection (Custom for Hair Areas) */}
              {currentQ.type === 'visual' && (
                <div className="w-16 h-16 bg-gray-200 rounded-lg shrink-0 flex items-center justify-center text-2xl overflow-hidden relative">
                  {option.id === 'entradas' && (
                    <div className="w-full h-full bg-gray-300 relative">
                      <div className="absolute top-0 left-0 w-6 h-6 bg-white rounded-br-full"></div>
                      <div className="absolute top-0 right-0 w-6 h-6 bg-white rounded-bl-full"></div>
                    </div>
                  )}
                  {option.id === 'coronilla' && (
                    <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                      <div className="w-8 h-8 bg-white rounded-full opacity-80 blur-[2px]"></div>
                    </div>
                  )}
                  {option.id === 'difusa' && (
                    <div className="w-full h-full bg-gray-300 opacity-50 flex flex-wrap gap-1 p-1">
                      {[...Array(9)].map((_, i) => <div key={i} className="w-1 h-1 bg-white rounded-full"></div>)}
                    </div>
                  )}
                  {option.id === 'avanzada' && (
                    <div className="w-full h-full bg-white relative border border-gray-200">
                      <div className="absolute bottom-0 w-full h-1/3 bg-gray-300"></div>
                      <div className="absolute left-0 h-full w-1/4 bg-gray-300"></div>
                      <div className="absolute right-0 h-full w-1/4 bg-gray-300"></div>
                    </div>
                  )}
                </div>
              )}

              {/* Icon for non-visual */}
              {currentQ.type !== 'visual' && option.icon && (
                <span className="text-2xl w-10 text-center">{option.icon}</span>
              )}

              <div className="flex-1">
                <span className="block font-bold text-gray-800 text-lg transition-colors">
                  {option.label}
                </span>
                {option.desc && (
                  <span className="block text-sm text-gray-500 mt-0.5">{option.desc}</span>
                )}
              </div>

              <div
                className="w-6 h-6 rounded-full border-2 border-gray-200 flex items-center justify-center ml-2"
              >
                <div
                  className="w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: theme.primary }}
                ></div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer Credentials */}
      <div className="p-4 text-center border-t border-gray-100 bg-gray-50">
        <p className="text-xs text-gray-400 flex items-center justify-center gap-2">
          <ShieldCheck size={14} /> Datos protegidos médicamente
        </p>
      </div>
    </div>
  );
};

export default Quiz;
