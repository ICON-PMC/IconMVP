import { Bricolage_Grotesque } from "next/font/google";

// Tipografía de exhibición de la app (spec 007, D2): Bricolage Grotesque, variable, licencia OFL.
// Elegida por la dueña el 2026-11-16 frente a Archivo y Familjen Grotesk. El wordmark sigue en serif.
export const displayFont = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-display-family",
});
