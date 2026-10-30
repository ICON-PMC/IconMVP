# Feature Specification: Importar catálogo de una marca desde el panel de carga masiva

**Feature Branch**: `001-catalog-scrape-bulk`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Carga masiva con scraping de catálogo desde el panel admin: que el staff pueda correr desde `/admin/bulk` lo que hoy hace el script `catalog:excel` (leer el catálogo Shopify de una marca por URL o por CSV y generar el Excel más las fotos), y subir el Excel y la carpeta de fotos de una sola vez, de modo que al staff solo le quede revisar."

**Pilares que refuerza** (Constitución, principio I): *Curaduría / estética* (más catálogo real de marcas independientes, revisado por una persona antes de publicarse) y *Local / independiente* (acelera el alta de marcas colombianas con consentimiento).

## Clarifications

### Session 2026-10-30

- Q: ¿Cómo decide Icon que una prenda ya existe al reimportar el catálogo de una marca? → A: misma
  marca + mismo enlace de compra; la fila se omite y se informa como "ya existe".
- Q: Si la lectura del catálogo se interrumpe, ¿qué pasa al volver a entrar? → A: la corrida queda
  guardada y se ofrece continuar desde la última prenda leída o empezar de nuevo.
- Q: ¿Publicar automáticamente al subir la foto es la revisión final? → A: sí. La revisión humana de los
  datos ocurre sobre el Excel, antes de importar; al subir la foto la prenda se publica sola. Después el
  staff puede seguir corrigiendo, archivando o eliminando con las herramientas existentes.
- Q: (Solicitud adicional) Al leer la tienda en vivo, ¿qué pasa con las prendas de Icon que ya no
  aparecen en ella? → A: se muestran en una comparación y el staff elige cuáles archivar; nada se
  archiva automáticamente.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Preparar el catálogo de una marca sin usar la terminal (Priority: P1)

Una persona del staff (curator o admin) abre la carga masiva, elige una marca que ya existe en Icon,
indica de dónde sale el catálogo (la dirección de la tienda, o el archivo CSV que la marca exportó de
su tienda) y confirma que la marca dio su consentimiento. Icon lee el catálogo con pausas entre
peticiones, muestra el avance y, al terminar, ofrece descargar un paquete con el Excel en el formato de
la carga masiva y las fotos principales de cada prenda. Nada se crea en Icon en este paso.

**Why this priority**: es el paso que hoy exige terminal, instalar dependencias y conocer los flags;
sin él, el resto del flujo sigue dependiendo de una persona técnica.

**Independent Test**: con una marca de prueba que ya autorizó su catálogo, una persona del staff sin
acceso a la terminal obtiene el Excel y las fotos completos a partir de la dirección de la tienda.

**Acceptance Scenarios**:

1. **Given** una marca existente y una tienda accesible, **When** el staff indica la dirección de la
   tienda y marca la confirmación de consentimiento, **Then** ve el avance (prendas leídas, fotos
   obtenidas) y al terminar puede descargar el paquete con el Excel y las fotos, sin que se haya
   creado ninguna prenda en Icon.
2. **Given** un CSV exportado por la marca, **When** el staff lo sube junto con la dirección de la
   tienda, **Then** el Excel se arma desde el CSV sin consultar el catálogo en vivo y la columna del
   enlace de compra de cada prenda queda completa.
3. **Given** que el staff no marcó la confirmación de consentimiento, **When** intenta iniciar,
   **Then** el sistema no inicia y explica por qué.
4. **Given** una persona con rol `user` o `brand`, **When** intenta acceder a esta función,
   **Then** no tiene acceso.
5. **Given** que la tienda no permite la lectura automática de su catálogo, **When** el staff inicia
   la lectura en vivo, **Then** el sistema se detiene sin leerla y sugiere usar el CSV de la marca.

---

### User Story 2 - Subir el Excel y las fotos de una sola vez (Priority: P1)

Tras revisar y corregir el Excel descargado (las etiquetas automáticas no siempre son acertadas), el
staff sube el Excel y la carpeta completa de fotos en una sola acción. Icon crea las prendas en
estado `pending` y asocia cada foto a su prenda por el nombre del archivo; las prendas que quedan con
foto pasan a `published`. Todo lo que no se pudo emparejar queda señalado, sin que el staff tenga que
subir foto por foto.

