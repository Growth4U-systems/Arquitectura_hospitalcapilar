import React, { useState, useEffect, useMemo } from 'react';
import { Check, X, Star, ChevronDown, Lock, Phone, Clock } from 'lucide-react';

const TESTIMONIALS_BY_ECP = {
  'Es Normal': [
    { name: 'Laura M.', age: 52, text: 'Desde la menopausia se me caía a puñados. Mi médica decía que era normal. En HC cruzaron mi perfil hormonal con tricoscopía y encontraron la causa real.', stars: 5 },
    { name: 'Patricia G.', age: 48, text: 'Llevaba un año con caída brutal. Me dijeron que era por la edad. En HC descubrieron un desbalance hormonal tratable.', stars: 5 },
  ],
  'Lo Que Vino Con el Bebé': [
    { name: 'Elena R.', age: 32, text: 'Después del parto se me caía a puñados. 8 meses después seguía igual. En HC descubrieron AGA subyacente. Gracias a actuar a tiempo estoy recuperando densidad.', stars: 5 },
    { name: 'Sofía T.', age: 29, text: 'Creía que nunca iba a volver a tener mi pelo de antes. El test en HC me tranquilizó: era efluvio temporal. Me dieron un plan y en 4 meses estaba como antes.', stars: 5 },
  ],
  '¿Qué Me Pasa?': [
    { name: 'María J.', age: 35, text: 'No sabía si era estrés o algo peor. Google me asustaba. En HC en 30 minutos supe exactamente qué tenía y qué hacer.', stars: 5 },
    { name: 'Pablo R.', age: 31, text: 'Llevaba meses preocupado sin saber a quién ir. El test me quitó todas las dudas. Era mucho menos grave de lo que pensaba.', stars: 5 },
  ],
  'La Farmacia': [
    { name: 'Carlos M.', age: 38, text: 'Llevaba 3 años gastando en Olistic, champús, minoxidil. €800 tirados. En HC descubrieron que mi alopecia era mixta. En 6 meses noté la diferencia.', stars: 5 },
    { name: 'Andrea L.', age: 33, text: 'Probé todo lo de la farmacia durante 2 años. Nada. En HC me dijeron exactamente por qué no funcionaba y qué sí iba a funcionar.', stars: 5 },
  ],
};

const OBJECTIONS = {
  'Es Normal': [
    { myth: 'No sé si mi caída tiene solución', truth: 'Un test capilar con tricoscopia + analítica hormonal te da la respuesta en 30 minutos.' },
    { myth: 'Ya fui a otro médico y no me dijeron nada', truth: 'Nuestro equipo médico especializado en salud capilar cruza tu perfil hormonal con un estudio capilar completo. Nadie más los mira juntos.' },
    { myth: 'Es muy caro para no saber si funciona', truth: null }, // dynamic — uses bonoPrice
  ],
  'Lo Que Vino Con el Bebé': [
    { myth: 'Me dicen que es normal y que se pasará solo', truth: 'En el 70% de casos sí. Pero si hay AGA subyacente, cada mes sin actuar es pelo que no vuelve.' },
    { myth: 'Mi ginecóloga no le da importancia', truth: 'Los ginecólogos se centran en hormonas. Nuestro equipo médico capilar cruza tu perfil hormonal con un estudio del pelo para encontrar la causa real.' },
    { myth: 'Es muy caro para no saber si funciona', truth: null }, // dynamic — uses bonoPrice
  ],
  '¿Qué Me Pasa?': [
    { myth: 'Seguro que no es nada, ya se pasará', truth: 'Puede ser estrés temporal… o el inicio de una alopecia. Solo un test capilar profesional te saca de dudas.' },
    { myth: 'Busqué en Google y me asusté más', truth: 'Internet no puede diagnosticarte. Una tricoscopia + analítica en 30 minutos te da la respuesta real.' },
    { myth: 'No sé si ir al dermatólogo o a una clínica capilar', truth: 'Un centro especializado combina microscopio + analítica + médico. Es el test más completo para caída capilar.' },
  ],
  'La Farmacia': [
    { myth: 'Si el minoxidil no funciona, no hay nada que hacer', truth: 'El 60% no responde a minoxidil sin saber la causa. No es que no funcione — es que puede no ser lo que necesitas.' },
    { myth: 'Los suplementos deberían ser suficientes', truth: 'Olistic, Iraltone, Pilexil… pueden complementar, pero sin saber la causa es tirar dinero.' },
    { myth: 'Ya me gasté demasiado, para qué gastar más', truth: null }, // dynamic — uses bonoPrice
  ],
};

