# Feature Specification: Etiquetado abierto y asistido por IA

**Feature Branch**: `004-etiquetado-abierto-ia`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Vocabulario de estilos abierto (las marcas crean estilos de nicho como Alt, Chic pop, Underground, Kawaii, Old money, públicos al instante y buscables), límites más altos, filtro de estilo con populares + buscador, sugerencias de etiquetas con IA mirando la foto, color en paleta cerrada y filtrable, y mínimos de etiquetado para prendas nuevas. Va antes de 003-recomendacion-feed."

**Pilares que refuerza** (Constitución, principio I): *Intención* (más prendas con estilo, ocasión y color correctos = filtros y búsqueda que sí encuentran; los estilos de nicho permiten buscar exactamente la estética que se quiere) y *Local / independiente* (las marcas independientes se definen por estéticas específicas que un vocabulario cerrado no captura). Toca el pilar de *Curaduría*: el equipo sigue pudiendo renombrar, fusionar y ocultar etiquetas, y revisa las sugerencias de la IA antes de aplicarlas al catálogo existente.

**Relación con otras specs**: es requisito de `003-recomendacion-feed` (el perfil de gusto y los filtros nuevos dependen de prendas bien etiquetadas; resuelve su FR-024 sobre color). Independiente de `005` (búsqueda por foto).

**Cambia una decisión previa**: la spec `2026-10-06-etiquetas-ciudades-busqueda` fijó "vocabulario fijo, sin etiquetas libres", máximo 3 etiquetas por tipo por prenda y 5 estilos por marca. Esta spec abre el vocabulario de **estilos** y sube esos límites, por decisión de la dueña del producto (2026-11-13).

## Contexto (medido en producción, 2026-11-13)

| Campo | Prendas publicadas con dato (de 237) |
|---|---|
| Categoría | 231 (97 %) |
| Descripción | 195 (82 %) |
| Estilo | 114 (48 %) |
| Ocasión | 85 (36 %) |
| Tela | 52 (22 %) |
| Color | 8 (3 %), texto libre |

## Alcance

**Dentro**:
1. Estilos y colores abiertos: marcas y equipo crean estilos y colores nuevos, públicos de inmediato, con protección contra duplicados.
2. Herramientas del equipo para renombrar, fusionar y ocultar estilos.
3. Límites nuevos: hasta 6 estilos por prenda y 10 por marca.
4. Filtro de estilo en `/feed` con los más usados a la vista y buscador para el resto.
5. Color como vocabulario abierto: una paleta base con muestra visual, ampliable por marcas y equipo, asignable a prendas y filtrable.
6. Sugerencias de etiquetas (categoría, estilo, ocasión, color, tela) generadas por IA a partir de la foto, el título y la descripción.
7. Cola de revisión en `/admin` para aplicar sugerencias al catálogo existente, en lote.
8. Sugerencias al crear o editar prendas (panel de marca, formulario admin, carga masiva).
9. Mínimos de etiquetado para publicar prendas nuevas.

**Fuera**: búsqueda por foto y prendas similares (spec 005); personalización del feed (spec 003); etiquetas libres para **personas usuarias** (solo marcas y equipo crean estilos); abrir el vocabulario de categoría y clima (siguen cerrados); ocasiones creadas por marcas (las crea solo el equipo); traducción automática de etiquetas; etiquetado automático de outfits (cuando existan, heredan de sus prendas); reconocimiento de marca o logotipo en fotos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Una marca etiqueta su prenda con un estilo de nicho que no existía (Priority: P1)

Una marca de Medellín hace ropa "Old money". Al editar una camisa en su panel escribe "old mon…" en el campo de estilos. Como no existe, el campo le ofrece crear "Old money". Lo crea y queda en su camisa. Desde ese momento cualquier persona puede buscar "old money" en Icon y encontrar la camisa, y el estilo aparece en el filtro de estilos del feed (en el buscador del filtro, o como chip si llega a estar entre los más usados).

**Why this priority**: es el pedido explícito de la dueña ("filtros más abiertos") y el que más diferencia a Icon de un catálogo genérico.

**Independent Test**: con una cuenta de marca de prueba, crear el estilo "Kawaii" en una prenda; luego, sin sesión, buscar "kawaii" y filtrar por ese estilo en `/feed`: la prenda aparece en ambos casos.

