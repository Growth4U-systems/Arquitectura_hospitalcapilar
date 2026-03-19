import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, MapPin, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import BookingCalendar from './BookingCalendar';

const CLINICS = {
  madrid: { name: 'Madrid', address: 'C/ del Príncipe de Vergara, 43' },
  pontevedra: { name: 'Pontevedra', address: 'Rúa Benito Corbal, 47' },
  murcia: { name: 'Murcia', address: 'C/ Alejandro Séiquer, 5' },
};

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function formatFecha(fecha) {
  if (!fecha) return '';
  const [y, m, d] = fecha.split('-');
  return `${parseInt(d)} de ${MONTH_NAMES[parseInt(m) - 1]} de ${y}`;
}

export default function ReagendarPage() {
  const tokenData = useMemo(() => {
    const sp = new URLSearchParams(window.location.search);
    const t = sp.get('t');
    if (!t) return null;
    try {
      const decoded = atob(t.replace(/-/g, '+').replace(/_/g, '/'));
      const [koibox_id, contact_id, opp_id, clinica] = decoded.split(':');
      return { koibox_id, contact_id, opp_id, clinica };
    } catch {
      return null;
    }
  }, []);

  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState(null); // null | 'reschedule' | 'cancel'
  const [cancelling, setCancelling] = useState(false);
  const [result, setResult] = useState(null); // { type: 'cancelled' | 'rescheduled', data }

  // Fetch current appointment
  useEffect(() => {
    if (!tokenData) {
      setError('Link no válido. Contacta con nosotros al 623 457 218.');
      setLoading(false);
      return;
    }

    fetch('/.netlify/functions/koibox-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_appointment', koibox_id: tokenData.koibox_id }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError('No se encontró la cita. Es posible que ya haya sido cancelada.');
        } else if (data.estado === 5) {
          setError('Esta cita ya fue cancelada.');
        } else {
          setAppointment(data);
        }
      })
      .catch(() => setError('Error al cargar los datos. Inténtalo de nuevo.'))
      .finally(() => setLoading(false));
  }, [tokenData]);

  const handleCancel = async () => {
    if (!confirm('¿Estás seguro de que quieres cancelar tu cita? Esta acción no se puede deshacer.')) return;
    setCancelling(true);

    try {
      const res = await fetch('/.netlify/functions/koibox-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel_appointment',
          koibox_id: tokenData.koibox_id,
          ghl_contact_id: tokenData.contact_id,
          reason: 'Cancelado por el paciente desde link de reagendar',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ type: 'cancelled' });
      } else {
        alert('Error al cancelar. Llámanos al 623 457 218.');
      }
    } catch {
      alert('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setCancelling(false);
    }
  };

  const handleRescheduled = (data) => {
    setResult({ type: 'rescheduled', data });
  };

  // Error / invalid token
  if (error) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-gray-700 font-medium">{error}</p>
          <a href="tel:+34623457218" className="mt-4 inline-block text-[#4CA994] font-bold hover:underline">
            Llamar al 623 457 218
          </a>
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#4CA994] animate-spin" />
      </div>
    );
  }

  // Success result
  if (result) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md text-center">
          {result.type === 'cancelled' ? (
            <>
              <XCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-extrabold text-gray-900 mb-2">Cita cancelada</h2>
              <p className="text-gray-600">
                Tu cita ha sido cancelada correctamente. Si cambias de opinión, llámanos y te ayudamos a reagendar.
              </p>
            </>
          ) : (
            <>
              <CheckCircle className="w-14 h-14 text-[#4CA994] mx-auto mb-4" />
              <h2 className="text-xl font-extrabold text-gray-900 mb-2">Cita reagendada</h2>
              <p className="text-gray-600">
                Tu nueva cita ha sido confirmada. Te enviaremos un recordatorio por WhatsApp.
              </p>
            </>
          )}
          <a href="tel:+34623457218" className="mt-6 inline-block text-sm text-gray-400 hover:text-[#4CA994]">
            ¿Dudas? 623 457 218
          </a>
        </div>
      </div>
    );
  }

  const clinicName = CLINICS[tokenData.clinica]?.name || tokenData.clinica || '';

  // Main view: show appointment + options
  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <div className="bg-[#2C3E50] text-white text-center py-3 px-4 text-sm font-semibold">
        Hospital Capilar — Gestionar Cita
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Current appointment card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tu cita actual</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-800">
              <Calendar className="w-4 h-4 text-[#4CA994]" />
              <span className="font-semibold">{formatFecha(appointment.fecha)}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-800">
              <Clock className="w-4 h-4 text-[#4CA994]" />
              <span className="font-semibold">{appointment.hora_inicio}h</span>
            </div>
            {clinicName && (
              <div className="flex items-center gap-2 text-gray-800">
                <MapPin className="w-4 h-4 text-[#4CA994]" />
                <span className="font-semibold">Hospital Capilar {clinicName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons (when no mode selected) */}
        {!mode && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('reschedule')}
              className="w-full bg-[#4CA994] hover:bg-[#3d9482] text-white font-bold py-4 rounded-xl transition-colors"
            >
              Cambiar fecha u hora
            </button>
            <button
              onClick={() => setMode('cancel')}
              className="w-full bg-white hover:bg-red-50 text-red-600 font-bold py-4 rounded-xl border border-red-200 transition-colors"
            >
              Cancelar cita
            </button>
            <p className="text-center text-xs text-gray-400 mt-2">
              ¿Dudas? Llámanos al <a href="tel:+34623457218" className="text-[#4CA994] font-semibold">623 457 218</a>
            </p>
          </div>
        )}

        {/* Cancel confirmation */}
        {mode === 'cancel' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <h3 className="font-extrabold text-red-800 mb-2">¿Cancelar tu cita?</h3>
            <p className="text-red-700 text-sm mb-4">
              Se liberará tu hueco en la agenda. Si luego quieres volver a reservar, tendrás que hacerlo desde cero.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setMode(null)}
                className="flex-1 bg-white text-gray-700 font-bold py-3 rounded-xl border border-gray-200"
              >
                Volver
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                {cancelling ? 'Cancelando...' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        )}

        {/* Reschedule: show BookingCalendar */}
        {mode === 'reschedule' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-gray-900">Elige nueva fecha</h3>
              <button
                onClick={() => setMode(null)}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium"
              >
                Volver
              </button>
            </div>
            <div className="bg-[#4CA994]/5 border border-[#4CA994]/20 rounded-2xl p-5">
              <BookingCalendar
                ubicacion={tokenData.clinica}
                nombre=""
                email=""
                telefono=""
                contactId={tokenData.contact_id}
                rescheduleFrom={tokenData.koibox_id}
                onBooked={handleRescheduled}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
