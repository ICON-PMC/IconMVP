// Emparejado de las fotos de una carpeta con las prendas creadas desde el Excel, por el nombre de archivo
// de la columna `foto` (no por el orden de las filas). Módulo puro, sin React.

export type ExpectedPhoto = { line: number; file: string; garmentId: string };

export type MatchResult = {
  matched: { file: File; garmentId: string; line: number }[];
  // Fotos de la carpeta que ninguna prenda pidió.
  filesWithoutGarment: File[];
  // Prendas cuya foto no está en la carpeta (o está repetida de forma ambigua).
  garmentsWithoutFile: { line: number; garmentId: string; expectedFile: string }[];
  // Nombres que aparecen en más de una subcarpeta: no se sube ninguno.
  ambiguous: string[];
  // Archivos que no son imágenes (.DS_Store, el propio Excel, LEEME.txt…): se ignoran sin ruido.
  ignored: number;
};

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i;
export const isImageFile = (f: File) => f.type.startsWith("image/") || IMAGE_EXT.test(f.name);

// Unicode NFC, minúsculas y solo el nombre (sin ruta): "Fotos/Vestído.JPG" ≈ "vestído.jpg".
export function normalizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  return base.normalize("NFC").trim().toLowerCase();
}

export function matchPhotos(files: File[], expected: ExpectedPhoto[]): MatchResult {
  const images = files.filter(isImageFile);
  const byName = new Map<string, File[]>();
  for (const f of images) {
    const k = normalizeFileName(f.name);
    byName.set(k, [...(byName.get(k) ?? []), f]);
  }

  const ambiguous = [...byName.entries()].filter(([, list]) => list.length > 1).map(([, list]) => list[0].name);
  const used = new Set<string>();
  const matched: MatchResult["matched"] = [];
  const garmentsWithoutFile: MatchResult["garmentsWithoutFile"] = [];

  for (const e of expected) {
    const key = normalizeFileName(e.file);
    const list = byName.get(key);
    if (list?.length === 1) {
      matched.push({ file: list[0], garmentId: e.garmentId, line: e.line });
      used.add(key);
    } else {
      garmentsWithoutFile.push({ line: e.line, garmentId: e.garmentId, expectedFile: e.file });
    }
  }

  const ambiguousKeys = new Set(ambiguous.map(normalizeFileName));
  const filesWithoutGarment = images.filter((f) => {
    const k = normalizeFileName(f.name);
    return !used.has(k) && !ambiguousKeys.has(k);
  });

  return { matched, filesWithoutGarment, garmentsWithoutFile, ambiguous, ignored: files.length - images.length };
}