**Acceptance Scenarios**:

1. **Given** una marca editando una prenda, **When** escribe un estilo que no existe, **Then** el campo le ofrece crearlo, y al confirmarlo el estilo queda asignado a la prenda.
2. **Given** que existe el estilo "Old money", **When** otra marca escribe "oldmoney", "Old Money" u "old-money", **Then** el campo le sugiere el estilo existente en vez de crear uno nuevo.
3. **Given** que existe "Y2K", **When** una marca escribe "y2 k" o "Y2k", **Then** se trata como el mismo estilo (misma forma normalizada).
4. **Given** que existe "Streetwear", **When** una marca escribe "street wear" o "streetware", **Then** el campo le muestra "¿Quisiste decir Streetwear?" antes de dejarla crear uno nuevo; puede crearlo igual si insiste.
5. **Given** un estilo recién creado por una marca, **When** cualquier persona busca su nombre en el buscador, **Then** aparecen las prendas que lo tienen.
6. **Given** un estilo recién creado, **When** se abre el filtro de estilos en `/feed`, **Then** se puede encontrar con el buscador del filtro.
7. **Given** una prenda con 6 estilos, **When** la marca intenta agregar un séptimo, **Then** ve un mensaje claro que le indica el máximo.
8. **Given** una marca que intenta crear un estilo con palabras ofensivas o que no son un estilo (por ejemplo, el nombre de la propia marca o un enlace), **When** confirma, **Then** el sistema lo rechaza con un mensaje claro.

---

### User Story 2 - El equipo completa el etiquetado del catálogo existente con ayuda de IA (Priority: P1)

Una persona de curaduría abre la cola "Etiquetado" en `/admin`. Ve las prendas publicadas a las que les falta estilo, ocasión o color, cada una con su foto y las etiquetas que la IA propone, marcadas como nuevas frente a las que ya tenía. Revisa una pantalla de 20 prendas, corrige dos y acepta el resto con un botón. En una tarde deja etiquetado todo el catálogo.

**Why this priority**: sin esto el catálogo seguiría con 52 % de prendas sin estilo y 97 % sin color, y la spec 003 no tendría con qué personalizar.

**Independent Test**: con el catálogo local, generar sugerencias para todas las prendas incompletas, aceptar una página en lote y comprobar que esas prendas quedan con estilo, ocasión y color, que las corregidas a mano guardan la corrección y que ninguna prenda perdió etiquetas que ya tenía.

**Acceptance Scenarios**:

1. **Given** prendas publicadas sin estilo, ocasión o color, **When** el equipo abre la cola de etiquetado, **Then** ve cada prenda con su foto principal, sus etiquetas actuales y las etiquetas sugeridas, distinguiendo visualmente las nuevas.
2. **Given** una página de sugerencias, **When** el equipo pulsa "Aceptar todas", **Then** las sugerencias se agregan a las prendas de esa página y salen de la cola.
3. **Given** una sugerencia equivocada, **When** el equipo la quita o la cambia antes de aceptar, **Then** se guarda la versión corregida.
4. **Given** una prenda que ya tenía etiquetas puestas por la marca, **When** se aceptan sugerencias, **Then** las etiquetas existentes se conservan; las sugerencias solo agregan (nunca quitan ni reemplazan sin acción explícita del equipo).
5. **Given** que la IA no puede analizar una prenda (foto ilegible, servicio no disponible), **When** se muestra la cola, **Then** la prenda aparece con aviso "sin sugerencia" y se puede etiquetar a mano.
6. **Given** la cola, **When** el equipo filtra por marca o por campo faltante (estilo / ocasión / color / tela), **Then** ve solo esas prendas.
7. **Given** una persona sin rol de equipo, **When** intenta abrir la cola, **Then** no puede acceder.

---

### User Story 3 - Personas filtran y buscan por color y por estilos de nicho (Priority: P1)

Quien busca un "vestido verde estilo cottagecore" abre el panel de filtros de `/feed`: ve los estilos más usados como chips, encuentra "Cottagecore" con el buscador del filtro, y elige el color verde de una paleta con muestras de color. También podría escribir "vestido verde cottagecore" en el buscador y obtener lo mismo.

**Why this priority**: es donde las personas perciben el beneficio de las Historias 1 y 2.

