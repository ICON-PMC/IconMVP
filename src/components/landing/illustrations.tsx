// Ilustraciones de las landings (boceto Note 4_11_2026). SVG decorativos con la paleta de Icon.
// Los colores salen de los tokens de globals.css vía var(--color-*).

const INK = "var(--color-ink)";
const SKIN = "#e9b28f";
const SKIN_DARK = "#c98b62";

type PersonProps = { fill?: string; hair?: string; className?: string };

// Persona de perfil mirando a la derecha.
export function PersonRight({ fill = "var(--color-coral-soft)", hair = INK, className }: PersonProps) {
  return (
    <svg viewBox="0 0 130 170" className={className} aria-hidden="true">
      <path d="M8 170 C8 122 34 100 66 100 C98 100 122 122 122 170 Z" fill={fill} stroke={INK} strokeWidth="3" />
      <path d="M54 82 L54 102 L78 102 L76 82 Z" fill={SKIN} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <ellipse cx="66" cy="54" rx="30" ry="34" fill={SKIN} stroke={INK} strokeWidth="3" />
      <path d="M36 56 C30 22 60 8 82 16 C98 22 102 36 96 44 C84 38 66 40 58 30 C54 44 46 52 36 56 Z" fill={hair} />
      <circle cx="84" cy="56" r="2.6" fill={INK} />
      <path d="M90 72 Q86 76 80 75" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// Persona de perfil mirando a la izquierda (con moño).
export function PersonLeft({ fill = "var(--color-sky)", hair = INK, className }: PersonProps) {
  return (
    <svg viewBox="0 0 130 170" className={className} aria-hidden="true">
      <g transform="translate(130 0) scale(-1 1)">
        <path d="M8 170 C8 122 34 100 66 100 C98 100 122 122 122 170 Z" fill={fill} stroke={INK} strokeWidth="3" />
        <path d="M54 82 L54 102 L78 102 L76 82 Z" fill={SKIN_DARK} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <ellipse cx="66" cy="54" rx="30" ry="34" fill={SKIN_DARK} stroke={INK} strokeWidth="3" />
        <path d="M34 50 C34 18 62 10 80 14 C100 18 104 34 98 42 C92 30 70 30 60 34 C48 38 40 44 34 50 Z" fill={hair} />
        <circle cx="34" cy="52" r="7" fill={hair} />
        <circle cx="84" cy="56" r="2.6" fill={INK} />
        <path d="M90 72 Q86 76 80 75" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

const TEE_PATH =
  "M30 18 L42 12 Q50 22 58 12 L70 18 L88 34 L76 46 L68 38 L68 90 L32 90 L32 38 L24 46 L12 34 Z";

function TeeShape({ fill, transform }: { fill: string; transform?: string }) {
  return (
    <g transform={transform}>
      <path d={TEE_PATH} fill={fill} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
    </g>
  );
}

// Persona que muestra una camiseta ("Busca todo lo que necesites").
export function ShirtHolder({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 220" className={className} aria-hidden="true">
      <path d="M40 220 C40 170 62 150 92 150 C122 150 144 170 144 220 Z" fill="var(--color-leaf)" stroke={INK} strokeWidth="3" />
      <ellipse cx="92" cy="104" rx="30" ry="33" fill={SKIN} stroke={INK} strokeWidth="3" />
      <path d="M62 100 C58 66 90 58 108 66 C122 72 124 88 118 94 C104 84 84 92 74 82 C72 92 68 98 62 100 Z" fill={INK} />
      <path d="M130 166 C150 150 160 120 170 92" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M52 168 C36 150 34 124 40 96" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <TeeShape fill="var(--color-honey)" transform="translate(118 18) rotate(10) scale(1.04)" />
      <circle cx="40" cy="92" r="7" fill={SKIN} stroke={INK} strokeWidth="3" />
    </svg>
  );
}

// Caja abierta con ropa ("Guarda todos tus gustos").
export function ClothesBox({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 190" className={className} aria-hidden="true">
      <TeeShape fill="var(--color-sky)" transform="translate(36 6) rotate(-14) scale(.7)" />
      <TeeShape fill="var(--color-coral)" transform="translate(96 4) rotate(12) scale(.66)" />
      <path d="M128 50 C128 36 150 30 160 40 C166 46 166 56 160 60 L132 64 Z" fill="var(--color-honey)" stroke={INK} strokeWidth="3" />
      <path d="M20 86 L110 64 L200 86 L110 110 Z" fill="var(--color-honey-soft)" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M20 86 L20 160 L110 186 L110 110 Z" fill="var(--color-coral-soft)" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M200 86 L200 160 L110 186 L110 110 Z" fill="var(--color-blush)" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M20 86 L4 112 L94 136 L110 110 Z" fill="var(--color-honey-soft)" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M200 86 L216 112 L126 136 L110 110 Z" fill="var(--color-honey-soft)" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

export function Bookmark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 40" className={className} aria-hidden="true">
      <path d="M3 3 H27 V37 L15 27 L3 37 Z" fill="var(--color-coral)" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

export function CurvedArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 24" className={className} aria-hidden="true">
      <path d="M2 12 C20 4 38 20 54 12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M46 5 L56 12 L46 19" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Íconos de prendas (tablero de guardados): mismo trazo de tinta y paleta.
export function DressIcon({ fill = "var(--color-coral)", className }: { fill?: string; className?: string }) {
  return (
    <svg viewBox="0 0 60 80" className={className} aria-hidden="true">
      <path
        d="M22 4 L26 14 Q30 18 34 14 L38 4 L44 8 L40 26 L54 74 Q30 80 6 74 L20 26 L16 8 Z"
        fill={fill}
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M20 26 Q30 31 40 26" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function PantsIcon({ fill = "var(--color-sky)", className }: { fill?: string; className?: string }) {
  return (
    <svg viewBox="0 0 60 80" className={className} aria-hidden="true">
      <path
        d="M14 4 H46 L52 76 H36 L30 30 L24 76 H8 Z"
        fill={fill}
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M14 12 H46" stroke={INK} strokeWidth="2.5" />
    </svg>
  );
}

export function BagIcon({ fill = "var(--color-honey)", className }: { fill?: string; className?: string }) {
  return (
    <svg viewBox="0 0 60 80" className={className} aria-hidden="true">
      <path d="M20 30 C20 12 40 12 40 30" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M8 30 H52 L48 72 H12 Z" fill={fill} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="30" cy="46" r="3.5" fill={INK} />
    </svg>
  );
}
