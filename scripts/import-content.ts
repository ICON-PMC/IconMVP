/**
 * Cargador de contenido masivo de Icon (rol del equipo).
 *
 * Usa la service_role key (omite RLS) para cargar marcas, prendas y posts desde un JSON.
 * Uso:  npm run db:import            (usa scripts/sample-content.json)
 *       npm run db:import -- ruta/al/archivo.json
 *
 * Idempotencia: las marcas se hacen upsert por slug. Prendas y posts se insertan;
 * para una recarga limpia: `supabase db reset` y volver a importar.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

// ── Cargar variables desde .env.local (sin dependencias) ──────────
function loadEnv(path: string) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    /* sin .env.local: se usan las env del entorno */
  }
}
loadEnv(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  process.exit(1);
}

const supabase = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Tipos del archivo de entrada ─────────────────────────────────
type InputBrand = {
  slug: string;
  name: string;
  city?: string;
  store_url?: string;
  instagram?: string;
  price_range?: Database["public"]["Enums"]["price_range"];
  bio?: string;
  logo_url?: string;
  is_verified?: boolean;
  is_sustainable?: boolean;
};
type InputGarment = {
  ref: string;
  brand: string;
  title: string;
  description?: string;
  price_cop?: number;
  product_url?: string;
  color?: string;
  fabric?: string;
  status?: Database["public"]["Enums"]["garment_status"];
  category?: string;
  sizes?: string[];
  images?: string[];
};
type InputPost = {
  author: string; // "brand:slug" | "team:slug" | "user:authId"
  caption?: string;
  status?: Database["public"]["Enums"]["post_status"];
  occasions?: string[];
  styles?: string[];
  temperatures?: string[];
  images?: string[];
  items?: { garment: string; size?: string }[];
};
type InputFile = { brands?: InputBrand[]; garments?: InputGarment[]; posts?: InputPost[] };

function must<T>(
  res: { data: T; error: { message: string } | null },
  ctx: string,
): NonNullable<T> {
  if (res.error) throw new Error(`${ctx}: ${res.error.message}`);
  if (res.data == null) throw new Error(`${ctx}: sin datos`);
  return res.data as NonNullable<T>;
}

function nowIfPublished(status?: string) {
  return status === "published" ? new Date().toISOString() : null;
}

