# Contrato: formato del paquete y del Excel

## Estructura del `.zip`

```text
<slug-marca>/
├── catalogo.xlsx          # Excel con el formato de la carga masiva (ver abajo)
├── origen.json            # registro de procedencia y consentimiento
├── fotos/
│   ├── 001-vestido-lino.jpg
│   ├── 002-blusa-seda.png
│   └── …
└── LEEME.txt              # instrucciones de 5 líneas + fotos que no se pudieron incluir
```

- Los archivos de `fotos/` se guardan **sin recomprimir** (método *store*); mantienen la extensión original
  que sirve la CDN (`jpg`, `png`, `webp`, `gif`, `avif`).
- Nombre de foto: `NNN-<slug-del-título-50-caracteres>.<ext>`, con `NNN` = posición (1-based, 3 dígitos).
  Es el esquema que ya genera el CLI.

## `catalogo.xlsx`

Mismas columnas y orden que hoy (no cambian para `importGarments`):

`marca · titulo · descripcion · precio_cop · url_producto · color · tela · categoria · tallas · estilo ·
ocasion · clima · foto · revisar`

| Columna | Regla |
|---|---|
| `marca` | Nombre exacto de la marca en Icon (con desplegable). |
| `precio_cop` | Entero (el importador borra todo lo que no sea dígito). |
| `url_producto` | `<origin>/products/<handle>`; vacío si no hay `origin` (CSV sin URL de tienda). |
| `categoria`, `estilo`, `ocasion`, `clima` | **Sugerencias automáticas** (FR-018): salen de reglas sobre tipo/etiquetas/título de la tienda. El staff las corrige antes de importar. |
| `foto` | Nombre exacto del archivo en `fotos/`. **Es la llave de emparejamiento** (no el orden de filas). Vacía si no hay foto. |
| `revisar` | Notas por fila ("asignar categoría", "sin talla", "talla que no existe en Icon…"). El importador la ignora. |

Hojas:
1. `Prendas` — datos, validaciones de lista en `marca` y `categoria`, ayudas en estilo/ocasión/clima/tallas.
2. `Referencia (no editar)` — valores válidos leídos de la base en el momento de generar.
3. `Origen (no editar)` — **oculta** (`state: hidden`). Celdas: `A1="run_id"`, `B1=<uuid>`, `A2="marca_id"`,
   `B2=<uuid>`, `A3="generado"`, `B3=<ISO8601>`. Si falta o no coincide, el Excel se importa igual (FR-019).
4. Banner: en `Prendas`, nota en la celda de encabezado `categoria`/`estilo`/`ocasion`/`clima`:
   *"Sugerido automáticamente; revísalo antes de importar."*

## `origen.json`

```json
{
  "marca": "Under Gold",
  "marca_id": "uuid",
  "run_id": "uuid",
  "fuente": "https://tienda.com/products.json",
  "fecha": "2026-10-30T15:04:05.000Z",
  "consentimiento_confirmado_por_quien_ejecuto": true,
  "responsable": "uuid-del-usuario",
  "contacto": "equipo@icon.co",
  "moneda_reportada_por_la_tienda": "COP",
  "productos": 87,
  "fotos_descargadas": 85,
  "lectura_completa": true
}
```

Es un superconjunto del `origen.json` del CLI (añade `marca_id`, `run_id`, `responsable`,
`lectura_completa`); los campos existentes conservan nombre y significado.

## Emparejamiento en la subida conjunta

1. `importGarments` devuelve `fotos[]` = filas creadas con `foto` no vacía.
2. El cliente normaliza nombres (Unicode NFC, minúsculas, solo el nombre del archivo sin ruta).
3. Coincidencia exacta ⇒ se sube esa foto a esa prenda. Sin coincidencia ⇒ se lista en "fotos sin prenda" /
   "prendas sin foto". Dos archivos con el mismo nombre en subcarpetas distintas ⇒ "ambiguo", no se sube ninguno.
4. Un Excel ajeno (sin hoja Origen) usa la misma regla con su propia columna `foto`.
