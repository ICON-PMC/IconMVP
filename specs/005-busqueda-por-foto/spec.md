# Feature Specification: Búsqueda por foto

**Feature Branch**: `005-busqueda-por-foto`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "La persona toma una foto (o sube una imagen o captura de Instagram) de una prenda, por ejemplo un pantalón, y ve prendas visualmente similares del catálogo de marcas colombianas independientes. Desde el buscador de /feed (ícono de cámara); en móvil abre la cámara. Si la foto tiene varias prendas, elige o recorta cuál buscar. Los filtros existentes se aplican sobre los resultados. 'Más como esta' en /prenda/[id]. La foto de la persona no se guarda más allá de procesar la búsqueda ni se usa para entrenar."

**Pilares que refuerza** (Constitución, principio I): *Intención* (quien vio una prenda que le gustó, en la calle o en Instagram, puede buscar exactamente eso sin saber cómo describirlo en palabras) y *Local / independiente* (convierte la inspiración que viene de cualquier lado —incluidas grandes cadenas— en una alternativa de una marca colombiana independiente). Apoya el principio II: lleva de la necesidad concreta a la prenda y al clic hacia la tienda.

**Requiere enmienda de la constitución**: el principio VIII deja fuera de alcance la "búsqueda semántica (pgvector)" hasta nueva decisión explícita. La dueña del producto tomó esa decisión el 2026-11-13 para la búsqueda **por imagen**. Antes de mergear código de esta feature MUST aprobarse por PR una enmienda MINOR de la constitución que saque la búsqueda por similitud visual de la lista de exclusiones (la búsqueda semántica de **texto** entre idiomas puede seguir fuera o entrar en la misma enmienda; lo decide la dueña en ese PR).

**Relación con otras specs**: independiente de `004-etiquetado-abierto-ia` y de `003-recomendacion-feed`. La similitud visual que habilita esta feature podrá usarse luego en `003` como señal adicional, fuera del alcance de esta spec.

## Alcance

**Dentro**:
1. Buscar por foto desde el buscador de `/feed`: tomar foto con la cámara (móvil) o subir una imagen (móvil y escritorio, incluidas capturas de pantalla).
2. Elegir la prenda dentro de la foto cuando hay varias, o recortar a mano.
3. Resultados de prendas similares, con los filtros existentes de `/feed` aplicables.
4. "Más como esta" en la ficha de prenda (`/prenda/[id]`).
5. Preparar el catálogo publicado para que sea buscable por foto, y mantenerlo al día al publicar, editar o despublicar prendas.
6. Medición básica del uso (búsquedas por foto, búsquedas sin resultados útiles, clics salientes desde estos resultados).

**Fuera**: búsqueda semántica de texto o entre idiomas (salvo que la enmienda la incluya; aun así sería otra spec); buscar outfits completos o marcas por foto (solo prendas); combinar foto + texto en la misma consulta ("como esta pero en rojo"); guardar el historial de fotos de la persona; búsqueda por foto dentro del panel de marca o de admin; extensiones de navegador o "compartir a Icon" desde otras apps; reconocimiento de marcas, logos o personas en la foto; usar la similitud visual para ordenar el feed (spec 003).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tomar o subir una foto de una prenda y ver similares (Priority: P1)

Una persona vio en la calle un pantalón cargo beige que le encantó. Abre Icon en su celular, toca el ícono de cámara del buscador, toma la foto y en unos segundos ve pantalones cargo y de corte similar, en tonos parecidos, de marcas colombianas, ordenados del más parecido al menos parecido. Toca uno, ve la ficha y va a la tienda.

**Why this priority**: es la funcionalidad pedida; todo lo demás la complementa.

**Independent Test**: con el catálogo local, subir 10 fotos de referencia de prendas (algunas del propio catálogo fotografiadas de otra forma, otras de internet) y comprobar que en los primeros 6 resultados aparecen prendas de la misma categoría y de aspecto parecido.

**Acceptance Scenarios**:

1. **Given** el buscador de `/feed` en un celular, **When** la persona toca el ícono de cámara, **Then** puede elegir entre tomar una foto con la cámara o elegir una imagen de su galería.
2. **Given** el buscador de `/feed` en escritorio, **When** la persona toca el ícono de cámara, **Then** puede subir una imagen o arrastrarla.
3. **Given** una foto de una sola prenda, **When** se envía, **Then** la persona ve en menos de 5 segundos una cuadrícula de prendas similares, de la más parecida a la menos, con la miniatura de su foto arriba para saber qué buscó.
4. **Given** los resultados, **When** la persona toca una prenda, **Then** llega a su ficha y desde allí puede ir a la tienda como siempre (el clic saliente se registra como hoy).
5. **Given** una persona sin sesión, **When** busca por foto, **Then** funciona igual que con sesión.
6. **Given** que ninguna prenda es suficientemente parecida, **When** se muestran resultados, **Then** se muestra un mensaje honesto ("No encontramos algo muy parecido; esto es lo más cercano") en vez de presentar resultados malos como si fueran buenos.
7. **Given** una captura de pantalla de Instagram con textos e íconos alrededor de la foto, **When** se usa para buscar, **Then** los resultados se basan en la prenda, no en los elementos de la interfaz.

