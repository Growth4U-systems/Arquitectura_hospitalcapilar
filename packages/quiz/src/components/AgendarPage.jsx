import React, { useMemo, useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Loader2 } from 'lucide-react';
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
      // ecp passes through to /p/ when we redirect the woman-bono gate —
      // Meta Lead Ads sets this per form (postparto, menopausia, protocolo-mujer).
      ecp: sp.get('ecp') || 'protocolo-mujer',
    };
  }, []);

  const [existingAppt, setExistingAppt] = useState(null); // null = loading, false = no appt, object = has appt
  const [checking, setChecking] = useState(!!params.contactId);
  const [bonoRequired, setBonoRequired] = useState(false); // true = woman without payment → redirect to /p/ paywall

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

  // Bono gate — woman who hasn't paid yet: redirect to /p/ paywall (Trichometabolic).
  // Keeps one canonical paywall instead of an inline duplicate.
  if (bonoRequired && !existingAppt) {
    if (typeof window !== 'undefined') {
      const qs = new URLSearchParams();
      qs.set('ecp', params.ecp); // inherited from /agendar URL — set per Meta form
      if (params.contactId) qs.set('contactId', params.contactId);
      if (params.nombre) qs.set('nombre', params.nombre);
      if (params.email) qs.set('email', params.email);
      if (params.phone) qs.set('telefono', params.phone);
      if (params.clinica) qs.set('ciudad', params.clinica);
      window.location.replace(`/p/?${qs.toString()}`);
    }
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#4CA994] animate-spin" />
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
          <img src="/logo-hc-white.png" alt="Hospital Capilar" className="h-5" />
          <span>{params.tipo === 'asesoria' ? 'Agendar Asesoría Capilar' : 'Reservar mi analítica'}</span>
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
          <img src="/logo-hc-white.png" alt="Hospital Capilar" className="h-5" />
          <span>{params.tipo === 'asesoria' ? 'Agendar Asesoría Capilar' : 'Reservar mi analítica'}</span>
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
