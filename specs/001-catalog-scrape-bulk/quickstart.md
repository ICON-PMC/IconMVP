# Quickstart: validar "Importar catálogo desde el panel"

Guía de validación de extremo a extremo. No contiene código de implementación (ver
[contracts/](./contracts/) y [data-model.md](./data-model.md)). Úsala con las tareas de `/speckit-tasks`.

## Prerrequisitos

- Docker + `supabase start` y `supabase db reset` (aplica la migración nueva `20261030000000_catalog_runs.sql`).
- `.env.local` con Supabase local, R2 (bucket de pruebas) y `CATALOG_BOT_CONTACT=equipo-prueba@icon.co`.
- `npm run dev` y sesión con `admin@icon.co` (contraseña `icon1234`). Para el escenario de rol: `maria@icon.co`.
- Una tienda Shopify **con consentimiento** (o una tienda propia de prueba) y un CSV de productos de esa
  misma tienda. Una marca de Icon con el mismo nombre (créala en `/admin`).
- `npm run lint` y `npm run build` limpios antes de empezar.

## Escenario 0 · Regresión del CLI (no se rompió el script)

1. Con el **código anterior** (rama `dev`): `npm run catalog:excel -- --marca "<Marca>" --csv <csv> --url <tienda> --contacto <correo> --consentimiento --sin-fotos --salida /tmp/antes`.
2. Con la rama de la feature, mismo comando con `--salida /tmp/despues`.
3. **Esperado**: las celdas de la hoja `Prendas` son idénticas. El CLI **no** genera la hoja `Origen`
   (esa hoja solo la agrega el panel). `origen.json` conserva los campos previos.

## Escenario 1 · Lectura en vivo y paquete (Historia 1 · FR-001 a FR-009, FR-017, FR-018)

1. `/admin/bulk` → "Leer catálogo de una tienda". Elige la marca, pega la URL, **no marques** consentimiento → Iniciar.
   **Esperado**: no inicia y explica por qué (Escenario 3 de la historia).
2. Marca el consentimiento, `max = 5`, deja las fotos → Iniciar.
   **Esperado**: progreso por fases (leyendo, fotos, armando); termina en < 1 min; botón "Descargar paquete".
3. Descarga el `.zip`. **Esperado**: `catalogo.xlsx`, `origen.json`, `LEEME.txt` y 5 fotos en `fotos/`; la columna
   `foto` coincide con los archivos; el aviso "sugerido automáticamente" en las columnas de etiquetas.
4. Verifica en la base (`docker exec -i supabase_db_Icon psql -U postgres -d postgres`):
   `select count(*) from garments;` **no cambió** (la lectura no crea prendas).
5. Repite con un CSV (campo `csv` + URL). **Esperado**: no hay peticiones a `/products.json` ni a `robots.txt`
   (aunque ese `robots.txt` bloquee la lectura en vivo); `url_producto` completa.
5b. Al terminar cualquier corrida, **Esperado**: un resumen en pantalla con el total de prendas, fotos obtenidas,
   prendas con avisos (sin categoría, sin talla, sin precio, sin foto, tallas desconocidas) y el motivo por fila.
6. Con una tienda cuyo `robots.txt` bloquee `/products.json` (o simulando): **Esperado**: no se crea corrida y se
   sugiere el CSV.
7. Como `maria@icon.co` (rol `user`): la sección no aparece y la ruta `/admin/bulk/catalog/<id>/paquete` redirige.

## Escenario 2 · Interrupción y reanudación (FR-009 · SC-006)

1. Inicia una corrida con fotos (≥ 20 prendas) y **cierra la pestaña** a mitad de las fotos.
2. Reabre `/admin/bulk`. **Esperado**: banner "Corrida sin terminar de <Marca>" con *Continuar* y *Empezar de nuevo*.
3. *Continuar*. **Esperado**: sigue en la foto siguiente; al final no hay fotos repetidas
   (`select jsonb_array_length(package_keys->'photos') from catalog_runs …` = cantidad esperada) ni errores.
4. Abre la misma corrida en dos pestañas y avanza ambas. **Esperado**: sin duplicados ni estado corrupto.