---

### User Story 2 - Elegir qué prenda buscar cuando la foto tiene varias (Priority: P1)

> **Alcance v1 (decisión 2026-11-14):** solo recorte manual (escenarios 3 y 4). Los escenarios 1 y 2 (detección automática con recuadros) quedan para una versión siguiente.

La persona sube una foto de cuerpo entero de una influencer con chaqueta, blusa, pantalón y botas. Icon detecta las prendas y le muestra recuadros sobre cada una; por defecto busca la más destacada. Toca el pantalón y los resultados cambian a pantalones. Si la detección no acierta, puede recortar a mano.

**Why this priority**: la mayoría de fotos de inspiración (Instagram, calle) son de outfits completos; sin esto los resultados mezclarían prendas.

**Independent Test**: subir 5 fotos de outfits completos y comprobar que se ofrecen al menos las prendas principales visibles, y que elegir cada una cambia los resultados a esa categoría.

**Acceptance Scenarios**:

1. **Given** una foto con varias prendas visibles, **When** se procesa, **Then** la persona ve la foto con un recuadro o marcador por cada prenda detectada y los resultados de la prenda más destacada ya cargados.
2. **Given** los marcadores, **When** la persona toca otra prenda, **Then** los resultados se actualizan a esa prenda sin volver a subir la foto.
3. **Given** que la prenda que quiere no fue detectada, **When** elige "Recortar", **Then** puede ajustar un recuadro a mano y buscar con ese recorte.
4. **Given** una foto sin prendas reconocibles (paisaje, comida), **When** se procesa, **Then** se le avisa que no encontramos ropa en la foto y se le invita a probar con otra o recortar.

---

### User Story 3 - Filtrar los resultados de la foto (Priority: P2)

Los resultados de la foto incluyen pantalones de varias ciudades y precios. La persona aplica "Medellín" y "menos de $200k" y la lista conserva el orden por parecido pero solo con lo que cumple.

**Why this priority**: une la búsqueda por foto con el pilar de intención (filtros); puede llegar después de la búsqueda básica.

**Independent Test**: tras una búsqueda por foto, aplicar ciudad y precio y comprobar que todos los resultados cumplen los filtros y siguen ordenados por parecido.

**Acceptance Scenarios**:

1. **Given** resultados de una búsqueda por foto, **When** la persona aplica filtros de `/feed` aplicables a prendas (ciudad, precio, categoría, estilo, ocasión y los que existan de talla, color o marca), **Then** solo ve prendas que los cumplen, en orden de parecido.
2. **Given** filtros aplicados, **When** la persona elige otra prenda dentro de su foto, **Then** los filtros se mantienen.
3. **Given** filtros que dejan cero resultados, **When** se muestra la pantalla, **Then** se ofrece "Quitar filtros".
4. **Given** una búsqueda por foto, **When** la persona recarga la página o vuelve atrás desde una ficha, **Then** vuelve a sus resultados sin tener que subir la foto otra vez, durante esa misma sesión de navegación.

---

### User Story 4 - "Más como esta" en la ficha de una prenda (Priority: P2)

En la ficha de una blusa que le gusta pero no está en su talla, la persona ve una sección "Más como esta" con prendas visualmente parecidas de otras marcas, y puede abrir la lista completa con filtros.

**Why this priority**: usa la misma capacidad sin que la persona tenga que subir nada, y retiene a quien llega a una prenda que no le sirve.

**Independent Test**: abrir la ficha de 5 prendas distintas y comprobar que "Más como esta" muestra prendas de la misma categoría y aspecto parecido, sin incluir la propia prenda.

**Acceptance Scenarios**:

1. **Given** la ficha de una prenda publicada, **When** carga, **Then** muestra hasta 8 prendas similares, sin incluir la misma prenda y con no más de 2 de la misma marca.
2. **Given** la sección, **When** la persona elige "Ver más", **Then** llega a una lista completa de similares, con los filtros de `/feed` disponibles.
3. **Given** una prenda sin ninguna similar suficientemente parecida, **When** carga la ficha, **Then** la sección no se muestra.

---

### User Story 5 - El catálogo se mantiene buscable por foto (Priority: P2)

