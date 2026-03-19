import { useCallback, useContext, useRef } from 'react';
import { AnalyticsContext } from './AnalyticsContext';
import { ANALYTICS_EVENTS, calculateLeadScore, getUTMParams, getEventContext } from './events';

// Use window.posthog to avoid import errors when blocked
const getPostHog = () => typeof window !== 'undefined' ? window.posthog : null;

// Helper to safely capture events
const safeCapture = (event, properties) => {
  try {
    const ph = getPostHog();
    if (ph?.capture) {
      ph.capture(event, properties);
    }
  } catch (e) {
    console.warn('[Analytics] Failed to capture event:', event, e);
  }
};

export function useAnalytics() {
  const {
    sessionId,
    experimentVariant,
    quizAnswers,
    setQuizAnswers,
    markQuizComplete,
    startQuizTimer,
  } = useContext(AnalyticsContext);

  // Refs para tracking de tiempo
  const questionStartTime = useRef(null);
  const quizStartTime = useRef(null);

  // ============================================
  // QUIZ EVENTS
  // ============================================

  const trackQuizStarted = useCallback(() => {
    quizStartTime.current = Date.now();
    questionStartTime.current = Date.now();
    startQuizTimer?.();

    const context = getEventContext();

    safeCapture(ANALYTICS_EVENTS.QUIZ_STARTED, {
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      referrer: document.referrer || 'direct',
      experiment_variant: experimentVariant,
      ...context,
    });
  }, [sessionId, experimentVariant, startQuizTimer]);

  const trackQuestionAnswered = useCallback((questionId, questionIndex, answerValue) => {
    const timeToAnswer = questionStartTime.current
      ? Date.now() - questionStartTime.current
      : 0;

    safeCapture(ANALYTICS_EVENTS.QUESTION_ANSWERED, {
      session_id: sessionId,
      question_id: questionId,
      question_index: questionIndex,
      answer_value: answerValue,
      time_to_answer_ms: timeToAnswer,
      experiment_variant: experimentVariant,
    });

    setQuizAnswers?.((prev) => ({ ...prev, [questionId]: answerValue }));
    questionStartTime.current = Date.now();
  }, [sessionId, experimentVariant, setQuizAnswers]);

  const trackQuizCompleted = useCallback((answers) => {
    const totalTime = quizStartTime.current
      ? Date.now() - quizStartTime.current
      : 0;

    const context = getEventContext();

    safeCapture(ANALYTICS_EVENTS.QUIZ_COMPLETED, {
      session_id: sessionId,
      total_time_ms: totalTime,
      answers_count: Object.keys(answers).length,
      answers_summary: JSON.stringify(answers),
      experiment_variant: experimentVariant,
      ...context,
    });
  }, [sessionId, experimentVariant]);

  // ============================================
  // ANALYSIS EVENTS
  // ============================================

  const trackAnalysisStarted = useCallback(() => {
    safeCapture(ANALYTICS_EVENTS.ANALYSIS_STARTED, {
      session_id: sessionId,
      timestamp: new Date().toISOString(),
    });
  }, [sessionId]);

  const trackAnalysisCompleted = useCallback((result = 'APTO') => {
    safeCapture(ANALYTICS_EVENTS.ANALYSIS_COMPLETED, {
      session_id: sessionId,
      result: result,
      timestamp: new Date().toISOString(),
    });
  }, [sessionId]);

  // ============================================
  // FORM EVENTS
  // ============================================

  const trackFormViewed = useCallback(() => {
    safeCapture(ANALYTICS_EVENTS.FORM_VIEWED, {
      session_id: sessionId,
      timestamp: new Date().toISOString(),
    });
  }, [sessionId]);

  const trackFormFieldFocused = useCallback((fieldName, fieldOrder = null) => {
    safeCapture(ANALYTICS_EVENTS.FORM_FIELD_FOCUSED, {
      session_id: sessionId,
      field_name: fieldName,
      field_order: fieldOrder,
      timestamp: new Date().toISOString(),
    });
  }, [sessionId]);

  const trackFormSubmitted = useCallback((leadData, answers) => {
    const leadScore = calculateLeadScore(answers);
    const answersHash = btoa(JSON.stringify(answers)).slice(0, 20);
    const context = getEventContext();

    safeCapture(ANALYTICS_EVENTS.FORM_SUBMITTED, {
      session_id: sessionId,
      lead_score: leadScore,
      answers_hash: answersHash,
      experiment_variant: experimentVariant,
      ...context,
    });

    // Identificar usuario con propiedades de persona
    try {
      const ph = getPostHog();
      if (leadData.email && ph?.identify) {
        ph.identify(leadData.email, {
          name: leadData.name,
          phone: leadData.phone,
          quiz_completed: true,
          lead_score: leadScore,
          signup_date: new Date().toISOString(),
          funnel_type: context.funnel_type,
          traffic_source: context.traffic_source,
          nicho: context.nicho,
        });
      }
    } catch (e) {
      console.warn('[Analytics] Failed to identify user:', e);
    }

    markQuizComplete?.();
    return leadScore;
  }, [sessionId, experimentVariant, markQuizComplete]);

  const trackFormValidationError = useCallback((fieldName, errorType) => {
    safeCapture(ANALYTICS_EVENTS.FORM_VALIDATION_ERROR, {
      session_id: sessionId,
      field_name: fieldName,
      error_type: errorType,
    });
  }, [sessionId]);

  // ============================================
  // NAVIGATION EVENTS
  // ============================================

  const trackBackButtonClicked = useCallback((fromQuestion, toQuestion) => {
    safeCapture(ANALYTICS_EVENTS.BACK_BUTTON_CLICKED, {
      session_id: sessionId,
      from_question: fromQuestion,
      to_question: toQuestion,
    });
    questionStartTime.current = Date.now();
  }, [sessionId]);

  // ============================================
  // UTILITY
  // ============================================

  const trackEvent = useCallback((eventName, properties = {}) => {
    const context = getEventContext();
    safeCapture(eventName, {
      session_id: sessionId,
      ...context,
      ...properties, // allow caller to override context
    });
  }, [sessionId]);

  return {
    trackQuizStarted,
    trackQuestionAnswered,
    trackQuizCompleted,
    trackAnalysisStarted,
    trackAnalysisCompleted,
    trackFormViewed,
    trackFormFieldFocused,
    trackFormSubmitted,
    trackFormValidationError,
    trackBackButtonClicked,
    trackEvent,
    sessionId,
    experimentVariant,
    quizAnswers,
  };
}