## Escenario 3 · Descarga en producción-like (riesgo del streaming)

1. En un **Preview de Vercel** (no solo local), genera una corrida de ≥ 60 prendas con fotos (paquete > 25 MB).
2. Descarga el paquete. **Esperado**: llega completo y abre sin errores. Si la descarga se corta o falla
   por tamaño, activar el Plan B de [research.md §3](./research.md).

## Escenario 4 · Subir Excel + carpeta de una sola vez (Historia 2 · FR-010 a FR-014, FR-019)

1. Edita el Excel: cambia una categoría, borra dos filas, reordena otras.
2. Descomprime el ZIP; en "Subir Excel y carpeta de fotos" elige el `.xlsx` y la carpeta `fotos/` → Importar.
3. **Esperado**: se crean solo las filas que quedaron; cada foto queda en **su** prenda (por la columna `foto`,
   no por el orden); las prendas con foto pasan a `published`; el resumen lista fotos sin prenda (las de las
   filas borradas) y prendas sin foto.
4. Vuelve a subir el **mismo** Excel. **Esperado**: 0 creadas, todas "ya existe"; filas sin URL se importan con aviso.
5. Cuota: en una marca de prueba con cerca de 300 MB usados (`brand_storage_bytes`), sube fotos que excedan.
   Luego intenta subir una de las rechazadas desde la tarjeta de "prendas sin foto" (cargador suelto):
   **Esperado**: también se rechaza por cuota.
   **Esperado**: las que caben se guardan, las demás se rechazan con el mensaje de cuota y se listan.
6. Sube una foto de > 10 MB y un `.txt` como foto. **Esperado**: se rechazan individualmente; el resto continúa.
7. Excel ajeno (sin hoja Origen, p. ej. la plantilla de `/admin/bulk/template`) + carpeta: funciona igual.
8. Con la hoja Origen intacta: `select imported_at, import_stats from catalog_runs where id = '<runId>';`
   **Esperado**: llena, con conteos que cuadran con lo mostrado.
8b. Si el Excel era de una corrida **completa** en vivo: `select last_seen_at from garments where id in (…)` de las
   recién creadas = fecha de esa corrida; con una corrida parcial (`max`) queda `null`.
9. La cuota no se consumió por el almacén temporal: `select public.brand_storage_bytes('<brand>')` solo
   crece por las fotos definitivas.

## Escenario 5 · Detectar descontinuadas (Historia 4 · FR-020 a FR-024)

1. Precondición: la marca ya tiene en Icon prendas importadas del catálogo de la tienda (Escenario 4).
   Para simular una descontinuada, edita el `product_url` de una prenda a `…/products/no-existe` o usa una
   prenda de otra tienda.
2. Corrida en vivo **completa** (sin `max`). **Esperado** al terminar: el panel muestra *siguen*, *nuevas*,
   *ya no aparecen* (la simulada) y *sin enlace*; `last_seen_at` quedó con fecha de hoy en las que siguen
   y `updated_at` de esas **no cambió**.
3. Selecciona la prenda y *Archivar*. **Esperado**: `status = archived`, `discontinued_at` con fecha, desaparece
   del feed; las no seleccionadas no cambian; queda en `catalog_runs.actions`.
4. Corrida con `max = 5` o con CSV. **Esperado**: **no** hay comparación ni cambia ningún `last_seen_at`.
5. Umbral: simula que > 30 % del catálogo falta (apunta varias URLs a handles inexistentes). **Esperado**:
   aviso de posible fallo de lectura y la confirmación pide un paso adicional.
6. Restaura la URL de la prenda archivada y corre otra lectura completa. **Esperado**: aparece en *reaparecen*;
   "Volver a publicar" la deja `published` (con foto) y `discontinued_at = null`.

## Escenario 6 · Retención y limpieza (supuesto de 7 días)

1. `update catalog_runs set expires_at = now() - interval '1 day' where id = '<runId>';`
2. Abre `/admin/bulk`. **Esperado**: la corrida desaparece de "retomables"; sus objetos `catalog-runs/<id>/…`
   ya no existen en R2; si tenía `imported_at` o `actions`, la fila queda como `discarded` en el historial.

## Criterios de salida (mapa a los criterios de éxito)

