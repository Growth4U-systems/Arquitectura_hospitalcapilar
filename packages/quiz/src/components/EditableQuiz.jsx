import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Quiz from './Quiz';
import EditorPanel from './EditorPanel';
import { Pencil } from 'lucide-react';

// EditableQuiz - El quiz normal con capacidad de edición inline
// Accede con ?edit=true para ver el panel de edición
export default function EditableQuiz() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';

  const [currentStep, setCurrentStep] = useState(0);
  const [quizData, setQuizData] = useState(getDefaultQuizData());
  const [decisionTree, setDecisionTree] = useState(getDefaultDecisionTree());
  const [quizFlow, setQuizFlow] = useState(null); // Flow editor state

  // Toggle edit mode
  const toggleEditMode = () => {
    if (isEditMode) {
      searchParams.delete('edit');
    } else {
      searchParams.set('edit', 'true');
    }
    setSearchParams(searchParams);
  };

  // Handle quiz updates from editor
  const handleUpdateQuiz = (updates) => {
    setQuizData(prev => ({ ...prev, ...updates }));
  };

  const handleUpdateQuestion = (index, data) => {
    setQuizData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => i === index ? data : q)
    }));
  };

  const handleAddQuestion = () => {
    setQuizData(prev => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          id: `question_${Date.now()}`,
          title: 'Nueva pregunta',
          subtitle: '',
          type: 'single',
          options: [
            { label: 'Opción 1', icon: '' },
            { label: 'Opción 2', icon: '' }
          ]
        }
      ]
    }));
  };

  const handleDeleteQuestion = (index) => {
    if (quizData.questions.length <= 1) {
      alert('Debe haber al menos una pregunta');
      return;
    }
    setQuizData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }));
  };

  const handleReorderQuestions = (newOrder) => {
    // TODO: implement drag and drop reordering
  };

  // Handle decision tree updates
  const handleUpdateDecisionTree = (newDecisionTree) => {
    setDecisionTree(newDecisionTree);
  };

  // Handle flow updates
  const handleUpdateFlow = (newFlow) => {
    setQuizFlow(newFlow);
    console.log('Flow updated:', newFlow);
  };

  // Handle duplicate quiz
  const handleDuplicateQuiz = () => {
    const duplicatedQuiz = {
      ...JSON.parse(JSON.stringify(quizData)),
      slug: `${quizData.slug}-copy-${Date.now()}`,
      name: `${quizData.name} (Copia)`,
    };
    const duplicatedTree = JSON.parse(JSON.stringify(decisionTree));

    // For now, just update current state with the copy
    // In production, this would save to Firestore as a new quiz
    setQuizData(duplicatedQuiz);
    setDecisionTree(duplicatedTree);

    alert(`Quiz duplicado como: ${duplicatedQuiz.name}\n\nNota: En producción, esto crearía un nuevo quiz en la base de datos.`);
  };

  return (
    <div className="flex min-h-screen">
      {/* Quiz Area */}
      <div className={`flex-1 transition-all duration-300 ${isEditMode ? 'mr-0' : ''}`}>
        <Quiz
          editableData={quizData}
          decisionTree={decisionTree}
          onStepChange={setCurrentStep}
          isEditMode={isEditMode}
        />
      </div>

      {/* Editor Panel */}
      {isEditMode && (
        <EditorPanel
          quiz={quizData}
          currentStep={currentStep}
          onUpdateQuiz={handleUpdateQuiz}
          onUpdateQuestion={handleUpdateQuestion}
          onAddQuestion={handleAddQuestion}
          onDeleteQuestion={handleDeleteQuestion}
          onReorderQuestions={handleReorderQuestions}
          onClose={toggleEditMode}
          decisionTree={decisionTree}
          onUpdateDecisionTree={handleUpdateDecisionTree}
          quizFlow={quizFlow}
          onUpdateFlow={handleUpdateFlow}
          onDuplicateQuiz={handleDuplicateQuiz}
        />
      )}

      {/* Edit Toggle Button (visible when not in edit mode) */}
      {!isEditMode && (
        <button
          onClick={toggleEditMode}
          className="fixed bottom-6 right-6 p-4 bg-gray-900 text-white rounded-full shadow-lg hover:bg-gray-800 transition z-50 flex items-center gap-2"
          title="Abrir Editor"
        >
          <Pencil size={20} />
          <span className="font-medium">Editar</span>
        </button>
      )}
    </div>
  );
}

