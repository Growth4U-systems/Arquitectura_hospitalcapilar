import React, { useMemo, useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Loader2, CreditCard, Zap } from 'lucide-react';
import BookingCalendar from './BookingCalendar';

const CLINICS = {
  madrid: { name: 'Madrid' },
  // pontevedra & murcia disabled for initial pilot — only Madrid
  // pontevedra: { name: 'Pontevedra' },
  // murcia: { name: 'Murcia' },
};

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function formatFecha(fecha) {
  if (!fecha) return '';
  const [y, m, d] = fecha.split('-');
  return `${parseInt(d)} de ${MONTH_NAMES[parseInt(m) - 1]} de ${y}`;
}

export default function AgendarPage() {
  const params = useMemo(() => {
    const sp = new URLSearchParams(window.location.search);
    return {
      nombre: sp.get('nombre') || '',
      email: sp.get('email') || '',
      phone: sp.get('phone') || '',
      clinica: sp.get('clinica') || '',
      contactId: sp.get('contactId') || '',
      tipo: sp.get('tipo') || 'diagnostico',  // 'diagnostico' | 'asesoria'
    };
  }, []);

  const [existingAppt, setExistingAppt] = useState(null); // null = loading, false = no appt, object = has appt
  const [checking, setChecking] = useState(!!params.contactId);
  const [bonoRequired, setBonoRequired] = useState(false); // true = woman without payment

  // Launch pricing — 195€ anchor (tachado), 125€ oferta limitada
  const ORIGINAL_PRICE = 195;
  const OFFER_PRICE = 125;
  const DISCOUNT_PCT = Math.round(((ORIGINAL_PRICE - OFFER_PRICE) / ORIGINAL_PRICE) * 100);
  const STRIPE_URL = 'https://buy.stripe.com/9B614n0s94op9kyblJbAs06';

  // 24h countdown — session-scoped urgency; resets when tab closes.
  const [countdownSeconds, setCountdownSeconds] = useState(() => {
    if (typeof window === 'undefined') return 24 * 60 * 60;
    const stored = window.sessionStorage.getItem('bonoOfferStart');
    const startTime = stored ? parseInt(stored, 10) : Date.now();
    if (!stored) window.sessionStorage.setItem('bonoOfferStart', String(startTime));
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    return Math.max(0, 24 * 60 * 60 - elapsed);
  });

  useEffect(() => {
    const intv = setInterval(() => {
      setCountdownSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(intv);
  }, []);

  const countdownDisplay = useMemo(() => {
    const h = Math.floor(countdownSeconds / 3600);
    const m = Math.floor((countdownSeconds % 3600) / 60);
    const s = countdownSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [countdownSeconds]);

  // Check if contact already has an appointment + bono status
  useEffect(() => {
    if (!params.contactId) {
      setChecking(false);
      return;
    }

    fetch('/.netlify/functions/koibox-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_contact_appointment', ghl_contact_id: params.contactId, email: params.email, phone: params.phone }),
    })
      .then(res => res.json())
      .then(data => {
        // Check bono gate: woman who hasn't paid (skip for asesoria flow).
        // Gate on sexo CF OR standard GHL gender — ECP is unreliable (overridden to
        // 'Ciudad sin clinica' outside pilot) and sexo CF is empty for partial-quiz leads.
        if (params.tipo !== 'asesoria') {
          const sexo = (data.contactSexo || '').toLowerCase();
          const gender = (data.contactGender || '').toLowerCase();
          const isWoman = sexo === 'mujer' || gender === 'female';
          if (isWoman && !data.bonoPaid) {
            setBonoRequired(true);
          }
        }

        if (data.hasAppointment) {
          setExistingAppt(data);
        } else {
          setExistingAppt(false);
        }
      })
      .catch(() => setExistingAppt(false))
      .finally(() => setChecking(false));
  }, [params.contactId]);

  // Loading check
  if (checking) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#4CA994] animate-spin" />
      </div>
    );
  }

  // Bono gate — woman ECP who hasn't paid yet
  if (bonoRequired && !existingAppt) {
    const stripeUrl = `${STRIPE_URL}?prefilled_email=${encodeURIComponent(params.email || '')}`;
    return (
      <div className="min-h-screen bg-[#F7F8FA]">
        <div className="bg-[#2C3E50] text-white text-center py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2">
          <img src="/logo-hc-white.svg" alt="Hospital Capilar" className="h-5" />
          <span>{params.tipo === 'asesoria' ? 'Agendar Asesoría Capilar' : 'Reservar Test Capilar'}</span>
        </div>
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">
              Tu test capilar
            </h2>
            <p className="text-gray-500 text-sm max-w-sm mx-auto">
              La única prueba médica que identifica la causa real de tu caída. Reserva ahora al precio de lanzamiento.
            </p>
          </div>

          {/* POPULAR pricing card */}
          <div className="relative mb-5">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#2C3E50] text-white text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full flex items-center gap-1 shadow-md z-10 whitespace-nowrap">
              <Zap size={12} fill="currentColor" />
              <span>Oferta limitada</span>
            </div>
            <div className="bg-white rounded-2xl border-2 border-[#4CA994] p-5 pt-7 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-gray-900 text-lg leading-tight">Test capilar completo</p>
                  <div className="inline-flex items-center gap-2 mt-2 flex-wrap">
                    <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-md">Ahorra {DISCOUNT_PCT}%</span>
                    <span className="text-gray-400 text-sm line-through">{ORIGINAL_PRICE}€</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-4xl font-extrabold text-gray-900">{OFFER_PRICE}€</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-[#4CA994] mt-0.5">✓</span>
                    Analítica hormonal completa
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#4CA994] mt-0.5">✓</span>
                    Tricoscopia digital
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#4CA994] mt-0.5">✓</span>
                    Valoración con médico especialista
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#4CA994] mt-0.5">✓</span>
                    Informe personalizado con plan de tratamiento
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Countdown */}
          <div className="flex items-center justify-center gap-2 bg-white rounded-full border border-gray-200 px-4 py-2 mb-5 mx-auto w-fit shadow-sm">
            <Clock size={14} className="text-[#2C3E50]" />
            <span className="text-xs font-semibold text-gray-700">Oferta limitada:</span>
            <span className="text-sm font-extrabold text-[#2C3E50] tabular-nums">{countdownDisplay}</span>
          </div>

          {/* CTA */}
          <a
            href={stripeUrl}
            className="block w-full bg-[#4CA994] hover:bg-[#3d9482] text-white font-bold py-4 rounded-xl transition-colors text-center text-lg shadow-lg flex items-center justify-center gap-2"
          >
            <CreditCard size={20} />
            Reservar mi test — {OFFER_PRICE}€
          </a>

          <p className="text-center text-xs text-gray-400 mt-3">
            Pago seguro con Stripe · La reserva se descuenta del tratamiento si decides continuar.
          </p>
          <p className="text-center text-xs text-gray-400 mt-2">
            ¿Dudas? Llámanos al <a href="tel:+34623457218" className="text-[#4CA994] font-semibold">623 457 218</a>
          </p>

          {/* Video testimonial — below CTA so it doesn't compete with primary action */}
          <div className="mt-8">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 text-center">Conoce Hospital Capilar</h3>
            <div className="rounded-2xl overflow-hidden shadow-sm bg-black aspect-[9/16] max-h-[320px] mx-auto" style={{ maxWidth: '180px' }}>
              <iframe
                src="https://www.youtube.com/embed/pbJOQYupwFE"
                title="Hospital Capilar"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Already has appointment — show info + link to mi-cita
  if (existingAppt) {
    const appt = existingAppt.appointment;
    const clinicName = CLINICS[existingAppt.clinica]?.name || existingAppt.clinica || '';

    return (
      <div className="min-h-screen bg-[#F7F8FA]">
        <div className="bg-[#2C3E50] text-white text-center py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2">
          <img src="/logo-hc-white.svg" alt="Hospital Capilar" className="h-5" />
          <span>{params.tipo === 'asesoria' ? 'Agendar Asesoría Capilar' : 'Reservar Test Capilar'}</span>
        </div>
        <div className="max-w-lg mx-auto px-4 py-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Ya tienes una cita programada</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-800">
                <Calendar className="w-4 h-4 text-[#4CA994]" />
                <span className="font-semibold">{formatFecha(appt.fecha)}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-800">
                <Clock className="w-4 h-4 text-[#4CA994]" />
                <span className="font-semibold">{appt.hora_inicio}h</span>
              </div>
              {clinicName && (
                <div className="flex items-center gap-2 text-gray-800">
                  <MapPin className="w-4 h-4 text-[#4CA994]" />
                  <span className="font-semibold">Hospital Capilar {clinicName}</span>
                </div>
              )}
            </div>
          </div>
          <a
            href={`/mi-cita?c=${existingAppt.resolvedContactId || params.contactId}`}
            className="block w-full bg-[#4CA994] hover:bg-[#3d9482] text-white font-bold py-4 rounded-xl transition-colors text-center"
          >
            Cambiar o cancelar cita
          </a>
          <p className="text-center text-xs text-gray-400 mt-3">
            ¿Dudas? Llámanos al <a href="tel:+34623457218" className="text-[#4CA994] font-semibold">623 457 218</a>
          </p>
        </div>
      </div>
    );
  }

  // No appointment — show booking calendar
  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <div className="bg-[#2C3E50] text-white py-3 px-4">
        <div className="max-w-lg mx-auto flex items-center justify-center gap-2 text-sm font-semibold">
          <img src="/logo-hc-white.svg" alt="Hospital Capilar" className="h-5" />
          <span>{params.tipo === 'asesoria' ? 'Agendar Asesoría Capilar' : 'Reservar Test Capilar'}</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {params.nombre ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Paciente</p>
            <p className="font-bold text-gray-900">{params.nombre}</p>
            {params.email && <p className="text-sm text-gray-500">{params.email}</p>}
            {params.phone && <p className="text-sm text-gray-500">{params.phone}</p>}
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
            <p className="text-amber-800 text-sm font-medium">
              No se han recibido datos del paciente. Asegúrate de usar el link desde el CRM.
            </p>
          </div>
        )}

        <div className="bg-[#4CA994]/5 border border-[#4CA994]/20 rounded-2xl p-5">
          <BookingCalendar
            nombre={params.nombre}
            email={params.email}
            telefono={params.phone}
            ubicacion={params.clinica}
            contactId={params.contactId}
            tipoConsulta={params.tipo}
          />
        </div>
      </div>
    </div>
  );
}
