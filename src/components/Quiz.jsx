import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  CheckCircle2,
  User,
  Calendar,
  Activity,
  ArrowLeft,
  ShieldCheck,
  Stethoscope,
  Clock,
  Sparkles,
  Dna,
  Scissors,
  Hourglass
} from 'lucide-react';

const Quiz = () => {
  const [step, setStep] = useState(0); // 0: Intro, 1+: Questions
  const [answers, setAnswers] = useState({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  // Colores corporativos extraídos de la web
  const theme = {
    primary: '#4CA994', // Verde Hospital Capilar aproximado
    secondary: '#2C3E50',
    light: '#F0F7F6',
    white: '#FFFFFF'
  };

  const questions = [
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
      type: 'visual', // Special layout for visual selection
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
  ];

  const handleAnswer = (questionId, answer) => {
    setAnswers({ ...answers, [questionId]: answer });

    if (step < questions.length) {
      setTimeout(() => setStep(step + 1), 250); // Small delay for UX
    } else {
      startAnalysis();
    }
  };

  const startAnalysis = () => {
    setIsAnalyzing(true);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 1; // Slower analysis for more gravitas
      setAnalysisProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setIsAnalyzing(false);
        setStep(questions.length + 1); // Go to Result/Form
      }
    }, 50);
  };

  const handleBack = () => {
    if (step > 0 && !isAnalyzing) {
      setStep(step - 1);
    }
  };

  // --- COMPONENTES DE PANTALLA ---

  // 1. INTRO
  if (step === 0) {
    return (
      <div className="min-h-screen bg-white font-sans text-gray-800 relative overflow-hidden">
        {/* Top Bar simulating website */}
        <div className="h-2 w-full" style={{ backgroundColor: theme.primary }}></div>
        <nav className="p-4 flex justify-between items-center max-w-5xl mx-auto">
          <div className="font-bold text-xl tracking-tight text-gray-800 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full" style={{ backgroundColor: theme.primary }}></div>
            HOSPITAL<span style={{ color: theme.primary }}>CAPILAR</span>
          </div>
          <button className="text-sm font-medium text-gray-500">Volver a la web</button>
        </nav>

        <div className="max-w-xl mx-auto px-6 py-12 flex flex-col items-center text-center mt-8">
          <div className="bg-emerald-50 text-emerald-800 px-4 py-1.5 rounded-full text-sm font-bold mb-6 inline-flex items-center gap-2">
            <Sparkles size={16} /> Diagnóstico Capilar Online IA
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6 leading-tight">
            ¿Eres candidato para un <br/>
            <span style={{ color: theme.primary }}>Injerto Capilar?</span>
          </h1>

          <p className="text-lg text-gray-600 mb-10 max-w-md mx-auto leading-relaxed">
            Nuestro algoritmo médico analiza 8 factores clave de tu perfil para ofrecerte un pre-diagnóstico de viabilidad gratuito.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-10 text-left">
            {[
              { icon: <Clock size={20} />, text: 'Análisis Completo' },
              { icon: <Stethoscope size={20} />, text: 'Revisión Médica' },
              { icon: <ShieldCheck size={20} />, text: '100% Privado' }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div style={{ color: theme.primary }}>{item.icon}</div>
                <span className="text-sm font-semibold text-gray-700">{item.text}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setStep(1)}
            className="w-full md:w-auto px-12 py-4 rounded-xl text-white font-bold text-lg shadow-lg hover:shadow-xl transform transition hover:-translate-y-1"
            style={{ backgroundColor: theme.primary }}
          >
            Comenzar Diagnóstico Gratuito
          </button>

          <p className="mt-6 text-xs text-gray-400">
            Más de 5.000 pacientes evaluados este año.
          </p>
        </div>
      </div>
    );
  }

  // 2. ANÁLISIS (Loading Screen)
  if (isAnalyzing) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="relative w-24 h-24 mx-auto mb-8">
             <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
             <div className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: `${theme.primary} transparent transparent transparent` }}></div>
             <Dna className="absolute inset-0 m-auto text-gray-400" size={32} />
          </div>

          <h2 className="text-2xl font-bold text-gray-800 mb-2">Procesando diagnóstico...</h2>
          <p className="text-gray-500 mb-8">Analizando viabilidad de zona donante vs receptora</p>

          <div className="w-full bg-gray-200 rounded-full h-3 mb-4 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-100 ease-out"
              style={{ width: `${analysisProgress}%`, backgroundColor: theme.primary }}
            ></div>
          </div>

          {/* Dynamic Analysis Steps */}
          <div className="text-xs text-gray-500 font-mono space-y-1">
             <p className={analysisProgress > 20 ? 'text-emerald-600 font-bold' : ''}>✓ Verificando patrón de caída...</p>
             <p className={analysisProgress > 50 ? 'text-emerald-600 font-bold' : ''}>✓ Calculando unidades foliculares estimadas...</p>
             <p className={analysisProgress > 80 ? 'text-emerald-600 font-bold' : ''}>✓ Generando informe médico...</p>
          </div>
        </div>
      </div>
    );
  }

  // 3. FORMULARIO DE CAPTACIÓN (Final)
  if (step > questions.length) {
    return (
      <div className="min-h-screen bg-white font-sans">
        <div className="h-2 w-full" style={{ backgroundColor: theme.primary }}></div>
        <div className="max-w-lg mx-auto p-6 pt-12">
          <div className="bg-green-50 border border-green-100 rounded-2xl p-6 mb-8 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="text-green-600" size={24} />
            </div>
            <h2 className="text-xl font-bold text-green-800 mb-1">Diagnóstico Preliminar: APTO</h2>
            <p className="text-green-700 text-sm mt-2">
              Hemos analizado tus 8 respuestas. Según tu perfil ({answers.age}, {answers.hairtype}), eres un candidato potencial para una intervención con alta densidad.
            </p>
          </div>

          <h3 className="text-2xl font-bold text-gray-800 mb-2 text-center">Recibe tu Informe Médico + Presupuesto</h3>
          <p className="text-gray-500 text-center mb-8 text-sm">
             Nuestro equipo médico te enviará por WhatsApp/Email la valoración detallada de tu caso y una estimación de unidades foliculares necesarias.
          </p>

          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre completo</label>
              <input type="text" className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4CA994] focus:outline-none transition" placeholder="Ej: Juan Pérez" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Teléfono (Te enviaremos el informe aquí)</label>
              <input type="tel" className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4CA994] focus:outline-none transition" placeholder="+34 600 000 000" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Correo electrónico</label>
              <input type="email" className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4CA994] focus:outline-none transition" placeholder="juan@ejemplo.com" />
            </div>

            <div className="flex items-start gap-2 pt-2">
              <input type="checkbox" className="mt-1 rounded text-[#4CA994] focus:ring-[#4CA994]" />
              <p className="text-xs text-gray-400 leading-snug">
                Consiento el tratamiento de mis datos de salud para recibir el pre-diagnóstico médico personalizado.
              </p>
            </div>

            <button className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg mt-4 flex items-center justify-center gap-2" style={{ backgroundColor: theme.primary }}>
               Solicitar Estudio Gratuito <ChevronRight size={20} />
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
             <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-3">Avalado por</p>
             <div className="flex justify-center items-center gap-6 opacity-50 grayscale">
                <div className="font-bold text-lg text-gray-400">ISHRS</div>
                <div className="font-bold text-lg text-gray-400">WFI</div>
                <div className="font-bold text-lg text-gray-400">FUE Europe</div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. PREGUNTAS (Main Flow)
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
        <div className="mb-8">
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
              className="group relative flex items-center gap-4 p-5 rounded-xl border-2 border-gray-100 hover:border-[#4CA994] hover:bg-[#F0F7F6] transition-all duration-200 text-left"
            >
              {/* Visual Selection (Custom for Hair Areas) */}
              {currentQ.type === 'visual' && (
                 <div className="w-16 h-16 bg-gray-200 rounded-lg shrink-0 flex items-center justify-center text-2xl overflow-hidden relative">
                    {/* CSS Mockup of hair loss patterns */}
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
                         {[...Array(9)].map((_,i) => <div key={i} className="w-1 h-1 bg-white rounded-full"></div>)}
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
                <span className="block font-bold text-gray-800 text-lg group-hover:text-[#4CA994] transition-colors">
                  {option.label}
                </span>
                {option.desc && (
                  <span className="block text-sm text-gray-500 mt-0.5">{option.desc}</span>
                )}
              </div>

              <div className="w-6 h-6 rounded-full border-2 border-gray-200 group-hover:border-[#4CA994] flex items-center justify-center ml-2">
                <div className="w-3 h-3 rounded-full bg-[#4CA994] opacity-0 group-hover:opacity-100 transition-opacity"></div>
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
