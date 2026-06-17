import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp se usa en server actions (subida a R2); no lo empaquetes.
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