const getfaqs = (price) => [
  { q: '¿Qué incluye exactamente el test capilar?', a: 'Analítica hormonal completa, tricoscopia digital (microscopio capilar de alta resolución), valoración con médico especialista (30 min) e informe personalizado con plan de tratamiento.' },
  { q: `¿Por qué se paga por adelantado?`, a: `Reservamos 30 minutos de tiempo médico exclusivo y una analítica de laboratorio a tu nombre. El pago por adelantado garantiza tu plaza y nos permite preparar tu caso antes de la cita.` },
  { q: `¿Los ${price}€ se descuentan si hago tratamiento?`, a: `Sí. Si decides iniciar tratamiento en Hospital Capilar, los ${price}€ del test se descuentan íntegros del coste.` },
  { q: '¿Me van a intentar vender algo?', a: 'No. Nuestros médicos te dan un informe objetivo (microscopio + analítica) y te explican tus opciones. Si no necesitas tratamiento, te lo decimos.' },
];

const ORIGINAL_PRICE = 195;

const PaywallOverlay = ({ ecp, nombre, onPay, onClose, onCallRequest, bonoPrice = 125 }) => {
  const [openFaq, setOpenFaq] = useState(null);
  const testimonials = TESTIMONIALS_BY_ECP[ecp] || TESTIMONIALS_BY_ECP['Es Normal'];
  const discountPct = Math.round(((ORIGINAL_PRICE - bonoPrice) / ORIGINAL_PRICE) * 100);

  // 24h countdown for "oferta limitada" — session-scoped urgency
  const [countdownSeconds, setCountdownSeconds] = useState(() => {
    if (typeof window === 'undefined') return 24 * 60 * 60;
    const stored = window.sessionStorage.getItem('bonoOfferStart');
    const startTime = stored ? parseInt(stored, 10) : Date.now();
    if (!stored) window.sessionStorage.setItem('bonoOfferStart', String(startTime));
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    return Math.max(0, 24 * 60 * 60 - elapsed);
  });
  useEffect(() => {
    const intv = setInterval(() => setCountdownSeconds(prev => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(intv);
  }, []);
  const countdownDisplay = `${String(Math.floor(countdownSeconds / 3600)).padStart(2, '0')}:${String(Math.floor((countdownSeconds % 3600) / 60)).padStart(2, '0')}:${String(countdownSeconds % 60).padStart(2, '0')}`;
  const dynamicTruth = `Los ${bonoPrice}€ se descuentan íntegros si inicias tratamiento.`;
  const dynamicOtcTruth = `Un test capilar de ${bonoPrice}€ (descontable) puede ahorrarte años de productos que no funcionan.`;
  const rawObjections = OBJECTIONS[ecp] || OBJECTIONS['Es Normal'];
  const objections = rawObjections.map(obj => ({
    ...obj,
    truth: obj.truth ?? (obj.myth.includes('gasté') ? dynamicOtcTruth : dynamicTruth),
  }));
  const faqs = getfaqs(bonoPrice);
  const firstName = (nombre || 'Paciente').split(' ')[0];

  return (
    <div className="fixed inset-0 z-50 bg-[#F7F8FA] overflow-y-auto">
      {/* Top banner */}
      <div className="bg-[#4CA994] text-white text-center py-3 px-4 text-sm font-semibold sticky top-0 z-10">
        Tu pre-análisis personalizado está listo
      </div>

      <div className="max-w-lg mx-auto px-4 pb-40">
        {/* Close button */}
        <div className="flex justify-end pt-3 pb-1">
          <button onClick={onClose} className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-200">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Header */}
        <div className="text-center pb-6">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">
            {firstName}, descubre qué le pasa a tu pelo
          </h2>
          <p className="text-gray-700 text-base md:text-lg font-medium leading-relaxed max-w-md mx-auto">
            {ecp === 'Lo Que Vino Con el Bebé'
              ? 'Tu caso necesita un test capilar que cruce tu perfil hormonal postparto con un estudio capilar completo.'
              : ecp === '¿Qué Me Pasa?'
              ? 'Google no puede diagnosticarte. Solo una tricoscopia + analítica hormonal te dice exactamente qué ocurre.'
              : ecp === 'La Farmacia'
              ? 'Sin saber la causa, cualquier producto es una apuesta. Descubre qué necesitas realmente.'
              : 'Tu caída puede tener causa hormonal. Solo un test capilar especializado puede confirmarlo.'}
          </p>
        </div>

        {/* Objections section */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            ¿Te sientes así? <span className="text-[#4CA994]">Tenemos la respuesta.</span>
          </h3>
          <div className="space-y-4 mt-4">
            {objections.map((obj, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-6 h-6 bg-red-50 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <X size={14} className="text-red-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm line-through">"{obj.myth}"</p>
                  <p className="text-gray-800 text-sm font-medium mt-0.5">{obj.truth}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* What's included */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Lo que incluye tu test capilar</h3>
          <div className="space-y-2">
            {[
              'Analítica hormonal completa',
              'Tricoscopia digital con microscopio de alta resolución',
              'Valoración con médico especialista (30 min)',
              'Informe personalizado con plan de tratamiento',
            ].map((text, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
                <div className="w-8 h-8 bg-[#F0F7F6] rounded-lg flex items-center justify-center shrink-0">
                  <Check size={18} className="text-[#4CA994]" />
                </div>
                <span className="text-gray-800 text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Price card */}
        <div className="bg-white rounded-2xl border-2 border-[#4CA994] p-5 pt-7 mb-4 shadow-sm relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#2C3E50] text-white text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full whitespace-nowrap shadow-md">
            Oferta limitada
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 flex-wrap mb-2">
              <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-md">Ahorra {discountPct}%</span>
              <span className="text-gray-400 text-lg line-through">{ORIGINAL_PRICE}€</span>
            </div>
            <div className="text-5xl font-extrabold text-gray-900 leading-none">{bonoPrice}€</div>
            <p className="text-sm text-gray-500 mt-2">Pago único · Se descuenta si inicias tratamiento</p>
          </div>
        </div>

        {/* Countdown */}
        <div className="flex items-center justify-center gap-2 bg-white rounded-full border border-gray-200 px-4 py-2 mb-6 mx-auto w-fit shadow-sm">
          <Clock size={14} className="text-[#2C3E50]" />
          <span className="text-xs font-semibold text-gray-700">Oferta limitada:</span>
          <span className="text-sm font-extrabold text-[#2C3E50] tabular-nums">{countdownDisplay}</span>
        </div>

        {/* Testimonials */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 text-center">Historias reales</h3>
          <div className="space-y-3">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-sm text-gray-900">{t.name}</span>
                  <span className="text-gray-400 text-xs">{t.age} años</span>
                  <div className="flex gap-0.5 ml-auto">
                    {Array.from({ length: t.stars }).map((_, j) => (
                      <Star key={j} size={14} className="text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                </div>
                <p className="text-gray-600 text-sm italic leading-relaxed">"{t.text}"</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-8">
          <h3 className="text-base font-bold text-gray-900 text-center mb-4">Preguntas frecuentes</h3>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <span className="text-sm font-medium text-gray-800 pr-4">{faq.q}</span>
                  <ChevronDown size={18} className={`text-gray-400 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Trust footer */}
        <div className="text-center mb-4">
          <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
            <Lock size={12} /> Pago 100% seguro con Stripe
          </p>
        </div>
      </div>

      {/* Sticky CTA — fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 py-3 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="max-w-lg mx-auto">
          <button
            onClick={onPay}
            className="w-full bg-[#4CA994] hover:bg-[#3d9480] text-white font-bold text-lg py-4 rounded-xl shadow-lg transition-colors"
          >
            Reservar mi test — {bonoPrice}€
          </button>
          <button
            onClick={onCallRequest}
            className="w-full text-center text-sm text-gray-500 mt-2 py-1 hover:text-[#4CA994] transition-colors flex items-center justify-center gap-1"
          >
            <Phone size={14} /> ¿Dudas? Te llamamos sin compromiso
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaywallOverlay;
