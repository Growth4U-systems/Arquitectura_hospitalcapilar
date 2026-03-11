import React, { useState } from 'react';
import { CheckCircle, MapPin, Calendar, Phone, ExternalLink } from 'lucide-react';

const KOIBOX_URLS = {
  madrid: { name: 'Madrid', url: 'https://reservas.koibox.cloud/hospital-capilar-central-s-l' },
  pontevedra: { name: 'Pontevedra', url: 'https://reservas.koibox.cloud/hospital-capilar-pontevedra' },
  murcia: { name: 'Murcia', url: 'https://reservas.koibox.cloud/hospital-capilar-murcia' },
};

const PaymentConfirmation = ({ nombre, email, ubicacion, onCallRequest }) => {
  const firstName = (nombre || 'Paciente').split(' ')[0];
  const clinic = KOIBOX_URLS[ubicacion] || null;
  const [showBooking, setShowBooking] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState(clinic);

  const handleBooking = (clinicData) => {
    setSelectedClinic(clinicData);
    setShowBooking(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F0F7F6] to-white">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Success animation */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-[#4CA994] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg animate-[bounceIn_0.5s_ease-out]">
            <CheckCircle size={40} className="text-white" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-1">
            ¡Pago confirmado, {firstName}!
          </h2>
          <p className="text-gray-500 text-sm">
            Hemos enviado confirmación a <strong>{email}</strong>
          </p>
        </div>

        {/* Receipt */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold text-gray-900">Bono Diagnóstico Capilar</p>
              <p className="text-xs text-gray-400 mt-0.5">Tricoscopía + Analítica + Valoración + Plan</p>
            </div>
            <span className="text-xl font-extrabold text-[#4CA994]">195€</span>
          </div>
        </div>

        {/* Next step */}
        <div className="bg-[#4CA994]/5 border border-[#4CA994]/20 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={20} className="text-[#4CA994]" />
            <h3 className="font-bold text-gray-900">Siguiente paso: reserva tu cita</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Elige tu clínica y selecciona el día y hora que prefieras para tu diagnóstico presencial.
          </p>

          {/* Clinic selector */}
          {!showBooking ? (
            <div className="space-y-2">
              {clinic ? (
                // Auto-show their clinic
                <button
                  onClick={() => handleBooking(clinic)}
                  className="w-full bg-[#4CA994] hover:bg-[#3d9480] text-white font-bold py-4 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
                >
                  <MapPin size={18} />
                  Reservar en {clinic.name}
                </button>
              ) : (
                // Show all clinics
                Object.entries(KOIBOX_URLS).map(([key, data]) => (
                  <button
                    key={key}
                    onClick={() => handleBooking(data)}
                    className="w-full bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <MapPin size={16} className="text-[#4CA994]" />
                    {data.name}
                  </button>
                ))
              )}

              {clinic && (
                <button
                  onClick={() => setShowBooking(false)}
                  className="w-full text-center text-xs text-gray-400 mt-1"
                >
                  ¿Prefieres otra clínica?
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-3">
                <div className="bg-gray-50 px-4 py-2 flex items-center justify-between border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <MapPin size={14} className="text-[#4CA994]" />
                    {selectedClinic.name}
                  </span>
                  <a
                    href={selectedClinic.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#4CA994] flex items-center gap-1 hover:underline"
                  >
                    Abrir en nueva pestaña <ExternalLink size={12} />
                  </a>
                </div>
                <iframe
                  src={selectedClinic.url}
                  title={`Reservar cita en ${selectedClinic.name}`}
                  className="w-full border-0"
                  style={{ height: '600px' }}
                  loading="lazy"
                />
              </div>
              <button
                onClick={() => setShowBooking(false)}
                className="w-full text-center text-sm text-gray-500 hover:text-[#4CA994] transition-colors"
              >
                ← Elegir otra clínica
              </button>
            </div>
          )}
        </div>

        {/* Fallback contact */}
        <div className="text-center">
          <button
            onClick={onCallRequest}
            className="text-sm text-gray-500 hover:text-[#4CA994] transition-colors flex items-center justify-center gap-1 mx-auto"
          >
            <Phone size={14} />
            ¿Prefieres que te llamemos para agendar?
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentConfirmation;
