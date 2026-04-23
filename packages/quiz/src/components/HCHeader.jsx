import React from 'react';

// Visual-only header for the direct paywall (/p/). Mirrors hospitalcapilar.com's
// top bar for brand/trust, but nav items are not clickable — no exit ramps from
// the paywall.
const NAV_ITEMS = ['Clínicas', 'Servicios', 'Equipo médico', 'Casos de éxito', 'Partners', 'Blog', 'Tienda', 'Contacto'];

const HCHeader = () => (
  <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-4">
      <img
        src="/logo-hc.svg"
        alt="Hospital Capilar"
        className="h-8 md:h-10 w-auto shrink-0"
      />
      <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
        {NAV_ITEMS.map((label) => (
          <span
            key={label}
            className="text-sm font-semibold text-gray-700 whitespace-nowrap cursor-default"
          >
            {label}
          </span>
        ))}
      </nav>
    </div>
  </header>
);

export default HCHeader;