**Why this priority**: es la otra mitad de "solo revisar"; hoy la foto se sube prenda por prenda.

**Independent Test**: subir un Excel de 20 prendas y su carpeta de 20 fotos en una sola acción y
verificar que las 20 prendas quedan con su foto correcta, sin acciones adicionales.

**Acceptance Scenarios**:

1. **Given** un Excel y una carpeta cuyas fotos corresponden a sus prendas, **When** el staff los
   sube juntos, **Then** cada prenda queda asociada a su foto y se reporta cuántas se importaron.
2. **Given** fotos sin prenda correspondiente o prendas sin foto, **When** termina la subida,
   **Then** se listan por separado y las prendas sin foto quedan en `pending` para completarlas.
3. **Given** que la marca alcanzaría su cuota de almacenamiento (300 MB), **When** se suben las
   fotos, **Then** las que caben se guardan, las demás se rechazan con un mensaje claro y se indica
   cuáles faltaron.
4. **Given** una foto que supera el tamaño permitido o que no es una imagen, **When** se procesa,
   **Then** se rechaza esa foto sin cancelar el resto.

---

### User Story 3 - Registro de procedencia y revisión posterior (Priority: P2)

Cada importación deja constancia de quién la hizo, cuándo, para qué marca, de qué fuente (tienda o
CSV) y que se confirmó el consentimiento. La revisión humana de los datos ocurre sobre el Excel
antes de importar; al subir la foto, la prenda se publica automáticamente y nada se publica sin foto.
Después, el staff puede corregir, archivar o eliminar prendas desde las herramientas existentes.

**Why this priority**: protege a Icon y a las marcas (las fotos y precios son ajenos) y mantiene la
curaduría humana; no bloquea el flujo principal.

**Independent Test**: tras una importación, consultar el registro y ver los datos de procedencia y
consentimiento de esa corrida.

**Acceptance Scenarios**:

1. **Given** una importación terminada, **When** el staff consulta el historial, **Then** ve marca,
   fuente, fecha, responsable, cantidad de prendas y fotos, y la confirmación de consentimiento.
2. **Given** prendas importadas, **When** el staff entra a la lista de pendientes, **Then** puede
   revisarlas, ajustarlas o eliminarlas como cualquier prenda cargada en bloque.

---

### User Story 4 - Detectar prendas que la marca ya no vende (Priority: P2)

Al terminar una lectura en vivo de la tienda, Icon compara lo que la tienda ofrece hoy con las
prendas que esa marca tiene en Icon y muestra tres grupos: las que **siguen**, las **nuevas** (están en
la tienda y no en Icon) y las que **ya no aparecen**. El staff revisa el grupo "ya no aparecen" y
elige cuáles archivar; las archivadas salen del feed pero se pueden recuperar. Cada prenda guarda la
fecha en que se la vio por última vez en la tienda.

**Why this priority**: evita mostrar prendas agotadas o descontinuadas, que rompen la confianza del
usuario y generan clics salientes inútiles (la métrica del piloto); no bloquea la importación.

**Independent Test**: con una marca que tiene en Icon una prenda que ya no está en su tienda, hacer una
lectura en vivo completa y verificar que esa prenda aparece en "ya no aparecen" y que, al confirmarlo,
deja de verse en el feed.

**Acceptance Scenarios**:

1. **Given** una lectura en vivo completa, **When** termina, **Then** el staff ve los grupos "siguen",
   "nuevas" y "ya no aparecen", con la cantidad de cada uno, y la fecha de última vez vista de las que
   siguen queda actualizada.
2. **Given** el grupo "ya no aparecen", **When** el staff selecciona prendas y confirma, **Then** solo
   esas prendas se archivan; las no seleccionadas no cambian.
3. **Given** una lectura que se hizo con límite de N prendas, que no terminó, o a partir de un CSV o
   Excel subido, **When** termina, **Then** no se muestra la comparación ni se actualiza ninguna fecha.
