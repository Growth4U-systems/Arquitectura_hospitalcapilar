import { useState, useCallback } from 'react'
import { useQuizConfig } from '@hospital-capilar/shared/hooks'
import { createLead } from '@hospital-capilar/shared/firebase'
import {
  WelcomeScreen,
  SingleChoiceScreen,
  VisualChoiceScreen,
  LoadingScreen,
  LeadFormScreen,
  ResultScreen,
} from './screens'

export default function QuizRenderer({ slug }) {
  const { quiz, screens, loading, error } = useQuizConfig(slug)
  const [currentScreenIndex, setCurrentScreenIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [showLoading, setShowLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get current screen and calculate question progress
  const currentScreen = screens[currentScreenIndex]
  const questionScreens = screens.filter(
    (s) => s.type === 'single_choice' || s.type === 'multiple_choice' || s.type === 'visual_choice'
  )
  const currentQuestionIndex = questionScreens.findIndex((s) => s.id === currentScreen?.id)
  const totalQuestions = questionScreens.length

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (currentScreenIndex < screens.length - 1) {
      setCurrentScreenIndex(currentScreenIndex + 1)
    }
  }, [currentScreenIndex, screens.length])

  const handleBack = useCallback(() => {
    if (currentScreenIndex > 0) {
      setCurrentScreenIndex(currentScreenIndex - 1)
    }
  }, [currentScreenIndex])

  const handleAnswer = useCallback(
    (value) => {
      if (!currentScreen) return

      setAnswers((prev) => ({ ...prev, [currentScreen.id]: value }))

      // Move to next screen
      if (currentScreenIndex < screens.length - 1) {
        const nextScreen = screens[currentScreenIndex + 1]

        // Show loading animation before lead_form or result screens
        if (nextScreen.type === 'lead_form' || nextScreen.type === 'result') {
          setShowLoading(true)
        } else {
          setTimeout(() => setCurrentScreenIndex(currentScreenIndex + 1), 200)
        }
      }
    },
    [currentScreen, currentScreenIndex, screens]
  )

  const handleLoadingComplete = useCallback(() => {
    setShowLoading(false)
    setCurrentScreenIndex((prev) => prev + 1)
  }, [])

  const handleFormSubmit = useCallback(
    async (formData) => {
      setIsSubmitting(true)
      try {
        await createLead({
          quizId: quiz.id,
          userId: quiz.userId,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          consent: formData.consent,
          answers,
          referrer: document.referrer || 'direct',
          utm_source: new URLSearchParams(window.location.search).get('utm_source'),
          utm_medium: new URLSearchParams(window.location.search).get('utm_medium'),
          utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign'),
        })

        // Move to result screen if it exists
        if (currentScreenIndex < screens.length - 1) {
          setCurrentScreenIndex(currentScreenIndex + 1)
        }
      } catch (err) {
        console.error('Error creating lead:', err)
        alert('Hubo un error al enviar el formulario. Por favor, intenta de nuevo.')
      } finally {
        setIsSubmitting(false)
      }
    },
    [quiz, answers, currentScreenIndex, screens.length]
  )

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-400" />
      </div>
    )
  }

  // Error state
  if (error || !quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Quiz no encontrado</h1>
          <p className="text-gray-500">
            {error || 'El quiz que buscas no existe o no está disponible.'}
          </p>
        </div>
      </div>
    )
  }

  // Empty quiz state
  if (screens.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Quiz vacío</h1>
          <p className="text-gray-500">Este quiz no tiene pantallas configuradas.</p>
        </div>
      </div>
    )
  }

  // Show loading screen
  if (showLoading) {
    // Find loading screen config if exists, otherwise use defaults
    const loadingScreenConfig = screens.find((s) => s.type === 'loading') || {
      title: 'Analizando tu caso...',
      subtitle: 'Analizando tus respuestas',
      config: {
        duration: 3000,
        steps: [
          { threshold: 20, text: 'Verificando información...' },
          { threshold: 50, text: 'Procesando respuestas...' },
          { threshold: 80, text: 'Generando resultados...' },
        ],
      },
    }

    return (
      <LoadingScreen
        screen={loadingScreenConfig}
        quiz={quiz}
        onComplete={handleLoadingComplete}
      />
    )
  }

  // Render based on screen type
  if (!currentScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Error: pantalla no encontrada</p>
      </div>
    )
  }

  switch (currentScreen.type) {
    case 'welcome':
      return <WelcomeScreen screen={currentScreen} quiz={quiz} onNext={handleNext} />

    case 'single_choice':
    case 'multiple_choice':
      return (
        <SingleChoiceScreen
          screen={currentScreen}
          quiz={quiz}
          currentStep={currentQuestionIndex + 1}
          totalSteps={totalQuestions}
          onAnswer={handleAnswer}
          onBack={handleBack}
          canGoBack={quiz.settings?.allowBack !== false && currentScreenIndex > 0}
        />
      )

    case 'visual_choice':
      return (
        <VisualChoiceScreen
          screen={currentScreen}
          quiz={quiz}
          currentStep={currentQuestionIndex + 1}
          totalSteps={totalQuestions}
          onAnswer={handleAnswer}
          onBack={handleBack}
          canGoBack={quiz.settings?.allowBack !== false && currentScreenIndex > 0}
        />
      )

    case 'lead_form':
      return (
        <LeadFormScreen
          screen={currentScreen}
          quiz={quiz}
          answers={answers}
          onSubmit={handleFormSubmit}
          onBack={handleBack}
          canGoBack={quiz.settings?.allowBack !== false}
          isSubmitting={isSubmitting}
        />
      )

    case 'result':
      return <ResultScreen screen={currentScreen} quiz={quiz} />

    default:
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-gray-500 mb-2">Tipo de pantalla no soportado:</p>
            <code className="text-sm bg-gray-100 px-2 py-1 rounded">{currentScreen.type}</code>
          </div>
        </div>
      )
  }
}
