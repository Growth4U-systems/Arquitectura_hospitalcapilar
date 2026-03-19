import { createContext, useState, useEffect, useCallback } from 'react';
import { generateSessionId, ANALYTICS_EVENTS, getEventContext } from './events';

// Use window.posthog to avoid import errors when blocked
const getPostHog = () => typeof window !== 'undefined' ? window.posthog : null;

export const AnalyticsContext = createContext({
  sessionId: null,
  experimentVariant: null,
  quizAnswers: {},
  quizStartTime: null,
  setQuizAnswers: () => {},
  markQuizComplete: () => {},
  startQuizTimer: () => {},
});

export function AnalyticsProvider({ children }) {
  // Session ID - persistido en sessionStorage
  const [sessionId] = useState(() => {
    if (typeof window === 'undefined') return generateSessionId();

    const stored = sessionStorage.getItem('hc_session_id');
    if (stored) return stored;

    const newId = generateSessionId();
    sessionStorage.setItem('hc_session_id', newId);
    return newId;
  });

  // Estado del quiz
  const [experimentVariant, setExperimentVariant] = useState('control');
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizStartTime, setQuizStartTime] = useState(null);
  const [isQuizComplete, setIsQuizComplete] = useState(false);

  // Cargar feature flags de PostHog (si está inicializado)
  useEffect(() => {
    const checkPostHog = () => {
      const ph = getPostHog();
      if (ph?.capture && ph.onFeatureFlags) {
        ph.onFeatureFlags(() => {
          const variant = ph.getFeatureFlag?.('quiz-variant');
          setExperimentVariant(variant || 'control');
        });
      }
    };

    // Check immediately and also after a delay
    checkPostHog();
    const timer = setTimeout(checkPostHog, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Track session start
  useEffect(() => {
    if (sessionId && typeof window !== 'undefined') {
      const trackSession = () => {
        const ph = getPostHog();
        if (ph?.capture) {
          const context = getEventContext();
          ph.capture(ANALYTICS_EVENTS.SESSION_START, {
            session_id: sessionId,
            referrer: document.referrer || 'direct',
            user_agent: navigator.userAgent,
            screen_width: window.innerWidth,
            screen_height: window.innerHeight,
            ...context,
          });
        }
      };

      // Try immediately and after PostHog loads
      trackSession();
      const timer = setTimeout(trackSession, 1500);
      return () => clearTimeout(timer);
    }
  }, [sessionId]);

  // Detectar abandono del quiz
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isQuizComplete) return;

      const answersCount = Object.keys(quizAnswers).length;
      if (answersCount === 0) return;

      const timeSpent = quizStartTime ? Date.now() - quizStartTime : 0;

      const ph = getPostHog();
      if (ph?.capture) {
        const context = getEventContext();
        ph.capture(ANALYTICS_EVENTS.QUIZ_ABANDONED, {
          session_id: sessionId,
          last_question_index: answersCount,
          time_spent_ms: timeSpent,
          answers_count: answersCount,
          ...context,
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionId, quizAnswers, quizStartTime, isQuizComplete]);

  const markQuizComplete = useCallback(() => {
    setIsQuizComplete(true);
    sessionStorage.setItem('hc_quiz_complete', 'true');
  }, []);

  const startQuizTimer = useCallback(() => {
    setQuizStartTime(Date.now());
  }, []);

  return (
    <AnalyticsContext.Provider
      value={{
        sessionId,
        experimentVariant,
        quizAnswers,
        quizStartTime,
        setQuizAnswers,
        markQuizComplete,
        startQuizTimer,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}
