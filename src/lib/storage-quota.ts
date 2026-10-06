import { createClient } from "@/lib/supabase/server";

// Cuota de R2 por marca (300 MB). La suma y el límite viven en la función
// `check_storage_quota` (supabase/migrations/20260926010000_storage_quota.sql).

export class StorageQuotaError extends Error {
  constructor(
    public usedBytes: number,
    public limitBytes: number,
  ) {
    const mb = (b: number) => Math.round(b / 1024 / 1024);
    super(
      `Llegaste al límite de almacenamiento de tu marca (${mb(usedBytes)} de ${mb(limitBytes)} MB). ` +
        "Borra fotos o prendas que ya no uses para subir nuevas.",
    );
    this.name = "StorageQuotaError";
  }
}

type QuotaResult = { allowed: boolean; used_bytes: number; limit_bytes: number };

export async function checkStorageQuota(brandId: string, bytes: number): Promise<QuotaResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_storage_quota", {
    p_brand_id: brandId,
    p_bytes: bytes,
  });
  if (error) throw new Error(`No se pudo revisar la cuota de almacenamiento: ${error.message}`);
  return data as QuotaResult;
}

// Lanza StorageQuotaError si subir `bytes` más supera la cuota de la marca.
export async function assertStorageQuota(brandId: string, bytes: number): Promise<void> {
  const q = await checkStorageQuota(brandId, bytes);
  if (!q.allowed) throw new StorageQuotaError(q.used_bytes, q.limit_bytes);
}