Cuando una marca publica, edita la foto o despublica una prenda, la búsqueda por foto lo refleja sin intervención del equipo. El equipo puede ver cuántas prendas son buscables y relanzar la preparación de las que fallaron.

**Why this priority**: sin esto la búsqueda se desactualiza; es requisito operativo, no visible para quien busca.

**Independent Test**: publicar una prenda nueva y comprobar que aparece en búsquedas por foto en menos de 5 minutos; despublicarla y comprobar que deja de aparecer de inmediato.

**Acceptance Scenarios**:

1. **Given** una prenda recién publicada, **When** pasan como máximo 5 minutos, **Then** ya puede aparecer en resultados por foto y en "Más como esta".
2. **Given** una prenda despublicada o de una marca desactivada, **When** alguien busca por foto, **Then** nunca aparece.
3. **Given** que cambia la foto principal de una prenda, **When** pasan como máximo 5 minutos, **Then** la búsqueda usa la foto nueva.
4. **Given** el panel de admin, **When** el equipo revisa el estado, **Then** ve cuántas prendas publicadas son buscables por foto, cuáles fallaron y puede reintentarlas.

---

### Edge Cases

- **Foto muy oscura, borrosa o muy pequeña** → aviso para intentar con otra; si se puede procesar, se busca igual.
- **Archivo que no es imagen, imagen enorme o formato poco común (HEIC del iPhone)** → las fotos de cámara de iPhone y Android MUST funcionar; otros archivos se rechazan con mensaje claro; el tamaño máximo se informa.
- **Foto con personas** → solo se usa para buscar la prenda; no se guarda (FR-012).
- **Foto de una prenda que está en el catálogo de Icon** (por ejemplo, captura de la propia ficha) → esa prenda aparece primera.
- **Uso abusivo** (cientos de búsquedas por minuto desde un mismo origen) → límite de uso con mensaje amable; no afecta a los demás.
- **Servicio de análisis de imagen caído o sin cuota** → el ícono de cámara muestra un mensaje de "no disponible por ahora" y la búsqueda por texto sigue funcionando; "Más como esta" se oculta.
- **Catálogo pequeño** (hoy 237 prendas, 10 marcas, pocas categorías con muchas prendas) → es esperable que muchas búsquedas no tengan algo "muy parecido"; el umbral de FR-007 evita mostrar resultados forzados como buenos.
- **Contenido inapropiado** (desnudos, violencia) → no se procesa ni se guarda; se muestra un mensaje neutro.
- **Permisos de cámara denegados** → se ofrece elegir de la galería.

## Requirements *(mandatory)*

### Functional Requirements

**Entrada**

- **FR-001**: El buscador de `/feed` MUST tener un acceso de búsqueda por foto (ícono de cámara) visible en móvil y escritorio.
- **FR-002**: En móvil MUST permitir tomar una foto con la cámara o elegir una imagen de la galería; en escritorio, subir o arrastrar una imagen.
- **FR-003**: MUST aceptar las fotos de cámara de iPhone y Android y los formatos de imagen comunes, hasta un tamaño máximo que se informa en el mensaje de error.
- **FR-004**: Cuando la foto contiene varias prendas, la persona MUST poder recortar a mano la prenda que quiere buscar y volver a buscar sin subir la foto de nuevo; por defecto se busca con la foto completa. *Decisión de la dueña (2026-11-14): la detección automática de prendas con recuadros queda fuera de esta versión; ver research R3.*

**Resultados**

- **FR-005**: Los resultados MUST ser prendas publicadas de marcas activas, ordenadas por parecido visual (forma, tipo de prenda, color y textura), con la miniatura de la foto buscada visible.
- **FR-006**: Los resultados MUST priorizar prendas de la misma categoría que la prenda buscada.
- **FR-007**: Por debajo de un umbral de parecido, los resultados MUST presentarse como "lo más cercano" con un mensaje honesto, no como coincidencias.
- **FR-008**: Los filtros de `/feed` aplicables a prendas MUST poder aplicarse sobre los resultados sin perder el orden por parecido, y MUST mantenerse al cambiar de prenda dentro de la foto.
- **FR-009**: La persona MUST poder volver a sus resultados (desde una ficha o al recargar) sin subir la foto de nuevo durante la misma sesión de navegación.
- **FR-010**: Los resultados por foto MUST mostrarse con las mismas tarjetas de prenda del feed (guardar, like, ir a la ficha) y los clics salientes MUST registrarse como hoy, identificando que vienen de búsqueda por foto.

**Más como esta**

- **FR-011**: La ficha de prenda MUST mostrar hasta 8 prendas similares (sin la misma prenda, máximo 2 por marca), con acceso a la lista completa filtrable; la sección MUST ocultarse si no hay similares por encima del umbral.

