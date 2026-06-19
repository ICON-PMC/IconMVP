import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp se usa en server actions (subida a R2); debe ir externo (binario nativo).
  serverExternalPackages: ["sharp"],
  // Las server actions tienen límite de body de 1 MB por defecto; las fotos lo
  // exceden (se envía el archivo original, no el WebP resultante). Subimos el tope.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
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
  },
};

export default nextConfig;