async function main() {
  const file = process.argv[2] ?? "scripts/sample-content.json";
  const input = JSON.parse(readFileSync(file, "utf8")) as InputFile;
  console.log(`→ Importando desde ${file}\n`);

  // ── Lookups del vocabulario ────────────────────────────────────
  const cities = must(await supabase.from("cities").select("id, slug"), "cities");
  const cityId = new Map(cities.map((c) => [c.slug, c.id]));

  const tags = must(await supabase.from("tags").select("id, type, slug"), "tags");
  const tagId = new Map(tags.map((t) => [`${t.type}:${t.slug}`, t.id]));

  const sizes = must(await supabase.from("sizes").select("id, label"), "sizes");
  const sizeId = new Map(sizes.map((s) => [s.label.toLowerCase(), s.id]));

  async function ensureSize(label: string): Promise<string> {
    const norm = label.trim();
    const key = norm.toLowerCase();
    const found = sizeId.get(key);
    if (found) return found;
    const system = /^\d+([.,]\d+)?$/.test(norm) ? "numeric" : "special";
    const row = must(
      await supabase.from("sizes").insert({ system, label: norm }).select("id").single(),
      `crear talla ${norm}`,
    );
    sizeId.set(key, row.id);
    return row.id;
  }

  // ── Marcas (upsert por slug) ───────────────────────────────────
  const brandId = new Map<string, string>();
  for (const b of input.brands ?? []) {
    const row = must(
      await supabase
        .from("brands")
        .upsert(
          {
            slug: b.slug,
            name: b.name,
            city_id: b.city ? (cityId.get(b.city) ?? null) : null,
            store_url: b.store_url ?? null,
            instagram: b.instagram ?? null,
            price_range: b.price_range ?? null,
            bio: b.bio ?? null,
            logo_url: b.logo_url ?? null,
            is_verified: b.is_verified ?? false,
            is_sustainable: b.is_sustainable ?? false,
          },
          { onConflict: "slug" },
        )
        .select("id")
        .single(),
      `marca ${b.slug}`,
    );
    brandId.set(b.slug, row.id);
  }
  console.log(`✓ ${brandId.size} marcas`);

  // ── Prendas (+ categoría, tallas, imágenes) ────────────────────
  const garmentId = new Map<string, string>();
  let imgCount = 0;
  for (const g of input.garments ?? []) {
    const bId = brandId.get(g.brand);
    if (!bId) throw new Error(`prenda ${g.ref}: marca desconocida "${g.brand}"`);

    const row = must(
      await supabase
        .from("garments")
        .insert({
          brand_id: bId,
          title: g.title,
          description: g.description ?? null,
          price_cop: g.price_cop ?? null,
          product_url: g.product_url ?? null,
          color: g.color ?? null,
          fabric: g.fabric ?? null,
          status: g.status ?? "published",
          source: "team",
          published_at: nowIfPublished(g.status ?? "published"),
        })
        .select("id")
        .single(),
      `prenda ${g.ref}`,
    );
    garmentId.set(g.ref, row.id);

    if (g.category) {
      const tId = tagId.get(`category:${g.category}`);
      if (!tId) throw new Error(`prenda ${g.ref}: categoría desconocida "${g.category}"`);
      must(
        await supabase.from("garment_tags").upsert({ garment_id: row.id, tag_id: tId }).select(),
        `garment_tags ${g.ref}`,
      );
    }
    for (const label of g.sizes ?? []) {
      const sId = await ensureSize(label);
      await supabase.from("garment_sizes").upsert({ garment_id: row.id, size_id: sId });
    }
    let pos = 0;
    for (const cf of g.images ?? []) {
      must(
        await supabase.from("garment_images").insert({ garment_id: row.id, cf_image_id: cf, position: pos++ }).select(),
        `garment_images ${g.ref}`,
      );
      imgCount++;
    }
  }
  console.log(`✓ ${garmentId.size} prendas · ${imgCount} imágenes de prenda`);

  // ── Posts (+ tags de look, items, imágenes) ────────────────────
  let postCount = 0;
  let itemCount = 0;
  for (const p of input.posts ?? []) {
    const [authorType, authorRef] = p.author.split(":");
    const post = must(
      await supabase
        .from("posts")
        .insert({
          author_type: authorType as Database["public"]["Enums"]["post_author_type"],
          author_brand_id:
            authorType === "user" ? null : (brandId.get(authorRef) ?? null),
          author_user_id: authorType === "user" ? authorRef : null,
          caption: p.caption ?? null,
          status: p.status ?? "published",
          published_at: nowIfPublished(p.status ?? "published"),
        })
        .select("id")
        .single(),
      `post (${p.author})`,
    );

    const lookTags: { type: string; slugs?: string[] }[] = [
      { type: "occasion", slugs: p.occasions },
      { type: "style", slugs: p.styles },
      { type: "temperature", slugs: p.temperatures },
    ];
    for (const { type, slugs } of lookTags) {
      for (const slug of slugs ?? []) {
        const tId = tagId.get(`${type}:${slug}`);
        if (!tId) throw new Error(`post ${p.author}: ${type} desconocido "${slug}"`);
        await supabase.from("post_tags").upsert({ post_id: post.id, tag_id: tId });
      }
    }
    let pos = 0;
    for (const cf of p.images ?? []) {
      await supabase.from("post_images").insert({ post_id: post.id, cf_image_id: cf, position: pos++ });
    }
    for (const it of p.items ?? []) {
      const gId = garmentId.get(it.garment);
      if (!gId) throw new Error(`post ${p.author}: prenda desconocida "${it.garment}"`);
      const sId = it.size ? await ensureSize(it.size) : null;
      must(
        await supabase
          .from("post_items")
          .insert({ post_id: post.id, garment_id: gId, size_id: sId })
          .select(),
        `post_items ${it.garment}`,
      );
      itemCount++;
    }
    postCount++;
  }
  console.log(`✓ ${postCount} posts · ${itemCount} prendas taggeadas\n`);
  console.log("Listo.");
}

main().catch((err) => {
  console.error("\n✗ Error:", err.message);
  process.exit(1);
});
