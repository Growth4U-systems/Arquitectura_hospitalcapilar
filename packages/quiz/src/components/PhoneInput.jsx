import { useState, useRef, useEffect } from 'react';

const COUNTRY_CODES = [
  { code: '+34', flag: '🇪🇸', country: 'España' },
  { code: '+351', flag: '🇵🇹', country: 'Portugal' },
  { code: '+33', flag: '🇫🇷', country: 'Francia' },
  { code: '+49', flag: '🇩🇪', country: 'Alemania' },
  { code: '+44', flag: '🇬🇧', country: 'Reino Unido' },
  { code: '+39', flag: '🇮🇹', country: 'Italia' },
  { code: '+52', flag: '🇲🇽', country: 'México' },
  { code: '+57', flag: '🇨🇴', country: 'Colombia' },
  { code: '+54', flag: '🇦🇷', country: 'Argentina' },
  { code: '+56', flag: '🇨🇱', country: 'Chile' },
  { code: '+51', flag: '🇵🇪', country: 'Perú' },
  { code: '+593', flag: '🇪🇨', country: 'Ecuador' },
  { code: '+58', flag: '🇻🇪', country: 'Venezuela' },
  { code: '+1', flag: '🇺🇸', country: 'EE.UU.' },
  { code: '+41', flag: '🇨🇭', country: 'Suiza' },
  { code: '+31', flag: '🇳🇱', country: 'Países Bajos' },
  { code: '+32', flag: '🇧🇪', country: 'Bélgica' },
  { code: '+212', flag: '🇲🇦', country: 'Marruecos' },
];

/**
 * Phone input with country prefix selector.
 * Returns full E.164 phone via onChange: "+34612345678"
 *
 * @param {string} value - Full phone value (e.g. "+34612345678")
 * @param {function} onChange - Called with full E.164 string
 * @param {string} className - Additional classes for the wrapper
 * @param {string} inputClassName - Classes for the number input
 * @param {string} placeholder - Placeholder for number part
 * @param {boolean} required
 * @param {function} onFocus - Optional focus handler
 */
export default function PhoneInput({
  value = '',
  onChange,
  className = '',
  inputClassName = '',
  placeholder = '612 345 678',
  required = false,
  onFocus,
}) {
  // Parse existing value to extract prefix + number
  const parseValue = (val) => {
    if (!val) return { prefix: '+34', number: '' };
    const str = val.replace(/\s/g, '');
    // Try to match a known prefix
    for (const c of COUNTRY_CODES) {
      if (str.startsWith(c.code)) {
        return { prefix: c.code, number: str.slice(c.code.length) };
      }
    }
    // If starts with + but unknown prefix, keep as-is
    if (str.startsWith('+')) {
      return { prefix: '+34', number: str.replace(/^\+\d{1,3}/, '') };
    }
    return { prefix: '+34', number: str };
  };

  const parsed = parseValue(value);
  const [prefix, setPrefix] = useState(parsed.prefix);
  const [number, setNumber] = useState(parsed.number);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Sync if value changes externally
  useEffect(() => {
    const p = parseValue(value);
    setPrefix(p.prefix);
    setNumber(p.number);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const emitChange = (newPrefix, newNumber) => {
    const clean = newNumber.replace(/[^\d]/g, '');
    if (onChange) {
      onChange(clean ? `${newPrefix}${clean}` : '');
    }
  };

  const handleNumberChange = (e) => {
    const raw = e.target.value.replace(/[^\d\s]/g, '');
    setNumber(raw);
    emitChange(prefix, raw);
  };

  const handlePrefixSelect = (code) => {
    setPrefix(code);
    setOpen(false);
    emitChange(code, number);
  };

  const selected = COUNTRY_CODES.find(c => c.code === prefix) || COUNTRY_CODES[0];

  return (
    <div className={`relative flex ${className}`} ref={dropdownRef}>
      {/* Prefix selector */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-3 border-2 border-r-0 border-gray-200 rounded-l-xl bg-gray-50 hover:bg-gray-100 transition-colors shrink-0 text-sm"
        aria-label="Seleccionar prefijo telefónico"
      >
        <span className="text-base">{selected.flag}</span>
        <span className="text-gray-700 font-medium">{selected.code}</span>
        <svg className={`w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
          {COUNTRY_CODES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => handlePrefixSelect(c.code)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm transition-colors ${
                c.code === prefix ? 'bg-[#F0F7F6] font-semibold' : ''
              }`}
            >
              <span className="text-base">{c.flag}</span>
              <span className="text-gray-800">{c.country}</span>
              <span className="text-gray-400 ml-auto">{c.code}</span>
            </button>
          ))}
        </div>
      )}

      {/* Number input */}
      <input
        type="tel"
        value={number}
        onChange={handleNumberChange}
        onFocus={onFocus}
        required={required}
        placeholder={placeholder}
        className={`flex-1 min-w-0 border-2 border-gray-200 rounded-r-xl outline-none text-sm ${inputClassName}`}
      />
    </div>
  );
}
