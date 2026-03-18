import React, { useState } from 'react';
import { ShieldCheck, Stethoscope, CheckCircle2, Users, Star, ChevronDown, Phone } from 'lucide-react';

// ============================================
// SHARED SECTIONS — used by both Quiz and Form landings
// ============================================

export const TopBar = () => (
  <div className="h-1.5 w-full bg-[#4CA994]" />
);

export const StatsSection = ({ stats }) => (
  <section className="bg-gray-50 py-12">
    <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-8 text-center">
      {stats.map((stat, i) => (
        <div key={i}>
          <div className="text-3xl md:text-4xl font-extrabold text-[#4CA994] mb-1">{stat.value}</div>
          <div className="text-sm text-gray-500 font-medium">{stat.label}</div>
        </div>
      ))}
    </div>
  </section>
);

export const PainPointsSection = ({ painPoints }) => (
  <section className="max-w-3xl mx-auto px-6 py-16">
    <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-8 text-center">
      ¿Te identificas con esto?
    </h2>
    <div className="space-y-4">
      {painPoints.map((point, i) => (
        <div key={i} className="flex items-start gap-4 p-5 bg-gray-50 rounded-xl border border-gray-100">
          <CheckCircle2 size={24} className="text-[#4CA994] shrink-0 mt-0.5" />
          <p className="text-lg text-gray-700 font-medium">{point}</p>
        </div>
      ))}
    </div>
  </section>
);

export const SolutionSection = ({ solution }) => (
  <section className="bg-[#F0F7F6] py-16">
    <div className="max-w-3xl mx-auto px-6 text-center">
      <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-6">
        ¿Por qué Hospital Capilar es diferente?
      </h2>
      <p className="text-lg text-gray-600 leading-relaxed mb-10">
        {solution}
      </p>
      <div className="grid md:grid-cols-3 gap-6 text-left">
        <div className="bg-white p-6 rounded-2xl shadow-sm">
          <Stethoscope size={28} className="text-[#4CA994] mb-3" />
          <h3 className="font-bold text-gray-900 mb-2">Diagnóstico real</h3>
          <p className="text-sm text-gray-500">Tricoscopía + analítica hormonal + valoración médica en 30 minutos.</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm">
          <Users size={28} className="text-[#4CA994] mb-3" />
          <h3 className="font-bold text-gray-900 mb-2">Equipo médico</h3>
          <p className="text-sm text-gray-500">Un equipo médico profesional experto en salud capilar trabajando juntos en tu caso.</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm">
          <ShieldCheck size={28} className="text-[#4CA994] mb-3" />
          <h3 className="font-bold text-gray-900 mb-2">Sin presión</h3>
          <p className="text-sm text-gray-500">Te decimos la verdad sobre tu caso. Si no necesitas tratamiento, te lo decimos.</p>
        </div>
      </div>
    </div>
  </section>
);

export const TestimonialsSection = ({ testimonials }) => (
  <section className="max-w-4xl mx-auto px-6 py-16">
    <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-8 text-center">
      Personas como tú que dieron el paso
    </h2>
    <div className="grid md:grid-cols-2 gap-6">
      {testimonials.map((t, i) => (
        <div key={i} className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
          <div className="flex gap-1 mb-3">
            {Array.from({ length: t.stars }).map((_, j) => (
              <Star key={j} size={18} className="text-yellow-400 fill-yellow-400" />
            ))}
          </div>
          <p className="text-gray-700 leading-relaxed mb-4 italic">"{t.text}"</p>
          <p className="text-sm font-bold text-gray-900">{t.name}, {t.age} años</p>
        </div>
      ))}
    </div>
  </section>
);

export const FAQSection = ({ faqs }) => {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <section className="max-w-3xl mx-auto px-6 py-16">
      <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-8 text-center">
        Preguntas frecuentes
      </h2>
      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="font-bold text-gray-900 pr-4">{faq.q}</span>
              <ChevronDown
                size={20}
                className={`text-gray-400 shrink-0 transition-transform ${openIndex === i ? 'rotate-180' : ''}`}
              />
            </button>
            {openIndex === i && (
              <div className="px-5 pb-5">
                <p className="text-gray-600 leading-relaxed">{faq.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export const Footer = () => (
  <footer className="py-8 border-t border-gray-100">
    <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
      <img src="/logo-hc.svg" alt="Hospital Capilar" className="h-8 opacity-40" />
      <div className="flex gap-6 text-sm text-gray-400">
        <span>Madrid</span>
        <span>Murcia</span>
        <span>Pontevedra</span>
      </div>
      <p className="text-xs text-gray-400">Centro Médico Especializado en Salud Capilar</p>
    </div>
  </footer>
);
