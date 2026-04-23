import React from 'react';

// Visual-only header for the direct paywall (/p/). Renders the actual
// hospitalcapilar.com logo centered, no nav — pure brand/trust signal with
// zero exit ramps.
const HC_LOGO_URL = 'https://res.cloudinary.com/dsc0jsbkz/image/upload/v1776852800/LOGO_POSITIVO_lsmah2.png';

const HCHeader = () => (
  <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-center">
      <img
        src={HC_LOGO_URL}
        alt="Hospital Capilar"
        className="h-8 md:h-10 w-auto"
      />
    </div>
  </header>
);

export default HCHeader;
