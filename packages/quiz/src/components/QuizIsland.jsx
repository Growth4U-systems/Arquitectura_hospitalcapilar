import { useState } from 'react';
import { PostHogProvider, AnalyticsProvider } from '@hospital-capilar/shared/analytics';
import ErrorBoundary from './ErrorBoundary';
import HospitalCapilarQuiz from './HospitalCapilarQuiz';
import NichoLanding from './NichoLanding';
import { NICHOS } from './nichoConfig';

export default function QuizIsland({ nicho = null }) {
  const [showQuiz, setShowQuiz] = useState(!nicho || !NICHOS[nicho]);

  return (
    <ErrorBoundary>
      <PostHogProvider>
        <AnalyticsProvider>
          {showQuiz ? (
            <HospitalCapilarQuiz nicho={nicho} skipIntro={!!nicho && !!NICHOS[nicho]} />
          ) : (
            <NichoLanding nicho={nicho} onStartQuiz={() => { window.scrollTo(0, 0); setShowQuiz(true); }} />
          )}
        </AnalyticsProvider>
      </PostHogProvider>
    </ErrorBoundary>
  );
}
