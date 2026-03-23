import React from 'react';

/**
 * Global Error Boundary — catches any unhandled React error and shows
 * a branded fallback UI instead of a white screen.
 * Also reports the error to PostHog if available.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught:', error, errorInfo);

    // Report to PostHog if available
    try {
      if (typeof window !== 'undefined' && window.posthog?.capture) {
        window.posthog.capture('frontend_error', {
          error_message: error?.message || 'Unknown error',
          error_stack: error?.stack?.substring(0, 500) || '',
          component_stack: errorInfo?.componentStack?.substring(0, 500) || '',
          url: window.location.href,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (_) {
      // Don't let error reporting fail silently
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#FFFFFF',
          fontFamily: "'Inter', -apple-system, sans-serif",
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
        }}>
          {/* HC brand bar */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '6px',
            backgroundColor: '#4CA994',
          }} />

          <img
            src="/logo-hc.svg"
            alt="Hospital Capilar"
            style={{ height: '56px', marginBottom: '32px' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />

          <div style={{ maxWidth: '420px' }}>
            <div style={{
              backgroundColor: '#FEF3C7',
              border: '2px solid #F59E0B',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '24px',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚠️</div>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: '#1F2937',
                marginBottom: '8px',
              }}>
                Algo no ha ido bien
              </h2>
              <p style={{
                fontSize: '0.9rem',
                color: '#6B7280',
                lineHeight: 1.6,
                marginBottom: '16px',
              }}>
                Ha ocurrido un error inesperado. Tus datos no se han perdido.
                Por favor, inténtalo de nuevo.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={this.handleRetry}
                style={{
                  padding: '12px 28px',
                  backgroundColor: '#4CA994',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                }}
              >
                Reintentar
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '12px 28px',
                  backgroundColor: 'transparent',
                  color: '#6B7280',
                  border: '2px solid #E5E7EB',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                }}
              >
                Recargar página
              </button>
            </div>

            <p style={{
              marginTop: '24px',
              fontSize: '0.8rem',
              color: '#9CA3AF',
            }}>
              Si el problema persiste, llámanos al{' '}
              <a href="tel:+34623457218" style={{ color: '#4CA994', textDecoration: 'none', fontWeight: 600 }}>
                623 457 218
              </a>
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
