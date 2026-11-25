import type { MetadataRoute } from "next";

// Los enlaces de salida a las tiendas (/out) registran clics: los robots no deben seguirlos, o
// inflan las métricas de las marcas. Tampoco hay nada que indexar en /api, /admin ni los paneles.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/out/", "/api/", "/admin", "/marca/panel", "/crear", "/settings"] },
  };
}
