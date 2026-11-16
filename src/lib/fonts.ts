import { Bricolage_Grotesque } from "next/font/google";

// Tipografía de exhibición de la app (spec 007, D2): variable, licencia OFL. Las otras dos
// candidatas (Archivo, Familjen Grotesk) se cargan solo en /admin/estilo para compararlas; cuando
// la dueña elija (T018), queda aquí la elegida.
export const displayFont = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-display-family",
});
