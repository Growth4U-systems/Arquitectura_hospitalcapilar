import React from 'react';
import { CheckCircle, Calendar, Phone } from 'lucide-react';
import BookingCalendar from './BookingCalendar';

const PaymentConfirmation = ({ nombre, email, telefono, ubicacion, onCallRequest, bonoPrice = 125 }) => {
  const firstName = (nombre || 'Paciente').split(' ')[0];

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <div className="bg-[#4CA994] text-white text-center py-3 px-4 text-sm font-semibold sticky top-0 z-10">
        Pago confirmado — Reserva tu cita
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Success */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-[#4CA994] rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
            <CheckCircle size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-1">
            ¡Pago confirmado, {firstName}!
          </h2>
          <p className="text-gray-500 text-sm">
            Confirmación enviada a <strong>{email}</strong>
          </p>
        </div>

        {/* Receipt */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold text-gray-900 text-sm">Test Capilar con Analítica Hormonal</p>
              <p className="text-xs text-gray-400">Analítica + Tricoscopia + Valoración + Informe</p>
            </div>
            <span className="text-xl font-extrabold text-[#4CA994]">{bonoPrice}€</span>
          </div>
        </div>

        {/* Booking section */}
        <div className="bg-[#4CA994]/5 border border-[#4CA994]/20 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={20} className="text-[#4CA994]" />
            <h3 className="font-bold text-gray-900">Siguiente paso: reserva tu cita</h3>
          </div>

          <BookingCalendar
            ubicacion={ubicacion}
            nombre={nombre}
            email={email}
            telefono={telefono}
          />
        </div>

        {/* Fallback */}
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