**Independent Test**: con el catálogo etiquetado, filtrar por color "verde" y un estilo poco usado, y buscar el mismo texto: ambos caminos devuelven las prendas esperadas.

**Acceptance Scenarios**:

1. **Given** el panel de filtros, **When** se abre el grupo Estilo, **Then** muestra como chips los 10 estilos con más prendas publicadas y un buscador para encontrar cualquier otro estilo con al menos una prenda publicada.
2. **Given** estilos sin prendas publicadas u ocultados por el equipo, **When** se abre el filtro, **Then** no aparecen.
3. **Given** el panel de filtros, **When** se abre el grupo Color, **Then** ve los colores con al menos una prenda publicada, con su nombre (y muestra visual cuando la tiene).
4. **Given** un filtro de color activo, **When** se ven los resultados, **Then** todas las prendas tienen ese color (entre sus colores).
5. **Given** una búsqueda de texto que contiene un color o un estilo ("vestido verde", "chaqueta old money"), **When** se muestran resultados, **Then** cuentan como coincidencia el color y los estilos asignados a la prenda, aunque no estén escritos en el título ni en la descripción.
6. **Given** filtros de estilo o color activos, **When** se comparte la URL, **Then** quien la abre ve los mismos filtros y resultados.

---

### User Story 4 - La marca recibe sugerencias al cargar una prenda nueva (Priority: P2)

Una marca sube la foto de un pantalón nuevo en su panel. Antes de guardar, el formulario le propone categoría "Pantalón", estilos "Urbano, Y2K", ocasión "Casual", color "Azul" y tela "Denim". Acepta, quita "Y2K" y publica. Lo mismo pasa en la carga masiva: el Excel generado y las prendas importadas llegan con las sugerencias ya rellenas para revisar.

**Why this priority**: evita que el catálogo vuelva a quedar incompleto con el tiempo; va después de completar lo existente.

**Independent Test**: con una cuenta de marca, crear una prenda subiendo solo foto y título, y comprobar que aparecen sugerencias editables y que la prenda no se puede publicar sin los mínimos.

**Acceptance Scenarios**:

1. **Given** una marca creando o editando una prenda, **When** sube o cambia la foto principal, **Then** en pocos segundos ve sugerencias de categoría, estilo, ocasión, color y tela, que puede aceptar, quitar o cambiar una por una.
2. **Given** que las sugerencias tardan o fallan, **When** la marca sigue llenando el formulario, **Then** puede etiquetar a mano y guardar sin esperar.
3. **Given** una prenda sin al menos 1 estilo, 1 ocasión y 1 color, **When** la marca intenta publicarla, **Then** el sistema se lo impide e indica qué falta; puede guardarla sin publicar.
4. **Given** la carga masiva de catálogo (Excel + fotos), **When** se importan prendas, **Then** las sugerencias se usan para completar los campos vacíos, quedan marcadas como sugeridas y el equipo las revisa en la cola antes de publicarlas.
5. **Given** una prenda ya publicada antes de esta feature que no cumple los mínimos, **When** su marca la edita, **Then** se le piden los mínimos para volver a guardarla publicada, con sugerencias para completarlos; no se despublica sola.

---

### User Story 5 - El equipo ordena el vocabulario (Priority: P2)

Con el tiempo aparecen "Dosmiles", "2000s" y "Y2K", todos con prendas. Desde la pestaña de etiquetas de `/admin`, una persona de curaduría fusiona los tres en "Y2K": las prendas y marcas quedan con "Y2K", buscar "dosmiles" sigue encontrándolas y los filtros solo muestran "Y2K". También renombra "chic pop" a "Chic pop" y oculta un estilo que no aporta.

**Why this priority**: es la contrapartida de abrir el vocabulario; sin esto el filtro de estilos se degrada. Puede ir después porque al principio habrá pocos estilos nuevos.

**Independent Test**: crear dos estilos duplicados con prendas, fusionarlos y comprobar que las prendas quedan con el estilo destino, que el nombre absorbido sigue funcionando en la búsqueda y que desaparece del filtro.

**Acceptance Scenarios**:

