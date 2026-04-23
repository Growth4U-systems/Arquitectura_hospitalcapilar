import React from 'react';

const HC_HOME = 'https://hospitalcapilar.com/';

const NAV_ITEMS = [
  { label: 'Clínicas', href: 'https://hospitalcapilar.com/clinicas/' },
  { label: 'Servicios', href: 'https://hospitalcapilar.com/servicios/' },
  { label: 'Equipo médico', href: 'https://hospitalcapilar.com/equipo-medico/' },
  { label: 'Casos de éxito', href: 'https://hospitalcapilar.com/casos-de-exito/' },
  { label: 'Partners', href: 'https://hospitalcapilar.com/partners/' },
  { label: 'Blog', href: 'https://hospitalcapilar.com/blog/' },
  { label: 'Tienda', href: 'https://tienda.hospitalcapilar.com/' },
  { label: 'Contacto', href: 'https://hospitalcapilar.com/contacto/' },
];

const HCHeader = () => (
  <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-4">
      <a href={HC_HOME} target="_blank" rel="noopener noreferrer" className="shrink-0">
        <img
          src="/logo-hc.svg"
          alt="Hospital Capilar"
          className="h-8 md:h-10 w-auto"
        />
      </a>
      <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.label}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-gray-700 hover:text-[#4CA994] transition-colors whitespace-nowrap"
          >
            {item.label}
          </a>
        ))}
      </nav>
    </div>
  </header>
);

export default HCHeader;
