import React, { useState } from 'react';
import { Check, X, Star, ChevronDown, Lock, Phone } from 'lucide-react';

const TESTIMONIALS_BY_ECP = {
  'Es Normal': [
    { name: 'Laura M.', age: 34, text: 'Llevaba 2 años con caída y nadie encontraba la causa. En Hospital Capilar descubrieron que era hormonal. Ahora estoy recuperando densidad.', stars: 5 },
    { name: 'Patricia G.', age: 41, text: 'Después del embarazo no paraba de caer. Me hicieron una analítica completa cruzada con tricoscopía. Por fin un diagnóstico real.', stars: 5 },
  ],
  'Lo Que Vino Con el Bebé': [
    { name: 'Elena R.', age: 32, text: 'Después del parto perdí mucho pelo. Mi ginecóloga decía que era normal. En HC descubrieron que tenía AGA subyacente. Gracias a actuar a tiempo estoy recuperando densidad.', stars: 5 },
    { name: 'Sofía T.', age: 29, text: 'Creía que nunca iba a volver a tener mi pelo de antes. El diagnóstico en HC me tranquilizó: era efluvio temporal. Me dieron un plan y en 4 meses estaba como antes.', stars: 5 },
  ],
};

const OBJECTIONS = {
  'Es Normal': [
    { myth: 'No sé si mi caída tiene solución', truth: 'Un diagnóstico con tricoscopía + analítica hormonal te da la respuesta en 30 minutos.' },
    { myth: 'Ya fui a otro médico y no me dijeron nada', truth: 'Cruzamos dermatología capilar con endocrinología. Nadie más mira tu pelo y tus hormonas juntos.' },
    { myth: 'Es muy caro para no saber si funciona', truth: 'Los 195€ se descuentan íntegros si inicias tratamiento.' },
  ],
  'Lo Que Vino Con el Bebé': [
    { myth: 'Me dicen que es normal y que se pasará solo', truth: 'En el 70% de casos sí. Pero si hay AGA subyacente, cada mes sin actuar es pelo que no vuelve.' },
    { myth: 'Mi ginecóloga no le da importancia', truth: 'Los ginecólogos tratan hormonas. Los dermatólogos tratan pelo. Nosotros cruzamos ambos.' },
    { myth: 'Es muy caro para no saber si funciona', truth: 'Los 195€ se descuentan íntegros si inicias tratamiento.' },
  ],
};

const FAQS = [
  { q: '¿Qué incluye exactamente el diagnóstico?', a: 'Tricoscopía digital (microscopio capilar de alta resolución), analítica hormonal completa, valoración médica personalizada de 30 minutos y plan de tratamiento detallado.' },
  { q: '¿Los 195€ se descuentan si hago tratamiento?', a: 'Sí. Si decides iniciar tratamiento en Hospital Capilar, los 195€ del diagnóstico se descuentan íntegros del coste.' },
  { q: '¿Me van a intentar vender algo?', a: 'No. Nuestros médicos te diagnostican con datos objetivos (microscopio + analítica) y te explican tus opciones. Si no necesitas tratamiento, te lo decimos.' },
];

const PaywallOverlay = ({ ecp, nombre, onPay, onClose, onCallRequest }) => {
  const [openFaq, setOpenFaq] = useState(null);
  const testimonials = TESTIMONIALS_BY_ECP[ecp] || TESTIMONIALS_BY_ECP['Es Normal'];
  const objections = OBJECTIONS[ecp] || OBJECTIONS['Es Normal'];
  const firstName = (nombre || 'Paciente').split(' ')[0];

  return (
    <div className="fixed inset-0 z-50 bg-[#F7F8FA] overflow-y-auto">
      {/* Top banner */}
      <div className="bg-[#4CA994] text-white text-center py-3 px-4 text-sm font-semibold sticky top-0 z-10">
        Tu diagnóstico personalizado está listo
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
          <p className="text-gray-500 text-sm">
            {ecp === 'Lo Que Vino Con el Bebé'
              ? 'Tu caso necesita un diagnóstico que cruce tu perfil hormonal postparto con un estudio capilar completo.'
              : 'Tu caída puede tener causa hormonal. Solo un diagnóstico especializado puede confirmarlo.'}
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
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Lo que incluye tu diagnóstico</h3>
          <div className="space-y-2">
            {[
              'Tricoscopía digital con microscopio de alta resolución',
              'Analítica hormonal completa',
              'Valoración médica personalizada (30 min)',
              'Plan de tratamiento detallado',
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
        <div className="bg-white rounded-2xl border-2 border-[#4CA994] p-5 mb-6 shadow-sm relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#4CA994] text-white text-xs font-bold px-4 py-1 rounded-full">
            DIAGNÓSTICO COMPLETO
          </div>
          <div className="text-center pt-2">
            <span className="text-4xl font-extrabold text-gray-900">195€</span>
            <p className="text-sm text-gray-500 mt-1">Pago único · Se descuenta si inicias tratamiento</p>
          </div>
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
            {FAQS.map((faq, i) => (
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
            Reserva tu Diagnóstico — 195€
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
