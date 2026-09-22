// Íconos de línea, dibujados aquí y no traídos de una librería.
//
// Son ocho trazos: bajar lucide-react entero para esto engordaría el bundle sin
// que se vea la diferencia. Y dibujarlos con la misma caja (24×24), el mismo
// grosor y los mismos remates es lo único que hace que se vean parejos entre
// sí — con glifos de texto (◧ ▭ ☻) cada sistema mete su fuente y ninguno queda
// alineado con el de al lado.
const TRAZOS = {
  casa: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  grafica: (
    <>
      <path d="M4 19V9M10 19V5M16 19v-7" />
      <path d="M22 19H2" />
    </>
  ),
  cartera: (
    <>
      <path d="M4 6h14a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3h12" />
      <path d="M15 11h7v4h-7a2 2 0 0 1 0-4Z" />
    </>
  ),
  recibo: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  reloj: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 6.9V12l3.4 2.2" />
    </>
  ),
  alerta: (
    <>
      <path d="M12 3.6 2.6 19.4h18.8L12 3.6Z" />
      <path d="M12 9.4v4.4M12 16.8v.1" />
    </>
  ),
  calendario: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  ticket: (
    <>
      <path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6Z" />
      <path d="M13 5v3M13 11v2M13 16v3" />
    </>
  ),
  mas: <path d="M12 5v14M5 12h14" />,
  clip: <path d="M20 11.5 12.6 19a4.5 4.5 0 0 1-6.4-6.4l7.6-7.6a3 3 0 0 1 4.2 4.2l-7.5 7.6a1.5 1.5 0 0 1-2.2-2.1l6.8-6.9" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  equis: <path d="M6 6l12 12M18 6 6 18" />,
  deshacer: (
    <>
      <path d="M3 9h11a5 5 0 0 1 0 10H8" />
      <path d="m7 5-4 4 4 4" />
    </>
  ),
  lapiz: (
    <>
      <path d="M4 20h4l10.5-10.5a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m14.5 5.5 4 4" />
    </>
  ),
  tarjeta: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
      <path d="M2.5 10h19M6 15h4" />
    </>
  ),
  bandeja: (
    <>
      <path d="M3 13.5V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4.5" />
      <path d="M3 13.5h5l1.5 2.5h5l1.5-2.5h5" />
      <path d="m7 8 5-5 5 5M12 3v8.5" />
    </>
  ),
}

export default function Icono({ name, size = 20, className }) {
  if (!TRAZOS[name]) return null
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {TRAZOS[name]}
    </svg>
  )
}
