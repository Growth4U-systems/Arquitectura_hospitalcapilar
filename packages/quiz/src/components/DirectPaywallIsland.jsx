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
    const ecpResolved = resolveEcp(parsed.ecp);
    // Pull ALL UTMs from URL so /p/ leads inherit attribution from Meta Lead
    // Form macros (configure the form's redirect URL with utm_content={{ad.id}}
    // etc.). Without this, master table groups them as "Sin atribuir".
    const utms = getUTMParams();
    try {
      analytics.trackEvent('paywall_directo_viewed', {
        ecp: parsed.ecp || 'none',
        ciudad: parsed.ciudad || 'none',
        has_email: !!parsed.email,
        has_telefono: !!parsed.telefono,
        ...utms,
      });
    } catch (e) {
      console.warn('[Analytics] paywall_directo_viewed failed:', e.message);
    }
    // If the lead came pre-filled from Meta Lead Form, register it as a lead
    // event in PostHog right away. Master table needs this to attribute the
    // contact to its source ad (otherwise it sits in "sin atribución").
    if (parsed.email) {
      try {
        analytics.trackEvent('lead_form_submitted', {
          quiz_id: 'direct_paywall',
          source: 'meta_lead_form',
          ecp: ecpResolved,
          ciudad: parsed.ciudad || '',
          ...utms,
        });
        analytics.trackEvent('$identify', {
          email: parsed.email,
          name: parsed.nombre,
          phone: parsed.telefono,
          ...utms,
        });
      } catch (e) {
        console.warn('[Analytics] lead_form_submitted failed:', e.message);
      }
    }
    // Meta Pixel — ViewContent (user landed on the paywall)
    try {
      if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
        window.fbq('track', 'ViewContent', {
          content_name: 'Protocolo Femenino Trichometabolic',
          content_category: ecpResolved,
          content_ids: [parsed.ecp || 'protocolo-mujer'],
          value: bonoPrice,
          currency: 'EUR',
        });
      }
    } catch (e) {
      console.warn('[Meta Pixel] ViewContent failed:', e.message);
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

    // Meta Pixel — InitiateCheckout (user clicked Pay button)
    try {
      if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
        window.fbq('track', 'InitiateCheckout', {
          content_name: 'Protocolo Femenino Trichometabolic',
          content_category: ecp,
          content_ids: [lead.ecp || 'protocolo-mujer'],
          value: bonoPrice,
          currency: 'EUR',
          num_items: 1,
        });
      }
    } catch (e) {
      console.warn('[Meta Pixel] InitiateCheckout failed:', e.message);
    }

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
      brandHeader={true} // Render HC header with full nav for trust/brand consistency
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