**Privacidad y seguridad**

- **FR-012**: La foto de la persona MUST usarse solo para la búsqueda en curso y MUST NOT guardarse de forma permanente: se descarta como tarde al terminar la sesión de navegación o a las 24 horas, lo que ocurra antes. MUST NOT asociarse a la cuenta de la persona.
- **FR-013**: Si se usa un servicio externo para analizar imágenes, MUST ser uno que no use las fotos para entrenar sus modelos ni las conserve, y la política de privacidad visible MUST mencionarlo.
- **FR-014**: El sistema MUST limitar la cantidad de búsquedas por foto por persona u origen (por ejemplo, 30 por hora) y MUST tener un tope de gasto mensual configurable por el equipo; al alcanzarlo, la búsqueda por foto se desactiva con un mensaje y el resto de Icon sigue igual.
- **FR-015**: Las imágenes con contenido inapropiado MUST rechazarse sin procesarse ni guardarse.

**Catálogo buscable**

- **FR-016**: Toda prenda publicada MUST volverse buscable por foto en menos de 5 minutos tras publicarse o cambiar su foto principal, sin intervención del equipo.
- **FR-017**: Una prenda despublicada, archivada o de una marca desactivada MUST dejar de aparecer en resultados de inmediato.
- **FR-018**: El equipo MUST ver en `/admin` cuántas prendas publicadas son buscables por foto, cuáles fallaron, y MUST poder reintentarlas o preparar todo el catálogo de nuevo.

**Medición**

- **FR-019**: El sistema MUST registrar, sin la foto: que hubo una búsqueda por foto, la categoría detectada, el número de resultados, si estuvieron por debajo del umbral y los clics a ficha y salientes que generó.
- **FR-020**: El panel de admin MUST mostrar por semana: búsquedas por foto, porcentaje con resultados "muy parecidos", y clics salientes generados desde búsqueda por foto y desde "Más como esta".

### Key Entities

- **Huella visual de prenda**: representación de la apariencia de la foto principal de una prenda publicada que permite comparar parecido; una por prenda, se actualiza al cambiar la foto; estado (lista, pendiente, fallida).
- **Búsqueda por foto**: consulta efímera: prenda detectada o recorte elegido, filtros, resultados. Se registra solo su metadato (FR-019), nunca la imagen.
- **Prenda detectada**: región de la foto con una prenda y su categoría probable; existe solo durante la búsqueda.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En un conjunto de 30 fotos de referencia (10 de prendas del propio catálogo fotografiadas de nuevo, 20 de inspiración externa), la prenda buscada o una de la misma categoría y aspecto parecido aparece entre los primeros 6 resultados en al menos el 80 % de los casos; en las fotos de prendas del catálogo, la propia prenda aparece primera en al menos el 90 %.
- **SC-002**: El 90 % de las búsquedas por foto muestra resultados en menos de 5 segundos desde que se envía la foto, en una conexión móvil 4G.
- **SC-003**: En fotos de outfit completo, recortar la prenda deseada y obtener resultados de su categoría toma menos de 15 segundos. *(La meta de detección automática de 2 prendas en el 80 % de los casos aplica cuando se implemente la detección.)*
- **SC-004**: Una persona pasa de abrir Icon a ver prendas parecidas a la de su foto en menos de 20 segundos.
- **SC-005**: Ninguna foto de persona usuaria queda guardada después de 24 horas (verificable revisando el almacenamiento).
- **SC-006**: El costo de preparar el catálogo actual completo es menor a USD 5 y el costo mensual se mantiene por debajo del tope configurado.
- **SC-007**: A las 4 semanas del lanzamiento, al menos el 10 % de las sesiones que usan búsqueda por foto terminan en un clic saliente.

## Assumptions

- "Persona" se refiere a quien navega Icon, con o sin sesión (principio VII).
- El análisis de imagen se hace con un servicio o modelo de visión elegido en el plan; la constitución exige justificar la nueva dependencia por el pilar que refuerza (*Intención*) y la enmienda del principio VIII.
- La comparación se hace contra la foto principal de cada prenda publicada; las fotos secundarias pueden incorporarse en el plan si mejoran resultados sin cambiar esta spec.
- Con el catálogo actual (237 prendas) la calidad percibida dependerá más de la variedad del catálogo que del sistema; FR-007 cubre ese límite.
- La búsqueda por foto funciona sin sesión, como el resto de rutas públicas, con el límite de uso de FR-014.
- La foto subida no pasa por el pipeline de imágenes publicadas (principio V) porque no se publica ni se sirve; se trata como un dato efímero de la búsqueda.
- La rama de trabajo se crea a partir de `dev`, según el flujo de la constitución, y el PR de enmienda de la constitución se mergea antes que el código.
