import { useState } from 'react';
import {
  X,
  Save,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  GripVertical,
  Settings,
  Palette,
  Type,
  Image,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Copy
} from 'lucide-react';
import DecisionTreeEditor from './DecisionTreeEditor';
import QuizFlowEditor from './QuizFlowEditor';

// Editor Panel - Panel lateral para editar el quiz en tiempo real
export default function EditorPanel({
  quiz,
  currentStep,
  onUpdateQuiz,
  onUpdateQuestion,
  onAddQuestion,
  onDeleteQuestion,
  onReorderQuestions,
  onClose,
  // New props for decision tree, flow, and duplicate
  decisionTree,
  onUpdateDecisionTree,
  quizFlow,
  onUpdateFlow,
  onDuplicateQuiz
}) {
  const [activeTab, setActiveTab] = useState('content'); // content, style, settings
  const [expandedSection, setExpandedSection] = useState('current');
  const [showDecisionTree, setShowDecisionTree] = useState(false);
  const [showFlowEditor, setShowFlowEditor] = useState(false);

  const tabs = [
    { id: 'content', label: 'Contenido', icon: Type },
    { id: 'style', label: 'Estilo', icon: Palette },
    { id: 'settings', label: 'Config', icon: Settings },
  ];

  return (
    <div className="w-96 bg-gray-900 text-white h-screen flex flex-col border-l border-gray-700 shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h2 className="font-bold text-lg">Editor de Quiz</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-800 rounded-lg transition"
        >
          <X size={20} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition ${
              activeTab === tab.id
                ? 'text-white border-b-2 border-emerald-500 bg-gray-800'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'content' && (
          <ContentTab
            quiz={quiz}
            currentStep={currentStep}
            expandedSection={expandedSection}
            setExpandedSection={setExpandedSection}
            onUpdateQuiz={onUpdateQuiz}
            onUpdateQuestion={onUpdateQuestion}
            onAddQuestion={onAddQuestion}
            onDeleteQuestion={onDeleteQuestion}
          />
        )}
        {activeTab === 'style' && (
          <StyleTab
            quiz={quiz}
            onUpdateQuiz={onUpdateQuiz}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            quiz={quiz}
            onUpdateQuiz={onUpdateQuiz}
          />
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700 space-y-2">
        {/* Flow Editor Button - Full Width */}
        <button
          onClick={() => setShowFlowEditor(true)}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition"
        >
          <GitBranch size={16} />
          Editor de Flujo Visual
        </button>

        {/* Action Buttons Row */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowDecisionTree(true)}
            className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition"
          >
            <GitBranch size={16} />
            Resultados
          </button>
          <button
            onClick={onDuplicateQuiz}
            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition"
          >
            <Copy size={16} />
            Duplicar
          </button>
        </div>

        {/* Save Button */}
        <button className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-bold flex items-center justify-center gap-2 transition">
          <Save size={18} />
          Guardar Cambios
        </button>
      </div>

      {/* Decision Tree Editor Modal */}
      {showDecisionTree && (
        <DecisionTreeEditor
          decisionTree={decisionTree}
          questions={quiz.questions || []}
          onUpdate={onUpdateDecisionTree}
          onClose={() => setShowDecisionTree(false)}
        />
      )}

      {/* Quiz Flow Editor Modal */}
      {showFlowEditor && (
        <QuizFlowEditor
          questions={quiz.questions || []}
          flow={quizFlow}
          onUpdateFlow={onUpdateFlow}
          onClose={() => setShowFlowEditor(false)}
        />
      )}
    </div>
  );
}

// Tab: Contenido
function ContentTab({ quiz, currentStep, expandedSection, setExpandedSection, onUpdateQuiz, onUpdateQuestion, onAddQuestion, onDeleteQuestion }) {
  return (
    <div className="p-4 space-y-4">
      {/* Intro Section */}
      <CollapsibleSection
        title="Pantalla de Inicio"
        isExpanded={expandedSection === 'intro'}
        onToggle={() => setExpandedSection(expandedSection === 'intro' ? null : 'intro')}
      >
        <div className="space-y-3">
          <InputField
            label="Título Principal"
            value={quiz.intro?.title || '¿Eres candidato para un *Injerto Capilar?*'}
            onChange={(val) => onUpdateQuiz({ intro: { ...quiz.intro, title: val }})}
            multiline
            hint="Usa *texto* para resaltar en color"
          />
          <InputField
            label="Subtítulo"
            value={quiz.intro?.subtitle || ''}
            onChange={(val) => onUpdateQuiz({ intro: { ...quiz.intro, subtitle: val }})}
            multiline
          />
          <InputField
            label="Texto del Botón"
            value={quiz.intro?.buttonText || 'Comenzar Test Gratuito'}
            onChange={(val) => onUpdateQuiz({ intro: { ...quiz.intro, buttonText: val }})}
          />
          <InputField
            label="Badge Superior"
            value={quiz.intro?.badge || 'Test Capilar Online IA'}
            onChange={(val) => onUpdateQuiz({ intro: { ...quiz.intro, badge: val }})}
          />
        </div>
      </CollapsibleSection>

      {/* Current Question */}
      {currentStep > 0 && currentStep <= (quiz.questions?.length || 0) && (
        <CollapsibleSection
          title={`Pregunta ${currentStep} (Actual)`}
          isExpanded={expandedSection === 'current'}
          onToggle={() => setExpandedSection(expandedSection === 'current' ? null : 'current')}
          highlight
        >
          <QuestionEditor
            question={quiz.questions?.[currentStep - 1]}
            questionIndex={currentStep - 1}
            onUpdate={(data) => onUpdateQuestion(currentStep - 1, data)}
            onDelete={() => onDeleteQuestion(currentStep - 1)}
          />
        </CollapsibleSection>
      )}

      {/* All Questions */}
      <CollapsibleSection
        title="Todas las Preguntas"
        isExpanded={expandedSection === 'all'}
        onToggle={() => setExpandedSection(expandedSection === 'all' ? null : 'all')}
      >
        <div className="space-y-2">
          {quiz.questions?.map((q, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border transition cursor-pointer ${
                currentStep === idx + 1
                  ? 'border-emerald-500 bg-emerald-900/30'
                  : 'border-gray-700 hover:border-gray-600 bg-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <GripVertical size={16} className="text-gray-500" />
                <span className="text-xs text-gray-400">Q{idx + 1}</span>
                <span className="flex-1 text-sm truncate">{q.title}</span>
                <button
                  onClick={() => onDeleteQuestion(idx)}
                  className="p-1 hover:bg-red-600/20 rounded text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={onAddQuestion}
            className="w-full p-3 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 flex items-center justify-center gap-2 transition"
          >
            <Plus size={18} />
            Añadir Pregunta
          </button>
        </div>
      </CollapsibleSection>

      {/* Lead Form */}
      <CollapsibleSection
        title="Formulario de Lead"
        isExpanded={expandedSection === 'lead'}
        onToggle={() => setExpandedSection(expandedSection === 'lead' ? null : 'lead')}
      >
        <div className="space-y-3">
          <InputField
            label="Título del Resultado"
            value={quiz.leadForm?.resultTitle || 'Análisis Preliminar: APTO'}
            onChange={(val) => onUpdateQuiz({ leadForm: { ...quiz.leadForm, resultTitle: val }})}
          />
          <InputField
            label="Descripción"
            value={quiz.leadForm?.description || ''}
            onChange={(val) => onUpdateQuiz({ leadForm: { ...quiz.leadForm, description: val }})}
            multiline
          />
          <div className="space-y-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Campos del Formulario</label>
            <div className="space-y-1">
              {['name', 'phone', 'email'].map(field => (
                <label key={field} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={quiz.leadForm?.fields?.includes(field) ?? true}
                    onChange={() => {/* toggle field */}}
                    className="rounded bg-gray-700 border-gray-600"
                  />
                  {field === 'name' ? 'Nombre' : field === 'phone' ? 'Teléfono' : 'Email'}
                </label>
              ))}
            </div>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}

// Tab: Estilo
function StyleTab({ quiz, onUpdateQuiz }) {
  const theme = quiz.theme || { primary: '#4CA994', secondary: '#2C3E50' };

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-3">
        <label className="text-xs text-gray-400 uppercase tracking-wider block">Color Principal</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={theme.primary}
            onChange={(e) => onUpdateQuiz({ theme: { ...theme, primary: e.target.value }})}
            className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-700"
          />
          <input
            type="text"
            value={theme.primary}
            onChange={(e) => onUpdateQuiz({ theme: { ...theme, primary: e.target.value }})}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-xs text-gray-400 uppercase tracking-wider block">Color Secundario</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={theme.secondary}
            onChange={(e) => onUpdateQuiz({ theme: { ...theme, secondary: e.target.value }})}
            className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-700"
          />
          <input
            type="text"
            value={theme.secondary}
            onChange={(e) => onUpdateQuiz({ theme: { ...theme, secondary: e.target.value }})}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-xs text-gray-400 uppercase tracking-wider block">Logo</label>
        <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center">
          <Image size={32} className="mx-auto text-gray-500 mb-2" />
          <p className="text-sm text-gray-400">Arrastra una imagen o haz clic</p>
          <p className="text-xs text-gray-500 mt-1">PNG, JPG hasta 2MB</p>
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-xs text-gray-400 uppercase tracking-wider block">Presets de Color</label>
        <div className="grid grid-cols-4 gap-2">
          {['#4CA994', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#6366F1'].map(color => (
            <button
              key={color}
              onClick={() => onUpdateQuiz({ theme: { ...theme, primary: color }})}
              className={`w-full aspect-square rounded-lg border-2 transition ${
                theme.primary === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Tab: Settings
function SettingsTab({ quiz, onUpdateQuiz }) {
  return (
    <div className="p-4 space-y-4">
      <div className="space-y-3">
        <label className="text-xs text-gray-400 uppercase tracking-wider block">Slug (URL)</label>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-sm">/</span>
          <input
            type="text"
            value={quiz.slug || 'hospital-capilar'}
            onChange={(e) => onUpdateQuiz({ slug: e.target.value })}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <p className="text-xs text-gray-500">La URL será: tudominio.com/{quiz.slug || 'hospital-capilar'}</p>
      </div>

      <div className="space-y-3">
        <label className="text-xs text-gray-400 uppercase tracking-wider block">Dominio Personalizado</label>
        <input
          type="text"
          value={quiz.customDomain || ''}
          onChange={(e) => onUpdateQuiz({ customDomain: e.target.value })}
          placeholder="quiz.tuempresa.com"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-500">Configura un CNAME apuntando a nuestros servidores</p>
      </div>

      <div className="border-t border-gray-700 pt-4 space-y-3">
        <label className="text-xs text-gray-400 uppercase tracking-wider block">Opciones</label>

        <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
          <span className="text-sm">Mostrar barra de progreso</span>
          <input
            type="checkbox"
            checked={quiz.settings?.showProgressBar ?? true}
            onChange={(e) => onUpdateQuiz({ settings: { ...quiz.settings, showProgressBar: e.target.checked }})}
            className="rounded bg-gray-700 border-gray-600"
          />
        </label>

        <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
          <span className="text-sm">Permitir volver atrás</span>
          <input
            type="checkbox"
            checked={quiz.settings?.allowBack ?? true}
            onChange={(e) => onUpdateQuiz({ settings: { ...quiz.settings, allowBack: e.target.checked }})}
            className="rounded bg-gray-700 border-gray-600"
          />
        </label>

        <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
          <span className="text-sm">Requerir consentimiento RGPD</span>
          <input
            type="checkbox"
            checked={quiz.settings?.requireConsent ?? true}
            onChange={(e) => onUpdateQuiz({ settings: { ...quiz.settings, requireConsent: e.target.checked }})}
            className="rounded bg-gray-700 border-gray-600"
          />
        </label>
      </div>

      <div className="border-t border-gray-700 pt-4 space-y-3">
        <label className="text-xs text-gray-400 uppercase tracking-wider block">Tipo de CTA</label>

        <select
          value={quiz.cta?.type || 'none'}
          onChange={(e) => onUpdateQuiz({ cta: { ...quiz.cta, type: e.target.value }})}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="none">Sin CTA adicional</option>
          <option value="calendly">Calendly (Agendar cita)</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="redirect">Redirección a URL</option>
          <option value="link">Link personalizado</option>
        </select>

        {quiz.cta?.type && quiz.cta?.type !== 'none' && (
          <div className="space-y-3 mt-3 p-3 bg-gray-800/50 rounded-lg">
            {/* Button Text */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Texto del botón</label>
              <input
                type="text"
                value={quiz.cta?.buttonText || ''}
                onChange={(e) => onUpdateQuiz({ cta: { ...quiz.cta, buttonText: e.target.value }})}
                placeholder="Ej: Agendar Cita Gratis"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {/* Calendly URL */}
            {quiz.cta?.type === 'calendly' && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">URL de Calendly</label>
                <input
                  type="text"
                  value={quiz.cta?.calendlyUrl || ''}
                  onChange={(e) => onUpdateQuiz({ cta: { ...quiz.cta, calendlyUrl: e.target.value }})}
                  placeholder="https://calendly.com/tu-usuario"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            )}

            {/* WhatsApp */}
            {quiz.cta?.type === 'whatsapp' && (
              <>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Número de WhatsApp</label>
                  <input
                    type="text"
                    value={quiz.cta?.whatsappNumber || ''}
                    onChange={(e) => onUpdateQuiz({ cta: { ...quiz.cta, whatsappNumber: e.target.value }})}
                    placeholder="+34600000000"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Mensaje predefinido (opcional)</label>
                  <textarea
                    value={quiz.cta?.whatsappMessage || ''}
                    onChange={(e) => onUpdateQuiz({ cta: { ...quiz.cta, whatsappMessage: e.target.value }})}
                    placeholder="Hola, acabo de completar el test capilar..."
                    rows={2}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none"
                  />
                </div>
              </>
            )}

            {/* Redirect URL */}
            {quiz.cta?.type === 'redirect' && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">URL de destino</label>
                <input
                  type="text"
                  value={quiz.cta?.redirectUrl || ''}
                  onChange={(e) => onUpdateQuiz({ cta: { ...quiz.cta, redirectUrl: e.target.value }})}
                  placeholder="https://tuempresa.com/gracias"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            )}

            {/* Custom Link */}
            {quiz.cta?.type === 'link' && (
              <>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">URL del enlace</label>
                  <input
                    type="text"
                    value={quiz.cta?.linkUrl || ''}
                    onChange={(e) => onUpdateQuiz({ cta: { ...quiz.cta, linkUrl: e.target.value }})}
                    placeholder="https://ejemplo.com/pagina"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={quiz.cta?.openInNewTab ?? true}
                    onChange={(e) => onUpdateQuiz({ cta: { ...quiz.cta, openInNewTab: e.target.checked }})}
                    className="rounded bg-gray-700 border-gray-600"
                  />
                  Abrir en nueva pestaña
                </label>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Question Editor Component
function QuestionEditor({ question, questionIndex, onUpdate, onDelete }) {
  if (!question) return null;

  return (
    <div className="space-y-3">
      <InputField
        label="Pregunta"
        value={question.title}
        onChange={(val) => onUpdate({ ...question, title: val })}
        multiline
      />
      <InputField
        label="Subtítulo (opcional)"
        value={question.subtitle || ''}
        onChange={(val) => onUpdate({ ...question, subtitle: val })}
      />

      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase tracking-wider">Tipo</label>
        <select
          value={question.type || 'single'}
          onChange={(e) => onUpdate({ ...question, type: e.target.value })}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="single">Selección Única</option>
          <option value="visual">Selección Visual</option>
          <option value="multiple">Selección Múltiple</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase tracking-wider">Opciones</label>
        {question.options?.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              value={opt.icon || ''}
              onChange={(e) => {
                const newOptions = [...question.options];
                newOptions[idx] = { ...opt, icon: e.target.value };
                onUpdate({ ...question, options: newOptions });
              }}
              placeholder="Icon"
              className="w-12 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm text-center"
            />
            <input
              type="text"
              value={opt.label}
              onChange={(e) => {
                const newOptions = [...question.options];
                newOptions[idx] = { ...opt, label: e.target.value };
                onUpdate({ ...question, options: newOptions });
              }}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={() => {
                const newOptions = question.options.filter((_, i) => i !== idx);
                onUpdate({ ...question, options: newOptions });
              }}
              className="p-2 hover:bg-red-600/20 rounded text-red-400"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          onClick={() => {
            const newOptions = [...(question.options || []), { label: 'Nueva opción', icon: '' }];
            onUpdate({ ...question, options: newOptions });
          }}
          className="w-full p-2 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:text-white text-sm flex items-center justify-center gap-1"
        >
          <Plus size={14} /> Añadir Opción
        </button>
      </div>

      <button
        onClick={onDelete}
        className="w-full p-2 bg-red-600/20 text-red-400 rounded-lg text-sm hover:bg-red-600/30 flex items-center justify-center gap-2"
      >
        <Trash2 size={14} /> Eliminar Pregunta
      </button>
    </div>
  );
}

// Collapsible Section
function CollapsibleSection({ title, children, isExpanded, onToggle, highlight }) {
  return (
    <div className={`border rounded-lg overflow-hidden ${highlight ? 'border-emerald-500' : 'border-gray-700'}`}>
      <button
        onClick={onToggle}
        className={`w-full p-3 flex items-center justify-between text-left ${highlight ? 'bg-emerald-900/30' : 'bg-gray-800 hover:bg-gray-750'}`}
      >
        <span className="font-medium text-sm">{title}</span>
        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      </button>
      {isExpanded && (
        <div className="p-3 bg-gray-850 border-t border-gray-700">
          {children}
        </div>
      )}
    </div>
  );
}

// Input Field Component
function InputField({ label, value, onChange, multiline, hint }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-400 uppercase tracking-wider block">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
        />
      )}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