1. **Given** la pestaña de etiquetas, **When** el equipo ve los estilos, **Then** aparecen con su número de usos, quién los creó (equipo o qué marca) y su fecha, y puede ordenarlos por más recientes.
2. **Given** dos o más estilos, **When** el equipo los fusiona en uno, **Then** todas las prendas, marcas y preferencias de usuarios que tenían los absorbidos pasan a tener el destino (sin duplicar), y los nombres absorbidos quedan como sinónimos de búsqueda.
3. **Given** un estilo, **When** el equipo lo renombra, **Then** el cambio se ve en todo Icon y el nombre anterior sigue funcionando en la búsqueda.
4. **Given** un estilo, **When** el equipo lo oculta, **Then** deja de mostrarse en filtros, fichas y autocompletado, y las marcas no pueden volver a crearlo con el mismo nombre; las prendas que lo tenían conservan sus otras etiquetas.
5. **Given** un estilo nuevo creado por una marca, **When** el equipo abre la pestaña de etiquetas, **Then** ve un indicador de "nuevos desde tu última visita" para revisarlos.

---

### Edge Cases

- **Dos marcas crean el mismo estilo a la vez** con distinta escritura que normaliza igual → queda uno solo.
- **Estilo con nombre muy largo, emojis o solo símbolos** → se rechaza con mensaje claro (longitud máxima de 30 caracteres; letras, números, espacios y guiones).
- **La marca asigna un estilo y el equipo después lo oculta** → la prenda sigue publicada; si queda por debajo de los mínimos, se le pide completar en la siguiente edición (no se despublica sola).
- **Fusión que dejaría una prenda con más de 6 estilos** → la fusión se hace igual (no se pierde información) y el límite solo se aplica a nuevas asignaciones.
- **Marca con 10 estilos de marca** que quiere uno más → mensaje claro con el límite.
- **La IA sugiere un estilo que no existe** → se propone como uno de los estilos existentes más cercanos; la IA nunca crea estilos nuevos por sí sola.
- **La IA sugiere un color que no existe** → se ajusta al color existente más cercano; la IA no crea colores.
- **Prenda multicolor o estampada** → puede tener hasta 3 colores, o el color "Multicolor" / "Estampado" de la paleta.
- **Foto con varias prendas** (modelo con outfit completo) → la sugerencia se refiere a la prenda principal según el título; si hay ambigüedad, la sugerencia se marca con baja confianza.
- **Sugerencias con baja confianza** → se muestran destacadas para revisión y no entran en "Aceptar todas" sin confirmación.
- **Servicio de IA caído o sin cuota** → todo el flujo funciona sin sugerencias; la cola muestra el aviso; nada se bloquea.
- **Preferencias de onboarding** de usuarios que apuntaban a un estilo fusionado → pasan al estilo destino.

## Requirements *(mandatory)*

### Functional Requirements

**Vocabulario abierto de estilos**

- **FR-001**: Las cuentas de marca y del equipo MUST poder crear estilos nuevos desde cualquier campo donde se asignan estilos (prenda, marca, carga masiva). Las personas usuarias MUST NOT poder crearlos.
- **FR-002**: Un estilo nuevo MUST quedar disponible de inmediato para todo Icon: asignable por cualquier marca, buscable y visible en el filtro de estilos (si tiene al menos una prenda publicada).
- **FR-003**: Antes de crear un estilo, el sistema MUST comparar su forma normalizada (sin mayúsculas, acentos, espacios ni guiones) con los existentes y sus sinónimos; si coincide, MUST usar el existente en vez de crear otro.
- **FR-004**: Mientras se escribe, el campo MUST sugerir los estilos existentes más parecidos (incluida escritura cercana, por ejemplo "streetware" → "Streetwear") y MUST pedir confirmación explícita para crear uno nuevo cuando hay uno parecido.
- **FR-005**: Los nombres de estilo MUST tener entre 2 y 30 caracteres, solo letras, números, espacios y guiones, y MUST rechazarse si contienen palabras de una lista de bloqueo mantenida por el equipo, enlaces, o el nombre de una marca registrada en Icon.
- **FR-006**: Cada estilo MUST registrar quién lo creó (equipo o qué marca) y cuándo.
- **FR-007**: El vocabulario de **categoría** y **clima** MUST seguir cerrado; las **ocasiones** MUST poder crearlas solo el equipo.

**Límites**

