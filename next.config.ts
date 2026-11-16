import type { NextConfig } from "next";

const TUNNEL_HOSTS = [
  "localhost:3000",
  "*.ngrok-free.app",
  "*.ngrok-free.dev",
  "*.ngrok.io",
  "*.trycloudflare.com",
];

const nextConfig: NextConfig = {
  // sharp se usa en server actions (subida a R2); debe ir externo (binario nativo).
  // onnxruntime-web (búsqueda por foto, spec 005) también va externo: carga sus .wasm desde
  // node_modules en tiempo de ejecución y no debe pasar por el bundler.
  serverExternalPackages: ["sharp", "onnxruntime-web"],
  // Solo en dev: permite el websocket de Hot Module Reload cuando se prueba a través
  // de un túnel (otro host que localhost). No afecta `next build` (producción).
  ...(process.env.NODE_ENV !== "production"
    ? { allowedDevOrigins: TUNNEL_HOSTS }
    : {}),
  // Las server actions tienen límite de body de 1 MB por defecto; las fotos lo
  // exceden (se envía el archivo original, no el WebP resultante). Subimos el tope.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
      // Next rechaza un server action si el Origin de la petición no coincide con el
      // host esperado (protección anti-CSRF). Instagram exige un redirect URI https, así
      // que en local se prueba a través de un túnel (ngrok/cloudflared) con otro host —
      // sin este allowlist, el primer formulario que uses ahí (hasta el login) fallaría.
      // Solo en dev: nunca se compila en `next build` (NODE_ENV=production).
      ...(process.env.NODE_ENV !== "production"
        ? { allowedOrigins: TUNNEL_HOSTS }
        : {}),
    },
  },
  // NFT traza el .node de sharp pero NO sigue el dlopen de libvips → el .so
  // (libvips-cpp.so) no se copiaba al bundle serverless y la subida fallaba con
  // ERR_DLOPEN_FAILED. Forzamos incluir el binario de libvips (glibc/linux-x64, el
  // runtime de Vercel) en las rutas cuyas server actions usan sharp.
  outputFileTracingIncludes: {
    "/admin": [
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
    ],
    "/admin/bulk": [
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
    ],
    // Panel de marca: los server actions de este árbol también usan sharp (subida manual
    // de fotos + importación desde Instagram vía uploadImageFromUrl).
    "/marca/panel": [
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
    ],
    "/marca/panel/post/[id]": [
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
    ],
    // Looks de usuarios (spec 008): la primera foto se sube en /crear y las demás en el editor.
    "/crear": [
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
    ],
    "/crear/[id]": [
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
    ],
    "/marca/panel/import": [
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
    ],
    // Búsqueda por foto (spec 005): sharp para preprocesar + el runtime WASM de onnxruntime.
    // El modelo (~89 MB) NO se incluye: se descarga de R2 a /tmp en el arranque en frío.
    "/api/visual/*": [
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.{mjs,wasm}",
      "./node_modules/onnxruntime-web/dist/ort.node.min.*",
    ],
    "/api/embeddings/*": [
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.{mjs,wasm}",
      "./node_modules/onnxruntime-web/dist/ort.node.min.*",
    ],
  },
};

export default nextConfig;
