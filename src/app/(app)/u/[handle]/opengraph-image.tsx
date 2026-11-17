import { ImageResponse } from "next/og";
import { createPublicClient } from "@/lib/supabase/public";
import { imageUrl } from "@/lib/images";
import RootImage from "@/app/opengraph-image";

// Vista previa al compartir un perfil (spec 009, FR-027): foto en círculo, nombre y @usuario sobre
// forest-deep. Se lee como anónimo: un perfil privado, oculto o inexistente da la imagen genérica.
export const alt = "Perfil en Icon";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Raw = { id: string; handle: string; display_name: string; avatar_key: string | null; redirect_brand_slug?: string } | null;

async function avatarPng(key: string): Promise<string | null> {
  try {
    const src = imageUrl(key);
    if (!src) return null;
    const res = await fetch(src);
    if (!res.ok) return null;
    const { default: sharp } = await import("sharp");
    const png = await sharp(Buffer.from(await res.arrayBuffer())).resize(320, 320, { fit: "cover" }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function ProfileImage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const clean = decodeURIComponent(handle).trim().toLowerCase();
  let p: Raw = null;
  if (/^[a-z0-9._]{3,24}$/.test(clean)) {
    const { data } = await createPublicClient().rpc("get_public_profile", { p_handle: clean });
    p = data as Raw;
  }
  if (!p || p.redirect_brand_slug) return RootImage();

  const photo = p.avatar_key ? await avatarPng(p.avatar_key) : null;
  const initials = p.display_name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 64, background: "#143b27", color: "#faf7ef", padding: "72px 88px" }}>
        {photo ? (
          <img src={photo} width={300} height={300} alt="" style={{ borderRadius: 9999, border: "8px solid #9fd08a" }} />
        ) : (
          <div style={{ width: 300, height: 300, borderRadius: 9999, background: "#9fd08a", color: "#16271d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 120, fontWeight: 800 }}>
            {initials || "?"}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1 }}>{p.display_name.slice(0, 40)}</div>
          <div style={{ fontSize: 40, color: "#9fd08a" }}>{`@${p.handle}`}</div>
          <div style={{ fontSize: 30, color: "#faf7efcc", marginTop: 24 }}>Mira sus looks en Icon</div>
        </div>
      </div>
    ),
    size,
  );
}