- **FR-008**: Una prenda MUST poder tener hasta 6 estilos, 3 ocasiones, 3 colores y 1 categoría. Una marca MUST poder tener hasta 10 estilos de marca.
- **FR-009**: Al superar un límite, el sistema MUST mostrar un mensaje en español que indique el máximo.

**Gestión del vocabulario (equipo)**

- **FR-010**: El equipo MUST poder renombrar, fusionar y ocultar estilos desde `/admin`, y ver sus usos, creador y fecha.
- **FR-011**: Al fusionar, todas las asignaciones (prendas, outfits, marcas, preferencias de usuarios) MUST pasar al estilo destino sin duplicados, y los nombres absorbidos MUST seguir funcionando como sinónimos en la búsqueda.
- **FR-012**: Al renombrar, el nombre anterior MUST seguir funcionando como sinónimo en la búsqueda.
- **FR-013**: Un estilo oculto MUST dejar de aparecer en filtros, fichas públicas y autocompletado, y MUST NOT poder recrearse con el mismo nombre normalizado.
- **FR-014**: La pestaña de etiquetas MUST destacar los estilos creados desde la última visita de quien la abre.

**Color**

- **FR-015**: El color MUST elegirse de un vocabulario de colores con nombre en español: una paleta base de unos 24 colores con muestra visual (incluye "Morado" y "Lila" por separado, "Multicolor" y "Estampado") que marcas y equipo MUST poder ampliar con las mismas reglas de los estilos (FR-001 a FR-006: público de inmediato, normalización contra duplicados, sugerencia del parecido, lista de bloqueo, registro de quién lo creó). El equipo MUST poder renombrar, fusionar, ocultar y asignar muestra visual a los colores. *Cambio 2026-11-14, decisión de la dueña: el color pasa de paleta cerrada a vocabulario abierto.*
- **FR-016**: Los colores en texto libre que ya existen MUST migrarse a la paleta cuando haya una correspondencia clara; los que no, MUST enviarse a la cola de revisión.
- **FR-017**: El color MUST ser filtrable en `/feed` y en las pestañas de búsqueda de prendas y outfits, y buscable por texto.

**Filtro de estilo**

- **FR-018**: El grupo Estilo del panel de filtros MUST mostrar como chips los 10 estilos con más prendas publicadas y un buscador para el resto; MUST incluir solo estilos visibles con al menos una prenda publicada.
- **FR-019**: Todo estilo, ocasión, categoría y color asignado a una prenda MUST contar como coincidencia en la búsqueda de texto de prendas, outfits y marcas.

**Sugerencias con IA**

- **FR-020**: El sistema MUST generar sugerencias de categoría, estilos, ocasiones, colores y tela para una prenda a partir de su foto principal, título y descripción.
- **FR-021**: Las sugerencias MUST elegirse solo entre el vocabulario existente (estilos visibles, ocasiones, categorías, paleta de colores); la IA MUST NOT crear estilos nuevos.
- **FR-022**: Cada sugerencia MUST llevar un nivel de confianza; las de baja confianza MUST mostrarse destacadas y MUST NOT incluirse en la aceptación en lote sin confirmación.
- **FR-023**: Las sugerencias MUST ser solo propuestas: nunca se aplican a una prenda sin la aceptación de una persona (marca o equipo), y aceptarlas MUST solo agregar etiquetas, nunca quitar las existentes.
- **FR-024**: Las sugerencias MUST aparecer al crear o editar una prenda (panel de marca y formulario de admin) poco después de subir la foto, sin bloquear el formulario.
- **FR-025**: En la carga masiva, las sugerencias MUST completar solo los campos vacíos y quedar marcadas como sugeridas para la revisión del equipo.
- **FR-026**: Si el servicio de sugerencias falla o no está disponible, todos los flujos MUST seguir funcionando sin sugerencias y con un aviso discreto.
- **FR-027**: El sistema MUST registrar para cada sugerencia si fue aceptada, corregida o descartada, para medir su precisión.
- **FR-028**: Las fotos MUST enviarse al servicio de sugerencias solo para generar las etiquetas, MUST NOT enviarse fotos de personas usuarias, y el servicio elegido MUST NOT usar las fotos para entrenar sus modelos.
- **FR-029**: El gasto en sugerencias MUST tener un tope mensual configurable por el equipo; al alcanzarlo, el sistema deja de generar sugerencias hasta el siguiente mes y lo avisa en `/admin`.