| Criterio | Cómo se comprueba |
|---|---|
| SC-001 / SC-003 | Cronometrar una marca real de ~100 prendas: de "Iniciar" a "revisión" < 15 min de trabajo humano. |
| SC-002 | Escenario 4: ≥ 95 % de las prendas con foto quedan con su foto correcta. |
| SC-004 | Escenarios 1 y 4: toda corrida tiene fila con responsable, fecha, marca, fuente, consentimiento. |
| SC-005 | Ninguna prenda en `published` sin `garment_images` tras la feature. |
| SC-006 | Escenarios 2 y 4.4. |
| SC-007 | Escenario 5.2 con 100 prendas: identificar las descontinuadas en < 5 min. |
| SC-008 | `select count(*) from garments where discontinued_at is not null` solo crece tras acciones explícitas. |
| Constitución VI y release | Revisar las pantallas nuevas a 375 px de ancho (sin scroll horizontal, objetivos táctiles ≥ 44 px) y correr el smoke test de release de la constitución (`/feed`, una ruta 404, login con contraseña incorrecta, una subida de imagen, clic saliente registrado). |

## Antes del merge a `main` (constitución IV y flujo de despliegue)

1. Aplicar `20261030000000_catalog_runs.sql` a la **nube** (SQL Editor o MCP) **antes** de mergear el código.
2. Agregar `CATALOG_BOT_CONTACT` en las variables de Vercel (Preview y Production) y redeploy.
3. Configurar la regla de ciclo de vida de R2 (7 días) sobre el prefijo `catalog-runs/`.
4. `npm run lint`, `npm run build`, smoke test del release (constitución) más los Escenarios 1, 4 y 5 en el Preview.

---

## Registro de validación (2026-10-30)

Entorno: Supabase local + **tienda Shopify falsa** y **R2 falso** (nada tocó el bucket real ni tiendas reales),
con la sesión del admin de prueba. Las server actions y el motor se ejecutaron de verdad (no simulados);
no hubo navegador, así que los clics de la UI **no** se probaron.

| Escenario | Estado | Cómo / qué falta |
|---|---|---|
| 0 · Regresión del CLI | ✅ | Excel idéntico (celdas, validaciones, hojas) con CSV y en vivo con fotos; `origen.json` y consola iguales. |
| 1 · Lectura en vivo y paquete | 🟡 | Verificado: consentimiento, robots, creación sin tocar `garments`, Excel/hoja Origen/avisos, ZIP (40 MB, streaming, md5 idéntico), SSR. **Falta**: clic en el formulario. |
| 2 · Interrupción y reanudación | 🟡 | Verificado: a medias (cursor 17), continuar sin repetir fotos, dos avances simultáneos. **Falta**: banner Continuar / Empezar de nuevo con clic. |
| 3 · ZIP en producción-like | 🟡 | `next start` local OK. **Falta**: Preview de Vercel (el límite de respuesta es de la plataforma). |
| 4 · Excel + carpeta | 🟡 | Verificado: duplicados, mapa, orden distinto, no-imágenes, ambiguos, publicación, cuota con/sin `strict_quota`, Excel ajeno, `import_stats`, almacén fuera de cuota. **Falta**: carpeta real en el navegador y foto > 10 MB. |
| 5 · Descontinuadas | 🟡 | Verificado: los 6 puntos del escenario (grupos, `updated_at` intacto, archivar, parcial/CSV, reaparecen, umbral 30 %). **Falta**: clic en el panel. |
| 6 · Retención y limpieza | ✅ | `purgeExpiredRuns`: borra objetos y fila; conserva `discarded` si hubo importación. |
| Seguridad (T047) | ✅ | Guarda SSRF (IPv4/IPv6/mapeadas, redirecciones, bucle, hosts de fotos, inerte en `production`). |

Hallazgos corregidos durante la validación: trigger de `updated_at` (columna generada `search_text`), `productKey`
con rutas sin dominio, reimportación sin filas nuevas que no anotaba "ya existían", corrida vencida que seguía
respondiendo "lista", y direcciones IPv4 incrustadas en IPv6 (`::ffff:7f00:1`) que la guarda no reconocía.
