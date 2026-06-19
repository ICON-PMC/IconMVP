import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";

// GET /admin/bulk/template → descarga una plantilla .xlsx para carga masiva de prendas.
// La hoja "Referencia" se llena con las marcas/categorías/tallas válidas actuales y
// las columnas marca/categoría tienen dropdowns que apuntan a esa hoja.
export async function GET() {
  await requireStaff();
  const supabase = await createClient();

  const [brandsRes, catsRes, sizesRes] = await Promise.all([
    supabase.from("brands").select("name").order("name"),
    supabase.from("tags").select("name").eq("type", "category").order("name"),
    supabase.from("sizes").select("label").order("sort_order"),
  ]);
  const brands = (brandsRes.data ?? []).map((b) => b.name);
  const categories = (catsRes.data ?? []).map((c) => c.name);
  const sizes = (sizesRes.data ?? []).map((s) => s.label);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Icon";

  const ws = wb.addWorksheet("Prendas");
  ws.columns = [
    { header: "marca", key: "marca", width: 26 },
    { header: "titulo", key: "titulo", width: 30 },
    { header: "precio_cop", key: "precio_cop", width: 14 },
    { header: "url_producto", key: "url_producto", width: 34 },
    { header: "color", key: "color", width: 16 },
    { header: "tela", key: "tela", width: 18 },
    { header: "categoria", key: "categoria", width: 20 },
    { header: "tallas", key: "tallas", width: 22 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.addRow({
    marca: brands[0] ?? "Nombre de la marca",
    titulo: "Camiseta oversize",
    precio_cop: 120000,
    url_producto: "https://tienda.com/producto",
    color: "Negro",
    tela: "Algodón",
    categoria: categories[0] ?? "Camisetas",
    tallas: "S, M, L",
  });

  // Hoja de referencia (valores válidos). No editar.
  const ref = wb.addWorksheet("Referencia (no editar)");
  ref.columns = [
    { header: "Marcas", key: "marcas", width: 28 },
    { header: "Categorías", key: "categorias", width: 24 },
    { header: "Tallas", key: "tallas", width: 14 },
  ];
  ref.getRow(1).font = { bold: true };
  const maxLen = Math.max(brands.length, categories.length, sizes.length);
  for (let i = 0; i < maxLen; i++) {
    ref.addRow([brands[i] ?? null, categories[i] ?? null, sizes[i] ?? null]);
  }

  // Dropdowns en las primeras 500 filas de datos.
  const refName = "'Referencia (no editar)'";
  if (brands.length) {
    for (let r = 2; r <= 501; r++) {
      ws.getCell(`A${r}`).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: [`${refName}!$A$2:$A$${brands.length + 1}`],
      };
    }
  }
  if (categories.length) {
    for (let r = 2; r <= 501; r++) {
      ws.getCell(`G${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`${refName}!$B$2:$B$${categories.length + 1}`],
      };
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="plantilla-prendas-icon.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