**Cola de revisión**

- **FR-030**: `/admin` MUST tener una cola de etiquetado con las prendas incompletas (sin estilo, ocasión o color) o con sugerencias pendientes, filtrable por marca y por campo faltante, de 20 en 20.
- **FR-031**: El equipo MUST poder aceptar todas las sugerencias de una página, aceptar o corregir prenda por prenda, y lanzar la generación de sugerencias para todo el catálogo incompleto o para una marca.
- **FR-032**: Solo los roles curator y admin MUST poder ver y usar la cola.

**Mínimos**

- **FR-033**: Para publicar una prenda nueva o volver a guardar como publicada una existente, MUST tener al menos 1 categoría, 1 estilo, 1 ocasión y 1 color. Sin ellos se puede guardar sin publicar.
- **FR-034**: Las prendas ya publicadas que no cumplen los mínimos MUST NOT despublicarse automáticamente.

### Key Entities

- **Estilo** (etiqueta de tipo estilo): nombre visible, forma normalizada única, estado (visible / oculto), creador (equipo o marca), fecha de creación, sinónimos (nombres anteriores y estilos absorbidos).
- **Color**: elemento del vocabulario de colores con nombre, forma normalizada única, muestra visual (opcional en los creados por marcas), orden, estado y creador. Una prenda tiene de 0 a 3.
- **Sugerencia de etiquetado**: prenda, campo (categoría, estilo, ocasión, color, tela), valor propuesto, confianza, estado (pendiente, aceptada, corregida, descartada), quién la resolvió y cuándo.
- **Lista de bloqueo**: palabras que no pueden formar parte de un nombre de estilo; la mantiene el equipo.
- **Prenda, marca, ocasión, categoría, tela** (existentes): reciben más etiquetas y los nuevos límites.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una semana después del lanzamiento, al menos el 95 % de las prendas publicadas tiene categoría, estilo, ocasión y color (hoy: 97 % / 48 % / 36 % / 3 %).
- **SC-002**: Al menos el 80 % de las sugerencias de la IA se aceptan sin corrección (medido con FR-027 sobre las primeras 200 prendas revisadas).
- **SC-003**: Una persona del equipo revisa y aplica el etiquetado de 100 prendas en menos de 30 minutos usando la cola.
- **SC-004**: Una marca crea y asigna un estilo nuevo en menos de 15 segundos, y aparece en la búsqueda de inmediato.
- **SC-005**: En los primeros 3 meses, menos del 10 % de los estilos creados por marcas terminan fusionados como duplicados.
- **SC-006**: El 100 % de las prendas nuevas publicadas después del lanzamiento cumple los mínimos de etiquetado.
- **SC-007**: Las sugerencias aparecen en el formulario de prenda en menos de 10 segundos tras subir la foto en el 90 % de los casos.
- **SC-008**: El gasto en sugerencias para etiquetar el catálogo actual completo es menor a USD 10, y el gasto mensual recurrente se mantiene por debajo del tope configurado.

## Assumptions

- "Persona usuaria", "quien busca" y "persona" se refieren a cuentas con rol `user`; "equipo" a curator y admin (principio VII).
- La IA de sugerencias es un servicio externo de visión con costo por uso; elegirlo y justificar la nueva dependencia corresponde al plan (la constitución pide justificar complejidad añadida por el pilar que refuerza: aquí, *Intención*).
- Las sugerencias se generan con la foto ya procesada que se publica (la que pasa por el pipeline de imágenes), no con originales.
- Las marcas pueden crear estilos sin aprobación previa (decisión de la dueña); el control de calidad es posterior (fusionar / renombrar / ocultar) más la prevención automática de duplicados y la lista de bloqueo.
- La tela sigue siendo texto libre; la IA solo la sugiere y se guarda como hoy.
- La paleta base de colores se definió en el piloto con Haiku (2026-11-14) y se amplió con "Morado".
- Los colores se guardan aparte de las etiquetas (no como un tipo más de etiqueta) para no romper el código desplegado mientras se migra; es una decisión de implementación registrada en el plan.
- La sección de etiquetas de `/admin` existente se amplía; no se crea una herramienta aparte.
- La rama de trabajo se crea a partir de `dev`, según el flujo de la constitución.
