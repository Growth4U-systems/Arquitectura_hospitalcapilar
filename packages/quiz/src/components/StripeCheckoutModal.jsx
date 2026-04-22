import React, { useEffect, useRef, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { X, Loader2 } from 'lucide-react';

const STRIPE_PK = import.meta.env.VITE_STRIPE_PK || '';

let stripePromise = null;
const getStripe = () => {
  if (!stripePromise && STRIPE_PK) {
    stripePromise = loadStripe(STRIPE_PK);
  }
  return stripePromise;
};

const StripeCheckoutModal = ({ clientSecret, onComplete, onCancel, bonoPrice = 125 }) => {
  const containerRef = useRef(null);
  const checkoutRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!clientSecret || !STRIPE_PK) {
      setError('Configuración de pago no disponible');
      setLoading(false);
      return;
    }

    let mounted = true;

    const initCheckout = async () => {
      try {
        const stripe = await getStripe();
        if (!stripe || !mounted) return;

        const checkout = await stripe.initEmbeddedCheckout({
          clientSecret,
        });

        if (!mounted) {
          checkout.destroy();
          return;
        }

        checkoutRef.current = checkout;
        checkout.mount(containerRef.current);
        setLoading(false);
      } catch (err) {
        console.error('[Stripe] Embedded checkout error:', err);
        if (mounted) {
          setError(err.message || 'Error al cargar el formulario de pago');
          setLoading(false);
        }
      }
    };

    initCheckout();

    return () => {
      mounted = false;
      if (checkoutRef.current) {
        checkoutRef.current.destroy();
        checkoutRef.current = null;
      }
    };
  }, [clientSecret]);

  // Poll for completion (embedded checkout fires session complete via return_url,
  // but we can also check via the onComplete callback from parent polling)
  // The parent component handles completion detection

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto">
      <div className="w-full max-w-lg mx-4 my-8 bg-white rounded-2xl shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="bg-[#4CA994] text-white px-5 py-3 flex items-center justify-between">
          <span className="font-bold text-sm">Pago seguro — Test Capilar {bonoPrice}€</span>
          <button onClick={onCancel} className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Loading state */}
        {loading && !error && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={32} className="text-[#4CA994] animate-spin mb-3" />
            <p className="text-gray-500 text-sm">Cargando formulario de pago...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="p-8 text-center">
            <p className="text-red-500 text-sm mb-4">{error}</p>
            <button onClick={onCancel} className="text-[#4CA994] font-medium text-sm underline">
              Volver
            </button>
          </div>
        )}

        {/* Stripe Embedded Checkout container */}
        <div ref={containerRef} className={loading || error ? 'hidden' : ''} />
      </div>
    </div>
  );
};

export default StripeCheckoutModal;
