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

// ── Cuota por usuario (spec 008): 50 MB entre las fotos de sus looks y su foto de perfil ──
// La suma y el límite viven en `check_user_storage_quota` (20261120010000_user_looks.sql).

export class UserStorageQuotaError extends Error {
  constructor(
    public usedBytes: number,
    public limitBytes: number,
  ) {
    const mb = (b: number) => Math.round(b / 1024 / 1024);
    super(
      `Llegaste al límite de ${mb(limitBytes)} MB de fotos (${mb(usedBytes)} de ${mb(limitBytes)} MB). ` +
        "Borra looks que ya no quieras para subir nuevos.",
    );
    this.name = "UserStorageQuotaError";
  }
}

export async function checkUserStorageQuota(bytes: number): Promise<QuotaResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_user_storage_quota", { p_bytes: bytes });
  if (error) throw new Error(`No se pudo revisar tu espacio de fotos: ${error.message}`);
  return data as QuotaResult;
}

// Lanza UserStorageQuotaError si subir `bytes` más supera la cuota de quien tiene la sesión.
export async function assertUserStorageQuota(bytes: number): Promise<void> {
  const q = await checkUserStorageQuota(bytes);
  if (!q.allowed) throw new UserStorageQuotaError(q.used_bytes, q.limit_bytes);
}
