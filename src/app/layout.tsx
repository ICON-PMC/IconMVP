import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "@/components/ui/sonner";
import { displayFont } from "@/lib/fonts";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Serif del wordmark ICON y de los títulos de la landing (`font-wordmark`).
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const R2_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_BASE ?? "").origin;
  } catch {
    return null;
  }
})();

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://iconcolombia.com"),
  title: "Icon — moda colombiana independiente",
  description:
    "Descubre moda colombiana independiente con intención: por ocasión, ciudad, precio y estilo.",
  manifest: "/manifest.webmanifest",
  applicationName: "Icon",
  appleWebApp: { capable: true, title: "Icon", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#143b27",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} ${displayFont.variable} h-full antialiased`}
    >
      <head>
        {/* Conexión anticipada al host de las fotos (spec 006): ahorra la negociación TLS de la primera imagen. */}
        {R2_ORIGIN && <link rel="preconnect" href={R2_ORIGIN} crossOrigin="" />}
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-center" />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
