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
  const [paymentStep, setPaymentStep] = useState('paywall'); // paywall | paying
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

  return (
    <PaywallOverlay
      ecp={ecp}
      nombre={lead.nombre}
      bonoPrice={bonoPrice}
      onPay={handleStartPayment}
      onCallRequest={undefined} // Standalone paywall: no call-me fallback, pay-only
      onClose={undefined} // Standalone paywall: no close button — it's the whole page
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
