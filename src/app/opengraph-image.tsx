import { ImageResponse } from "next/og";

// Imagen para compartir en redes (spec 007, US6): símbolo de Icon sobre forest-deep y la frase de
// marca. Next la usa como og:image y twitter:image del sitio (las páginas pueden definir la suya).
export const alt = "Icon — moda colombiana independiente";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SYMBOL = `data:image/svg+xml;base64,${Buffer.from(
  `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <path d="M256 238 V198 A40 40 0 0 1 336 198" fill="none" stroke="#ee5a2d" stroke-width="50" stroke-linecap="round"/>
    <path d="M256 238 L88 356 H424 Z" fill="none" stroke="#faf7ef" stroke-width="50" stroke-linejoin="round"/>
  </svg>`,
).toString("base64")}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#143b27",
          color: "#faf7ef",
          padding: "72px 80px",
        }}
      >
        <img src={SYMBOL} width={180} height={180} alt="" />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 88, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>Icon</div>
          <div style={{ fontSize: 44, lineHeight: 1.2, color: "#9fd08a" }}>Moda colombiana independiente</div>
          <div style={{ fontSize: 30, color: "#faf7efcc" }}>Busca por ocasión, ciudad, precio y estilo.</div>
        </div>
      </div>
    ),
    size,
  );
}
