// Arma el Excel para la carga masiva (/admin/bulk) a partir de los productos de una tienda.
// Mismo formato de columnas que acepta `importGarments`. Compartido por el CLI y el panel.
// Módulo sin dependencias de Next.
import ExcelJS from "exceljs";
import { MAX_TAGS_PER_TYPE, htmlToText, inferCategory, matchTags, normalizeSizes } from "./infer";
import type { Product } from "./shopify";
import type { Vocabulary } from "./vocabulary";

export type BuildStats = {
  products: number;
  photos: number;
  no_photo: number;
  no_category: number;
  no_size: number;
  no_price: number;
  with_style: number;
  with_occasion: number;
  with_climate: number;
};

// Datos de la corrida del panel: van en una hoja OCULTA para que, al subir el Excel, se pueda vincular
// la importación con su corrida (registro de procedencia).
export type WorkbookRun = { runId: string; brandId: string; generatedAt: string };

export const SUGGESTION_NOTE = "Sugerido automáticamente; revísalo antes de importar.";
const BIG_PHOTO_BYTES = 9.5 * 1024 * 1024;

export function buildWorkbook(opts: {
  brandName: string;
  products: Product[];
  vocab: Vocabulary;
  origin: string | null;
  currency?: string;
  run?: WorkbookRun;
}): {
  workbook: ExcelJS.Workbook;
  stats: BuildStats;
  unknownSizes: Record<string, number>;
  // Avisos por producto (misma posición que `products`): lo que va en la columna `revisar`.
  rowNotes: string[][];
} {
  const { brandName, products, vocab, origin, currency, run } = opts;

  const columns = [
    { header: "marca", key: "marca", width: 26 },
    { header: "titulo", key: "titulo", width: 34 },
    { header: "descripcion", key: "descripcion", width: 50 },
    { header: "precio_cop", key: "precio_cop", width: 14 },
    { header: "url_producto", key: "url_producto", width: 40 },
    { header: "color", key: "color", width: 18 },
    { header: "tela", key: "tela", width: 18 },
    { header: "categoria", key: "categoria", width: 22 },
    { header: "tallas", key: "tallas", width: 22 },
    { header: "estilo", key: "estilo", width: 24 },
    { header: "ocasion", key: "ocasion", width: 24 },
    { header: "clima", key: "clima", width: 16 },
    // Las dos últimas las ignora el importador; son para ti.
    { header: "foto", key: "foto", width: 40 },
    { header: "revisar", key: "revisar", width: 60 },
  ];
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Prendas");
  ws.columns = columns;
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const stats: BuildStats = {
    products: products.length,
    photos: 0,
    no_photo: 0,
    no_category: 0,
    no_size: 0,
    no_price: 0,
    with_style: 0,
    with_occasion: 0,
    with_climate: 0,
  };
  const unknownSizes: Record<string, number> = {};
  const rowNotes: string[][] = [];

  for (const p of products) {
    const notes: string[] = [];
    const categoria = inferCategory(p, vocab);
    if (!categoria) {
      stats.no_category++;
      notes.push("asignar categoría");
    }
    const { sizes, unknown } = normalizeSizes(p.sizes, vocab);
    for (const u of unknown) unknownSizes[u] = (unknownSizes[u] ?? 0) + 1;
    if (!sizes.length) {
      stats.no_size++;
      notes.push("sin talla");
    }
    if (unknown.length) notes.push(`talla que no existe en Icon (se omite al importar): ${unknown.join(", ")}`);
    if (p.price == null) {
      stats.no_price++;
      notes.push("sin precio");
    }
    if (currency && currency !== "COP") notes.push(`precio en ${currency}, no COP`);

    const estilo = matchTags(p, vocab.styles);
    const ocasion = matchTags(p, vocab.occasions);
    const clima = matchTags(p, vocab.climates);
    for (const [label, m] of [["estilo", estilo], ["ocasión", ocasion], ["clima", clima]] as const)
      if (m.overflow) notes.push(`más de ${MAX_TAGS_PER_TYPE} de ${label} en la tienda: se dejaron ${MAX_TAGS_PER_TYPE}`);
    if (estilo.names.length) stats.with_style++;
    if (ocasion.names.length) stats.with_occasion++;
    if (clima.names.length) stats.with_climate++;

    // Foto: los avisos van al final de la fila, como en el CLI.
    const photo = p.photo;
    let foto = "";
    if (!p.image_url) {
      stats.no_photo++;
      notes.push("la tienda no trae foto");
    } else if (photo?.status === "ok" && photo.file) {
      foto = photo.file;
      stats.photos++;
      if (photo.bytes > BIG_PHOTO_BYTES) notes.push("foto > 10 MB: el panel la rechazará, reduce su tamaño");
    } else if (photo?.status === "failed" || photo?.status === "blocked" || photo?.status === "pending") {
      stats.no_photo++;
      notes.push("foto no descargada");
    }
    // status "skipped" (el staff pidió no descargar fotos): ni cuenta ni avisa.

    rowNotes.push(notes);
    ws.addRow({
      marca: brandName,
      titulo: p.title,
      descripcion: htmlToText(p.description_html),
      // Entero a propósito: el importador borra todo lo que no sea dígito, así que "189000.00" se leería como 18900000.
      precio_cop: p.price != null ? Math.round(p.price) : "",
      url_producto: origin ? `${origin}/products/${p.handle}` : "",
      color: p.colors.join(", "),
      tela: "",
      categoria,
      tallas: sizes.join(", "),
      estilo: estilo.names.join(", "),
      ocasion: ocasion.names.join(", "),
      clima: clima.names.join(", "),
      foto,
      revisar: notes.join("; "),
    });
  }

  // Hoja de referencia con los valores EXACTOS de la base (misma forma que la plantilla de /admin/bulk)
  // y desplegables en marca y categoría, para no tener que adivinar cómo se escribe cada nombre.
  const refName = "Referencia (no editar)";
  const ref = wb.addWorksheet(refName);
  ref.columns = [
    { header: "Marcas", key: "marcas", width: 28 },
    { header: "Categorías", key: "categorias", width: 24 },
    { header: "Tallas", key: "tallas", width: 14 },
    { header: "Estilos (hasta 3, con coma)", key: "estilos", width: 28 },
    { header: "Ocasiones (hasta 3, con coma)", key: "ocasiones", width: 30 },
    { header: "Climas (hasta 3, con coma)", key: "climas", width: 28 },
  ];
  ref.getRow(1).font = { bold: true };
  const brandList = vocab.brands.length ? vocab.brands : [brandName];
  const sizeList = vocab.sizes.map((x) => x.label);
  const lists = [brandList, vocab.categories, sizeList, vocab.styles.map((t) => t.name), vocab.occasions.map((t) => t.name), vocab.climates.map((t) => t.name)];
  for (let r = 0; r < Math.max(...lists.map((l) => l.length)); r++) ref.addRow(lists.map((l) => l[r] ?? null));

  const q = `'${refName}'`;
  const lastRow = Math.max(501, products.length + 1 + 200);
  for (let r = 2; r <= lastRow; r++) {
    ws.getCell(`A${r}`).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`${q}!$A$2:$A$${brandList.length + 1}`],
      showErrorMessage: true,
      errorTitle: "Marca no válida",
      error: "Elige la marca de la lista (hoja Referencia).",
    };
    ws.getCell(`H${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`${q}!$B$2:$B$${vocab.categories.length + 1}`],
      showErrorMessage: true,
      errorTitle: "Categoría no válida",
      error: "Elige una categoría de la lista (hoja Referencia).",
    };
  }
  // Estilo/ocasión/clima admiten varios valores separados por coma, y un desplegable estricto solo deja uno:
  // por eso aquí el desplegable ayuda a elegir pero NO bloquea lo que escribas.
  for (const [col, refCol, list, title] of [
    ["J", "D", vocab.styles, "Estilo"],
    ["K", "E", vocab.occasions, "Ocasión"],
    ["L", "F", vocab.climates, "Clima"],
  ] as const) {
    if (!list.length) continue;
    for (let r = 2; r <= lastRow; r++) {
      ws.getCell(`${col}${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`${q}!$${refCol}$2:$${refCol}$${list.length + 1}`],
        showErrorMessage: false,
        showInputMessage: true,
        promptTitle: title,
        prompt: `Elige uno de la lista o escribe hasta ${MAX_TAGS_PER_TYPE} separados por coma.`,
      };
    }
  }
  ws.getCell("J1").note = `Estilo: hasta ${MAX_TAGS_PER_TYPE}, separados por coma. Valores válidos en la hoja «Referencia (no editar)». ${SUGGESTION_NOTE}`;
  ws.getCell("K1").note = `Ocasión: hasta ${MAX_TAGS_PER_TYPE}, separadas por coma. Valores válidos en la hoja «Referencia (no editar)». ${SUGGESTION_NOTE}`;
  ws.getCell("L1").note = `Clima: hasta ${MAX_TAGS_PER_TYPE}, separados por coma. Valores válidos en la hoja «Referencia (no editar)». ${SUGGESTION_NOTE}`;
  ws.getCell("H1").note = `Elige de la lista desplegable. Son las categorías que existen en Icon. ${SUGGESTION_NOTE}`;
  ws.getCell("I1").note =
    "Varias tallas separadas por coma, por ejemplo: S, M, L. Excel no permite elegir varias de una lista: " +
    "los valores válidos están en la hoja «Referencia (no editar)». Una talla que no esté ahí se omite al importar.";
  ws.getCell("M1").note = "Solo para ti: nombre del archivo en la carpeta fotos/. Es la llave para emparejar cada foto con su prenda.";
  ws.getCell("N1").note = "Solo para ti: cosas por revisar en esa fila. El importador la ignora.";

  if (run) {
    const origen = wb.addWorksheet("Origen (no editar)", { state: "hidden" });
    origen.addRow(["run_id", run.runId]);
    origen.addRow(["marca_id", run.brandId]);
    origen.addRow(["generado", run.generatedAt]);
  }

  return { workbook: wb, stats, unknownSizes, rowNotes };
}
