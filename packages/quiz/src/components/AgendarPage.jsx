import React, { useMemo, useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Loader2, ShieldAlert, CreditCard } from 'lucide-react';
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
  const [bonoRequired, setBonoRequired] = useState(false); // true = woman ECP without payment

  const WOMEN_ECPS = ['es normal', 'lo que vino con el bebé'];

  // A/B test bono pricing — 50/50 split, deterministic per contactId
  const STRIPE_LINKS = {
    195: 'https://buy.stripe.com/8x2fZh6Qx6wxeES75tbAs04',
    125: 'https://buy.stripe.com/9B614n0s94op9kyblJbAs06',
  };
  const bonoPrice = useMemo(() => {
    const id = params.contactId;
    if (!id) return 125;
    // Simple hash: sum char codes, even → 125, odd → 195
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash += id.charCodeAt(i);
    return hash % 2 === 0 ? 125 : 195;
  }, [params.contactId]);

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
        // Check bono gate: woman ECP who hasn't paid (skip for asesoria flow)
        if (params.tipo !== 'asesoria') {
          const ecp = (data.contactEcp || '').toLowerCase();
          const isWomanEcp = WOMEN_ECPS.some(e => ecp.includes(e));
          if (isWomanEcp && !data.bonoPaid) {
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
    const stripeUrl = `${STRIPE_LINKS[bonoPrice]}?prefilled_email=${encodeURIComponent(params.email || '')}`;
    return (
      <div className="min-h-screen bg-[#F7F8FA]">
        <div className="bg-[#2C3E50] text-white text-center py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2">
          <img src="/logo-hc-white.svg" alt="Hospital Capilar" className="h-5" />
          <span>Agendar Consulta Diagnóstica</span>
        </div>
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldAlert size={32} className="text-amber-600" />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">
              Pago pendiente
            </h2>
            <p className="text-gray-500 text-sm max-w-sm mx-auto">
              Para poder agendar tu consulta diagnóstica, primero necesitas completar el pago del bono.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tu diagnóstico incluye</p>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-[#4CA994] mt-0.5">✓</span>
                Tricoscopía digital completa
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#4CA994] mt-0.5">✓</span>
                Analítica hormonal completa
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#4CA994] mt-0.5">✓</span>
                Valoración médica personalizada
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#4CA994] mt-0.5">✓</span>
                Plan de tratamiento a medida
              </li>
            </ul>
          </div>

          <a
            href={stripeUrl}
            className="block w-full bg-[#4CA994] hover:bg-[#3d9482] text-white font-bold py-4 rounded-xl transition-colors text-center text-lg shadow-lg flex items-center justify-center gap-2"
          >
            <CreditCard size={20} />
            Completar pago — {bonoPrice}€
          </a>

          <p className="text-center text-xs text-gray-400 mt-4">
            El bono se descuenta del tratamiento si decides continuar.
            <br />
            ¿Dudas? Llámanos al <a href="tel:+34623457218" className="text-[#4CA994] font-semibold">623 457 218</a>
          </p>
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
          <span>Agendar Consulta Diagnóstica</span>
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
          <span>Agendar Consulta Diagnóstica</span>
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
          />
        </div>
      </div>
    </div>
  );
}