4. **Given** que "ya no aparecen" supera el 30 % de las prendas comparables de la marca, **When** se
   muestra la comparación, **Then** aparece un aviso de que podría ser un fallo de lectura y la
   confirmación pide un paso adicional.
5. **Given** una prenda archivada por esta vía que vuelve a aparecer en una lectura posterior,
   **When** se muestra la comparación, **Then** aparece en un grupo "reaparecen" para que el staff
   decida si la vuelve a publicar.

---

### Edge Cases

- **Catálogos grandes o lentos**: la lectura respetuosa (con pausa entre peticiones) puede tardar más
  de lo que una sola petición del servidor tolera; el proceso avanza por tandas, muestra avance y
  conserva lo obtenido para poder continuar (FR-009).
- Una corrida interrumpida que nadie retoma: se descarta tras un plazo razonable (ver Supuestos).
- Prendas de la marca sin enlace de compra: no se pueden comparar; se listan aparte y no se
  consideran "ya no aparecen".
- Prendas de la marca en `pending` que no están en la tienda: aparecen en la comparación
  igual que las publicadas.
- La tienda cambió el enlace de una prenda (mismo producto, otra URL): aparecerá como "ya no aparece"
  y como "nueva"; el staff lo resuelve en la revisión.
- La marca elegida no existe en Icon, o hay dos marcas con nombre parecido.
- La tienda no es Shopify, está caída, bloquea el acceso o responde con errores parciales.
- El staff corrige el Excel (cambia categorías, colores u otras etiquetas, borra filas) antes de
  subirlo: la importación MUST respetar lo que dice el Excel, no lo que se generó originalmente.
- Un producto sin foto, sin precio o con tallas/categorías que Icon no reconoce: se reporta por fila
  sin frenar el resto.
- Productos ya importados antes (reimportación de la misma marca): se omiten por coincidir marca y
  enlace de compra (FR-014); no se actualizan los datos de la prenda existente.
- Nombres de archivo de foto repetidos, con acentos, mayúsculas distintas o sin extensión.
- Dos personas del staff importan para la misma marca al mismo tiempo: la comprobación de duplicados
  se repite justo antes de insertar, pero es posible un duplicado residual (riesgo aceptado, ver Supuestos).
- Fotos muy pesadas o de baja calidad: se aplica el mismo tratamiento de imagen que en el resto de
  Icon antes de guardarlas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Solo `curator` y `admin` MUST poder usar esta función; cualquier otro rol MUST ser
  rechazado en el servidor.
- **FR-002**: El staff MUST poder elegir una marca ya existente en Icon como destino; la función MUST
  NOT crear marcas.
- **FR-003**: El staff MUST poder indicar la fuente del catálogo como la dirección de la tienda, un
  CSV exportado por la marca, o ambos (el CSV aporta los datos y la dirección completa los enlaces de
  compra).
- **FR-004**: El sistema MUST exigir una confirmación explícita de que la marca autorizó el uso de su
  catálogo **y de sus fotos** antes de iniciar, y MUST NOT iniciar sin ella.
- **FR-005**: Para la lectura en vivo, el sistema MUST respetar las reglas de acceso automático de la
  tienda, MUST espaciar las peticiones y MUST identificarse con un contacto del equipo.
- **FR-006**: El sistema MUST generar un Excel con las mismas columnas y nombres válidos (categorías,
  tallas, estilos, ocasiones, climas) que ya acepta la carga masiva, y una foto principal por prenda.
- **FR-007**: El staff MUST poder limitar la corrida a las primeras N prendas y omitir las fotos
  (equivalentes a los flags `--max` y `--sin-fotos` del script actual).
- **FR-008**: El sistema MUST mostrar el avance de la corrida y, al terminar la generación, un resumen
  en pantalla con lo importado y lo omitido, con el motivo por fila.
- **FR-009**: Una corrida larga MUST poder completarse sin que un límite de tiempo de una sola
  petición la descarte. Si se interrumpe (pestaña cerrada, falla de conexión o de tiempo), la corrida
  MUST quedar guardada con lo ya obtenido, y al volver el staff MUST poder **continuar** desde la última
  prenda leída o **empezar de nuevo**. Continuar MUST NOT repetir prendas ni fotos ya obtenidas.
