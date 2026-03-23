import { useState } from 'react'
import { CheckCircle2, ChevronRight, ArrowLeft } from 'lucide-react'
import PhoneInput from '../PhoneInput'

export default function LeadFormScreen({
  screen,
  quiz,
  answers,
  onSubmit,
  onBack,
  canGoBack = true,
  isSubmitting = false,
}) {
  const primaryColor = quiz?.branding?.primaryColor || '#4CA994'
  const config = screen?.config || {}

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    consent: false,
  })

  const [errors, setErrors] = useState({})

  const fields = config.fields || ['name', 'phone', 'email']

  const fieldConfig = {
    name: {
      label: 'Nombre completo',
      type: 'text',
      placeholder: 'Ej: Juan Pérez',
      required: true,
    },
    phone: {
      label: 'Teléfono',
      type: 'tel',
      placeholder: '+34 600 000 000',
      required: true,
    },
    email: {
      label: 'Correo electrónico',
      type: 'email',
      placeholder: 'juan@ejemplo.com',
      required: true,
    },
  }

  function handleChange(field, value) {
    setFormData({ ...formData, [field]: value })
    if (errors[field]) {
      setErrors({ ...errors, [field]: null })
    }
  }

  function validate() {
    const newErrors = {}

    if (fields.includes('name') && !formData.name.trim()) {
      newErrors.name = 'El nombre es requerido'
    }

    if (fields.includes('phone') && !formData.phone.trim()) {
      newErrors.phone = 'El teléfono es requerido'
    }

    if (fields.includes('email')) {
      if (!formData.email.trim()) {
        newErrors.email = 'El email es requerido'
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Email inválido'
      }
    }

    if (quiz?.settings?.requireConsent && !formData.consent) {
      newErrors.consent = 'Debes aceptar el tratamiento de datos'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (validate()) {
      onSubmit(formData)
    }
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Top Bar */}
      <div className="h-2 w-full" style={{ backgroundColor: primaryColor }} />

      <div className="max-w-lg mx-auto p-4 md:p-6 pt-8 md:pt-12">
        {/* Back Button */}
        {canGoBack && (
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-gray-600 mb-6 p-2 -ml-2 rounded-full hover:bg-gray-50 transition"
          >
            <ArrowLeft size={24} />
          </button>
        )}

        {/* Result Badge */}
        {config.resultBadge && (
          <div className="bg-green-50 border border-green-100 rounded-2xl p-4 md:p-6 mb-6 md:mb-8 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="text-green-600" size={24} />
            </div>
            <h2 className="text-lg md:text-xl font-bold text-green-800 mb-1">
              {config.resultBadge}
            </h2>
            {config.resultDescription && (
              <p className="text-green-700 text-sm mt-2">
                {config.resultDescription}
              </p>
            )}
          </div>
        )}

        {/* Title */}
        <h3 className="text-xl md:text-2xl font-bold text-gray-800 mb-2 text-center">
          {screen?.title || 'Recibe tu informe'}
        </h3>

        {/* Subtitle */}
        {screen?.subtitle && (
          <p className="text-gray-500 text-center mb-6 md:mb-8 text-sm">
            {screen.subtitle}
          </p>
        )}

        {/* Form */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          {fields.map((field) => {
            const config = fieldConfig[field]
            if (!config) return null

            return (
              <div key={field}>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {config.label}
                </label>
                {field === 'phone' ? (
                  <PhoneInput
                    value={formData.phone}
                    onChange={(phone) => handleChange('phone', phone)}
                    required={config.required}
                    inputClassName={`p-3 md:p-4 ${
                      errors.phone
                        ? 'border-red-300 focus:ring-red-200'
                        : 'focus:ring-2 focus:ring-opacity-50'
                    }`}
                    placeholder="612 345 678"
                  />
                ) : (
                  <input
                    type={config.type}
                    value={formData[field]}
                    onChange={(e) => handleChange(field, e.target.value)}
                    className={`w-full p-3 md:p-4 border rounded-xl focus:ring-2 focus:outline-none transition ${
                      errors[field]
                        ? 'border-red-300 focus:ring-red-200'
                        : 'border-gray-200 focus:ring-opacity-50'
                    }`}
                    style={{
                      '--tw-ring-color': errors[field] ? undefined : primaryColor,
                    }}
                    placeholder={config.placeholder}
                  />
                )}
                {errors[field] && (
                  <p className="text-red-500 text-xs mt-1">{errors[field]}</p>
                )}
              </div>
            )
          })}

          {/* Consent */}
          {quiz?.settings?.requireConsent && (
            <div className="flex items-start gap-2 pt-2">
              <input
                type="checkbox"
                checked={formData.consent}
                onChange={(e) => handleChange('consent', e.target.checked)}
                className="mt-1 rounded focus:ring-opacity-50"
                style={{ accentColor: primaryColor }}
              />
              <div>
                <p className="text-xs text-gray-400 leading-snug">
                  {config.consentText ||
                    'Consiento el tratamiento de mis datos para recibir información personalizada.'}
                </p>
                {errors.consent && (
                  <p className="text-red-500 text-xs mt-1">{errors.consent}</p>
                )}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 md:py-4 rounded-xl text-white font-bold text-base md:text-lg shadow-lg mt-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-xl"
            style={{ backgroundColor: primaryColor }}
          >
            {isSubmitting ? (
              'Enviando...'
            ) : (
              <>
                {quiz?.cta?.buttonText || 'Enviar'} <ChevronRight size={20} />
              </>
            )}
          </button>
        </form>

        {/* Trust Badges */}
        {config.trustBadges && (
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-3">
              Avalado por
            </p>
            <div className="flex justify-center items-center gap-6 opacity-50 grayscale">
              {config.trustBadges.map((badge, i) => (
                <div key={i} className="font-bold text-lg text-gray-400">
                  {badge}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