// Default quiz data (from the Hospital Capilar template)
function getDefaultQuizData() {
  return {
    slug: 'hospital-capilar',
    name: 'Hospital Capilar - Test Capilar',
    theme: {
      primary: '#4CA994',
      secondary: '#2C3E50',
      light: '#F0F7F6',
      white: '#FFFFFF'
    },
    settings: {
      showProgressBar: true,
      allowBack: true,
      requireConsent: true
    },
    cta: {
      type: 'none',
      calendlyUrl: null,
      whatsappNumber: null,
      redirectUrl: null,
      buttonText: 'Solicitar Estudio Gratuito'
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
      resultTitle: 'Análisis Preliminar: APTO',
      description: 'Hemos analizado tus 8 respuestas. Según tu perfil, eres un candidato potencial para una intervención con alta densidad.',
      formTitle: 'Recibe tu Informe Médico + Presupuesto',
      formSubtitle: 'Nuestro equipo médico te enviará por WhatsApp/Email la valoración detallada de tu caso y una estimación de unidades foliculares necesarias.',
      fields: ['name', 'phone', 'email'],
      consentText: 'Consiento el tratamiento de mis datos de salud para recibir el pre-análisis médico personalizado.',
      trustBadges: ['ISHRS', 'WFI', 'FUE Europe']
    },
    result: {
      title: '¡Solicitud Enviada!',
      subtitle: 'Nuestro equipo médico te contactará en las próximas 24-48 horas con tu informe personalizado.'
    }
  };
}

// Default decision tree with example rules
function getDefaultDecisionTree() {
  return {
    rules: [
      {
        id: 'rule_excellent',
        priority: 1,
        conditions: {
          logic: 'AND',
          conditions: [
            { field: 'age', operator: 'in', value: ['25 - 35 años', '36 - 45 años'] },
            { field: 'timeline', operator: 'not_equals', value: 'Menos de 1 año (Reciente)' }
          ]
        },
        result: {
          type: 'success',
          title: 'Excelente Candidato',
          description: 'Tu perfil indica que eres un candidato ideal para el procedimiento. La estabilidad de tu caso y tu rango de edad son factores muy favorables.',
          color: 'green',
          cta: { type: 'form', text: 'Solicitar Valoración Gratuita' }
        }
      },
      {
        id: 'rule_young',
        priority: 2,
        conditions: {
          logic: 'AND',
          conditions: [
            { field: 'age', operator: 'equals', value: 'Menos de 25 años' },
            { field: 'timeline', operator: 'equals', value: 'Menos de 1 año (Reciente)' }
          ]
        },
        result: {
          type: 'warning',
          title: 'Recomendamos Evaluación',
          description: 'Debido a tu edad y la reciente aparición de los síntomas, recomendamos una evaluación más detallada para determinar si es el momento adecuado para el procedimiento.',
          color: 'amber',
          cta: { type: 'form', text: 'Solicitar Evaluación' }
        }
      },
      {
        id: 'rule_info_only',
        priority: 3,
        conditions: {
          logic: 'AND',
          conditions: [
            { field: 'urgency', operator: 'equals', value: 'Solo me estoy informando' }
          ]
        },
        result: {
          type: 'info',
          title: 'Información Enviada',
          description: 'Te enviaremos información detallada sobre el procedimiento. Cuando estés listo, podemos agendar un test capilar sin compromiso.',
          color: 'blue',
          cta: { type: 'form', text: 'Recibir Información' }
        }
      }
    ],
    defaultResult: {
      type: 'success',
      title: 'Análisis Preliminar: APTO',
      description: 'Hemos analizado tus respuestas. Según tu perfil, eres un candidato potencial para una intervención. Completa tus datos para recibir una valoración personalizada.',
      color: 'green',
      cta: { type: 'form', text: 'Solicitar Estudio Gratuito' }
    },
    scoreRules: {
      age: {
        'Menos de 25 años': 5,
        '25 - 35 años': 20,
        '36 - 45 años': 20,
        '46 - 55 años': 15,
        'Más de 55 años': 10
      },
      timeline: {
        'Menos de 1 año (Reciente)': 5,
        'Entre 1 y 5 años (Progresiva)': 15,
        'Más de 5 años (Estable)': 20,
        'Siempre he tenido poco pelo': 10
      },
      urgency: {
        'Lo antes posible': 25,
        'En los próximos 3 meses': 20,
        'En 6 meses o más': 10,
        'Solo me estoy informando': 5
      }
    }
  };
}