- **FR-010**: El staff MUST poder subir el Excel y la carpeta de fotos en una sola acción, y el
  sistema MUST asociar cada foto a su prenda por el nombre del archivo.
- **FR-011**: Las prendas importadas MUST crearse en `pending` y pasar a `published` **automáticamente** solo
  cuando tienen foto; subir la foto es el último paso (no hay una aprobación posterior). El sistema
  MUST NOT publicar nada sin esa condición.
- **FR-012**: Toda foto MUST pasar por el tratamiento de imagen estándar de Icon y respetar la cuota
  de almacenamiento de la marca (300 MB), rechazando con mensaje claro lo que no quepa.
- **FR-013**: El sistema MUST reportar por separado las fotos sin prenda y las prendas sin foto.
- **FR-014**: El sistema MUST evitar duplicar prendas al reimportar: una fila cuya marca y enlace de
  compra coinciden con una prenda existente MUST omitirse y reportarse como "ya existe". Las filas
  sin enlace de compra no se pueden comparar y MUST importarse, señaladas para revisión.
- **FR-015**: Cada corrida MUST dejar un registro consultable por el staff con responsable, fecha,
  marca, fuente, consentimiento confirmado y conteos.
- **FR-016**: Todos los textos de la función MUST estar en español con lenguaje inclusivo.
- **FR-017**: Al terminar la generación, el resultado MUST entregarse como un paquete descargable (el
  Excel más la carpeta de fotos). El sistema MUST NOT crear prendas en Icon como parte de la
  generación: la importación ocurre solo cuando el staff sube el Excel (ya revisado) y las fotos.
- **FR-018**: Las etiquetas inferidas al generar el Excel (categoría, color, estilo, ocasión, clima,
  tela) MUST poder revisarse y corregirse en el Excel antes de importar; el sistema MUST dejar claro
  en la interfaz que son sugerencias automáticas y no datos confirmados.
- **FR-019**: La subida conjunta (FR-010) MUST aceptar cualquier Excel y carpeta de fotos con el
  formato de la carga masiva, vengan o no de esta función.
- **FR-020**: El sistema MUST guardar para cada prenda la fecha en que se la vio por última vez en la
  tienda de su marca. Esta fecha MUST ser independiente de la fecha de última edición, que cambia con
  cualquier corrección del staff. Las prendas nunca verificadas MUST mostrarse como "sin verificar" en la pantalla de comparación y en el
  historial de la corrida. Las prendas creadas al importar el paquete de una lectura en vivo completa
  MUST quedar con la fecha de esa lectura.
- **FR-021**: Al terminar una lectura en vivo **completa**, el sistema MUST comparar el catálogo de la
  tienda con las prendas de esa marca (misma regla de coincidencia que FR-014) y presentar los grupos
  "siguen", "nuevas", "ya no aparecen" y "reaparecen", actualizando la fecha de última vez vista de las
  que siguen.
- **FR-022**: La comparación MUST NOT ejecutarse con lecturas parciales (límite de N prendas,
  interrumpidas sin completar) ni con Excel o CSV subidos.
- **FR-023**: Las prendas del grupo "ya no aparecen" MUST archivarse solo por decisión explícita del
  staff; el sistema MUST NOT archivar nada automáticamente. Si ese grupo supera el 30 % de las prendas
  comparables de la marca, el sistema MUST advertir de un posible fallo de lectura y pedir una
  confirmación adicional.
- **FR-024**: Archivar y volver a publicar prendas desde la comparación MUST quedar en el registro de
  la corrida (FR-015), con responsable y fecha.

### Key Entities

- **Corrida de importación**: una ejecución sobre una marca. Atributos: responsable, fecha, marca,
  fuente (tienda o CSV), consentimiento confirmado, estado (en curso, completada, interrumpida),
  conteos de prendas y fotos, y motivos de omisión por fila.
- **Última vez vista**: fecha, por prenda, de la última lectura completa de la tienda en que apareció.
  Distinta de la fecha de última edición.
