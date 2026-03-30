import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PostHogProvider, AnalyticsProvider } from '@hospital-capilar/shared/analytics'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'
import App from './App.jsx'

// Render app with PostHog analytics
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <PostHogProvider>
        <AnalyticsProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AnalyticsProvider>
      </PostHogProvider>
    </ErrorBoundary>
  </StrictMode>,
)
