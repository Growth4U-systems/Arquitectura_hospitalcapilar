import { useState, useEffect, useMemo } from 'react';
import { PostHogProvider, AnalyticsProvider, useAnalytics, getUTMParams } from '@hospital-capilar/shared/analytics';
import ErrorBoundary from './ErrorBoundary';
import PaywallOverlay from './PaywallOverlay';
import PaymentConfirmation from './PaymentConfirmation';
import { safeFetch } from '../utils/safeFetch';

// Stripe fallback link (used if Netlify function fails)
const STRIPE_CHECKOUT_URL = 'https://buy.stripe.com/eVqcN7eDV4gMdfgf6KcIM00';

// Map ECP slugs (URL-safe) → canonical ECP names expected by PaywallOverlay
const ECP_SLUG_MAP = {
  'postparto': 'Lo Que Vino Con el Bebé',
  'bebe': 'Lo Que Vino Con el Bebé',
  'menopausia': 'Es Normal',
  'es-normal': 'Es Normal',
  'protocolo-mujer': 'Protocolo Mujer',
  'mujer': 'Protocolo Mujer',
  'que-me-pasa': '¿Qué Me Pasa?',
  'farmacia': 'La Farmacia',
};

function resolveEcp(rawEcp) {
  if (!rawEcp) return 'Protocolo Mujer';
  const normalized = rawEcp.toLowerCase().trim();
  return ECP_SLUG_MAP[normalized] || rawEcp;
}

function readQueryParams() {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return {
    nombre: params.get('nombre') || params.get('full_name') || params.get('first_name') || '',
    email: params.get('email') || '',
    telefono: params.get('telefono') || params.get('phone') || params.get('phone_number') || '',
    ciudad: params.get('ciudad') || params.get('city') || '',
    ecp: params.get('ecp') || '',
  };
}

function DirectPaywallInner() {
  const analytics = useAnalytics();
  const [paymentStep, setPaymentStep] = useState('paywall'); // paywall | paying | paid | call-requested
  const [lead, setLead] = useState({ nombre: '', email: '', telefono: '', ciudad: '', ecp: '' });
  const bonoPrice = 125;

  useEffect(() => {
    const parsed = readQueryParams();
    setLead(parsed);
    try {
      analytics.trackEvent('paywall_directo_viewed', {
        ecp: parsed.ecp || 'none',
        ciudad: parsed.ciudad || 'none',
        has_email: !!parsed.email,
        has_telefono: !!parsed.telefono,
        utm_source: getUTMParams().utm_source || 'direct',
      });
    } catch (e) {
      console.warn('[Analytics] paywall_directo_viewed failed:', e.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ecp = useMemo(() => resolveEcp(lead.ecp), [lead.ecp]);

  const handleStartPayment = async () => {
    if (paymentStep === 'paying') return;
    setPaymentStep('paying');
    try {
      analytics.trackEvent('paywall_directo_pay_clicked', { ecp, bono_price: bonoPrice });
    } catch {}

    // If no email yet, let Stripe collect it (fallback link already does)
    try {
      const res = await safeFetch('/.netlify/functions/stripe-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: lead.email || '',
          nombre: lead.nombre || '',
          contactId: '', // Meta→GHL native integration creates the contact; Stripe webhook links it
          ecp,
          ubicacion: lead.ciudad || '',
          amount: bonoPrice * 100,
        }),
      }, { timeoutMs: 15000, retries: 0, label: 'Stripe-Direct' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error('No checkout URL');
    } catch (err) {
      console.error('[Stripe-Direct] Error, using fallback:', err);
      const fallbackUrl = lead.email
        ? `${STRIPE_CHECKOUT_URL}?prefilled_email=${encodeURIComponent(lead.email)}`
        : STRIPE_CHECKOUT_URL;
      window.location.href = fallbackUrl;
    }
  };

  const handleCallRequest = async () => {
    try {
      analytics.trackEvent('paywall_directo_call_requested', { ecp });
    } catch {}

    // Ask GHL to tag the contact (looked up by email) — best-effort, non-blocking
    if (lead.email) {
      safeFetch('/.netlify/functions/ghl-call-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: lead.email,
          nombre: lead.nombre || '',
          telefono: lead.telefono || '',
          ecp,
          source: 'paywall_directo',
        }),
      }, { timeoutMs: 10000, retries: 1, label: 'GHL-CallRequest-Direct' })
        .catch((err) => console.warn('[GHL-CallRequest-Direct] Failed:', err.message));
    }

    setPaymentStep('call-requested');
  };

  if (paymentStep === 'call-requested') {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <div className="w-16 h-16 bg-[#4CA994] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Te llamamos hoy mismo</h2>
          <p className="text-gray-600 mb-6">
            Hemos recibido tu solicitud. Una de nuestras asesoras te llamará en breve para resolver tus dudas y agendar tu Protocolo Mujer sin compromiso.
          </p>
          <p className="text-sm text-gray-400">
            Si no has recibido nuestra llamada en 24h, puedes escribirnos por WhatsApp al{' '}
            <a href="https://wa.me/34900000000" className="text-[#4CA994] font-semibold">+34 900 000 000</a>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PaywallOverlay
      ecp={ecp}
      nombre={lead.nombre}
      bonoPrice={bonoPrice}
      onPay={handleStartPayment}
      onCallRequest={handleCallRequest}
      onClose={undefined} // No close button on standalone paywall — it's the whole page
    />
  );
}

export default function DirectPaywallIsland() {
  return (
    <ErrorBoundary>
      <PostHogProvider>
        <AnalyticsProvider>
          <DirectPaywallInner />
        </AnalyticsProvider>
      </PostHogProvider>
    </ErrorBoundary>
  );
}