- **Comparación de catálogo**: resultado de una lectura en vivo completa: prendas que siguen, nuevas, que
  ya no aparecen y que reaparecen, para una marca.
- **Prenda importada**: prenda en `pending` ligada a una marca y a su corrida de origen, con datos
  comerciales y, si ya la tiene, su foto principal.
- **Paquete de catálogo**: el Excel con formato de carga masiva más la carpeta de fotos principales,
  nombradas de forma que se puedan emparejar con sus prendas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona del staff sin conocimientos técnicos prepara y carga el catálogo de una marca
  de hasta 100 prendas sin usar la terminal, con la intervención humana limitada a elegir la marca,
  indicar la fuente, confirmar el consentimiento y revisar.
- **SC-002**: Al menos el 95 % de las prendas con foto disponible en la tienda quedan asociadas a su
  foto correcta tras la subida conjunta, sin emparejarlas a mano.
- **SC-003**: El tiempo de trabajo manual del staff por marca de 100 prendas baja de la preparación
  actual (terminal más fotos una por una) a menos de 15 minutos, revisión incluida.
- **SC-004**: El 100 % de las corridas deja registro de responsable, fecha, marca, fuente y
  consentimiento.
- **SC-005**: Ninguna prenda importada se hace visible al público sin tener foto, y los datos de cada
  prenda pasaron por la revisión del staff en el Excel antes de crearse.
- **SC-006**: Ante una interrupción a mitad de una corrida, no se pierde lo ya obtenido y no se
  generan prendas duplicadas al reintentar.

- **SC-007**: Tras una lectura en vivo completa, el staff identifica en menos de 5 minutos, para un
  catálogo de 100 prendas, cuáles prendas de la marca ya no se venden.
- **SC-008**: Ninguna prenda se archiva sin una confirmación explícita del staff.

## Assumptions

- Solo se soportan tiendas Shopify y CSV de Shopify, igual que el script actual; otras plataformas
  quedan fuera.
- La marca ya existe en Icon (creada por el staff o por su registro) y ya dio su consentimiento por
  fuera de la plataforma; Icon registra la confirmación del staff, no la valida.
- El tamaño típico de un catálogo es de hasta ~150 prendas; catálogos mayores se procesan por tandas.
- Las etiquetas inferidas automáticamente (categoría, color, estilo, ocasión, clima) no son
  confiables; por eso el flujo conserva una revisión humana del Excel **antes** de crear prendas, en
  lugar de importar directo y corregir después (decisión de producto, 2026-10-30).
- El Excel conserva el formato vigente de la carga masiva (incluidos estilo, ocasión y clima y tallas
  numéricas) y su validación por fila no cambia.
- El emparejamiento foto–prenda usa la columna `foto` del Excel (nombre exacto del archivo, como la
  genera hoy el script), no el orden de las filas; así sigue valiendo si el staff reordena o borra filas.
- El script de terminal `catalog:excel` se mantiene disponible; esta función no lo reemplaza ni lo
  elimina.
- Las corridas interrumpidas se conservan 7 días; pasado ese plazo se descartan junto con sus
  archivos temporales. El paquete terminado se conserva el mismo plazo para poder descargarlo de nuevo.
- La coincidencia para la comparación usa marca + enlace de compra (igual que FR-014); detectar
  cambios de precio o de stock de variantes queda fuera de esta versión.
- El umbral de aviso (30 %) es un valor inicial ajustable. Se calcula como prendas que "ya no aparecen"
  entre las prendas *comparables* de la marca: las que están en `pending` o `published` y tienen enlace
  de compra.
- La cuota se verifica foto por foto; con varias subidas simultáneas puede excederse por unas pocas fotos
  (se considera aceptable).
- Dos importaciones simultáneas de la misma marca son poco probables (equipo pequeño); no se garantiza
  a nivel de base de datos que no se dupliquen. Si ocurre, se limpia con las herramientas existentes.
- Fuera de alcance: importar directamente sin pasar por el Excel, crear marcas, scrapear plataformas distintas de Shopify, importar varias fotos por
  prenda, y que las propias marcas usen esta función (eso pertenece a la fase de perfiles de marca).
