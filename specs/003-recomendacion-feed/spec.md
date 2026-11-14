# Feature Specification: Recomendación v1 — feed personalizado, señales y filtros nuevos

**Feature Branch**: `003-recomendacion-feed`

**Created**: 2026-11-13

**Status**: Draft — en pausa hasta completar `004-etiquetado-abierto-ia`

**Input**: User description: "Sistema de recomendación v1 para Icon + mejores filtros de búsqueda: registrar señales (impresiones, vistas de detalle, búsquedas, clics con sesión), perfil de gusto por usuario con decaimiento temporal, orden 'Relevante' del feed personalizado de forma invisible, búsqueda que use la afinidad, y filtros nuevos (talla, color, marca, precio libre) con contadores. Fuera: embeddings, búsqueda semántica, 'más como esta', filtrado colaborativo."

**Pilares que refuerza** (Constitución, principio I): *Intención* (los filtros nuevos y una búsqueda mejor ordenada acercan a quien busca a la prenda que necesita; el feed prioriza lo que encaja con su necesidad y su gusto) y *Local / independiente* (el reparto por marca se mantiene, de modo que la personalización no concentra la visibilidad en pocas marcas). Apoya el principio II: la meta es más clics salientes atribuibles por persona.

## Contexto (medido en producción, 2026-11-13)

| Dato | Valor |
|---|---|
| Usuarios registrados | 46 (6 con estilos elegidos en el onboarding) |
| Ítems publicados en el feed | 237 prendas, 0 outfits, de 10 marcas |
| Guardados / likes / marcas seguidas | 0 / 1 / 1 |
| Clics salientes | 1 758 en total (1 659 en los últimos 30 días); solo 14 con sesión identificada |
| Prendas con tallas cargadas | 196 de 237 |
| Prendas con color cargado | 8 de 237 (texto libre, sin normalizar) |

Hoy el orden "Relevante" es idéntico para todo el mundo (reparto por marca + popularidad + mezcla diaria). Lo único personal son los chips de sugerencia, que aplican un filtro pero no cambian el orden. Con tan pocas interacciones, recomendar con base en "personas parecidas" no es viable todavía: la v1 se basa en el **contenido** (etiquetas, marca, ciudad, precio) cruzado con lo que cada persona declara y hace.

## Alcance

**Dentro**:
1. Registro de señales de comportamiento: impresiones en el feed, vistas de detalle (prenda, outfit, marca), búsquedas, y atribución del clic saliente a la persona cuando tiene sesión.
2. Perfil de gusto por persona con sesión, derivado del onboarding y de su comportamiento, con más peso a lo reciente.
3. Orden "Relevante" del feed personalizado para personas con sesión, sin cambios visibles en la interfaz.
4. Orden "Relevante" de los resultados de búsqueda que también tiene en cuenta el gusto, y mejoras de relevancia.
5. Filtros nuevos: talla, color, marca y rango de precio libre, con contador de resultados por opción.

**Fuera** (esta spec lo deja explícitamente fuera): búsqueda semántica o entre idiomas y embeddings (fuera de alcance por la constitución, principio VIII); "más como esta" / prendas similares; recomendación colaborativa ("a quienes les gustó X…"); sección o carrusel "Para ti" visible; explicaciones del tipo "porque guardaste X"; notificaciones o correos de recomendación; pruebas A/B con reparto de tráfico; personalización para visitantes sin sesión; panel de control para que la persona edite su perfil de gusto (más allá de los ajustes de estilos/ciudad que ya existen en `/settings`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El feed "Relevante" se adapta a lo que cada persona busca y guarda (Priority: P1)

Una persona con sesión eligió "minimalista" y "Medellín" en el onboarding y, durante la semana, abrió varias prendas de lino y guardó dos vestidos de una marca de Barranquilla. Al volver a `/feed` (orden "Relevante" por defecto) ve primero prendas que encajan con ese gusto: estilo minimalista, vestidos, la marca que guardó y marcas parecidas, en su rango de precio habitual. Igual sigue viendo prendas de muchas marcas distintas y algunas fuera de su gusto, para descubrir.

**Why this priority**: es el corazón del pedido ("cómo le sale el feed a cada usuario") y la palanca más directa sobre los clics salientes por persona.

**Independent Test**: con dos cuentas de prueba de gustos opuestos (por ejemplo, una con estilo "minimalista" y otra con estilo "urbano", cada una con algunas interacciones), abrir `/feed` con cada una y comparar las primeras 24 tarjetas: el orden debe ser distinto y cada lista debe estar dominada por su estilo, sin perder el reparto por marca.

**Acceptance Scenarios**:

1. **Given** una persona con sesión y gusto definido, **When** abre `/feed` en orden "Relevante" sin filtros, **Then** entre las primeras 24 tarjetas la proporción de ítems que coinciden con su gusto es claramente mayor que en el feed no personalizado.
2. **Given** el feed personalizado, **When** se revisan las primeras 24 tarjetas, **Then** ninguna marca ocupa más de la cuota de diversidad definida (FR-014) y al menos una parte de las tarjetas son de exploración (FR-015).
3. **Given** una persona sin sesión, o con sesión pero sin onboarding ni interacciones, **When** abre `/feed`, **Then** ve el mismo orden que antes de esta feature.
4. **Given** una persona con sesión, **When** elige orden "Nuevo", "Popular" o "A–Z", **Then** el orden es el mismo que hoy, sin personalización.
5. **Given** una persona que baja por el feed con scroll infinito, **When** se cargan páginas siguientes, **Then** no se repiten ni se saltan ítems dentro de la misma sesión de navegación del día.
6. **Given** una persona que guarda una prenda, **When** vuelve a cargar el feed, **Then** el cambio de gusto se refleja en el orden a más tardar en la siguiente carga del feed (sin esperar a un proceso nocturno).
7. **Given** una persona con filtros activos (por ejemplo, ocasión "boda"), **When** está en orden "Relevante", **Then** el filtro manda (solo ve ítems de boda) y la personalización solo reordena dentro de ese resultado.

---

### User Story 2 - Icon registra qué ve, abre y busca cada persona (Priority: P1)

Sin que la persona note nada, Icon registra las tarjetas que se mostraron en su pantalla, las fichas de prenda, outfit y marca que abrió, las búsquedas que hizo (con sus filtros y cuántos resultados obtuvo) y, cuando tiene sesión, a quién pertenece cada clic hacia la tienda. El equipo puede consultar estos datos de forma agregada.

**Why this priority**: sin estas señales el perfil de gusto solo tendría el onboarding (6 de 46 personas lo completaron) y no habría forma de medir si la personalización funciona. Es requisito de la Historia 1 y de los criterios de éxito.

**Independent Test**: con una cuenta de prueba, navegar el feed, abrir dos prendas y una marca, buscar "vestido", hacer clic en "Ir a la tienda" y comprobar que cada acción quedó registrada una vez, con la persona correcta, y que una persona distinta no puede leer esos registros.

**Acceptance Scenarios**:

1. **Given** una persona con sesión, **When** hace clic en "Ir a la tienda" de una prenda, **Then** el clic saliente queda atribuido a ella (además de seguir registrándose como hoy).
2. **Given** una tarjeta del feed que entra en pantalla de forma visible, **When** permanece visible un tiempo mínimo, **Then** se registra una impresión una sola vez por tarjeta y por carga de página.
3. **Given** una persona que abre la ficha de una prenda, un outfit o una marca, **When** la página carga, **Then** se registra una vista de detalle.
4. **Given** una persona que busca o cambia filtros, **When** se muestran resultados, **Then** se registra la búsqueda con el texto, los filtros, la pestaña y el número de resultados (incluido cero).
5. **Given** un visitante sin sesión, **When** navega, **Then** sus señales se registran de forma anónima, sin identificador persistente entre visitas, y no alimentan ningún perfil.
6. **Given** una persona con sesión, **When** intenta leer las señales de otra persona, **Then** el sistema lo impide.
7. **Given** que el registro de una señal falla, **When** la persona navega, **Then** la página funciona igual, sin error visible ni demora perceptible.

---

### User Story 3 - Filtrar por talla, marca, color y un rango de precio propio (Priority: P2)

Quien busca un vestido talla M para una boda abre el panel de filtros y, además de ocasión, ciudad, categoría, estilo y los rangos de precio actuales, puede elegir su talla, una o varias marcas, un color y escribir un precio mínimo y máximo. Cada opción muestra cuántos resultados tendría, así sabe de antemano si una combinación deja la pantalla vacía.

**Why this priority**: la dueña identificó que faltan filtros; refuerza directamente el pilar de intención. Va después de la personalización porque no depende de ella y porque el filtro de color requiere datos que hoy casi no existen.

**Independent Test**: en `/feed`, aplicar talla "M" + una marca + precio entre 100 000 y 250 000 y comprobar que todas las tarjetas cumplen las tres condiciones, que los contadores coinciden con lo que se ve y que la URL resultante se puede compartir y reproduce el mismo filtro.

**Acceptance Scenarios**:

1. **Given** el panel de filtros, **When** la persona elige una talla, **Then** solo ve prendas disponibles en esa talla (y outfits que contengan al menos una prenda en esa talla).
2. **Given** el panel de filtros, **When** elige una o varias marcas, **Then** solo ve ítems de esas marcas.
3. **Given** el panel de filtros, **When** escribe un precio mínimo y/o máximo, **Then** solo ve ítems cuyo precio cae en ese rango; si además hay rangos predefinidos marcados, se respeta la intersección de ambos.
4. **Given** el panel de filtros, **When** elige un color, **Then** solo ve prendas de ese color.
5. **Given** cualquier grupo de filtros, **When** se muestran sus opciones, **Then** cada opción indica cuántos resultados habría considerando los demás filtros ya activos, y las opciones con cero resultados se ven atenuadas pero siguen disponibles.
6. **Given** filtros nuevos aplicados, **When** se copia la URL y se abre en otro navegador, **Then** se ven los mismos filtros activos y los mismos resultados.
7. **Given** filtros nuevos activos, **When** la persona los ve en la fila de chips activos, **Then** puede quitar cada uno con un toque, igual que los filtros existentes.

---

### User Story 4 - La búsqueda encuentra mejor y ordena según el gusto (Priority: P2)

Quien escribe "vestido lino" espera ver primero vestidos de lino, después prendas cercanas, y entre resultados igual de pertinentes, los que encajan con su gusto. Hoy los resultados se ordenan casi solo por parecido de texto y ciudad, y la dueña los percibe como pobres.

**Why this priority**: complementa la Historia 1 en el otro punto de entrada al catálogo. Va después porque reutiliza el perfil de gusto.

**Independent Test**: con un conjunto fijo de búsquedas de referencia (FR-026), comparar los primeros 10 resultados antes y después: los ítems que coinciden con todas las palabras deben estar por encima de los que coinciden con una sola, y entre dos cuentas con gustos distintos el orden de resultados igual de pertinentes debe diferir.

**Acceptance Scenarios**:

1. **Given** una búsqueda de varias palabras, **When** se muestran resultados en orden "Relevante", **Then** los ítems que contienen todas las palabras (o sus sinónimos) aparecen antes que los que contienen solo algunas.
2. **Given** una coincidencia en el título de la prenda, **When** se compara con una coincidencia solo en la descripción, **Then** la del título aparece antes, en igualdad de lo demás.
3. **Given** dos resultados con pertinencia de texto similar, **When** la persona tiene sesión y gusto definido, **Then** aparece primero el que más encaja con su gusto.
4. **Given** una búsqueda sin resultados, **When** se muestra la pantalla vacía, **Then** queda registrada como búsqueda sin resultados para que el equipo la revise (por ejemplo, para crear sinónimos).
5. **Given** una persona sin sesión, **When** busca, **Then** el orden depende solo de la pertinencia, la ciudad y la popularidad, como hoy.

---

### User Story 5 - El equipo ve si la personalización funciona (Priority: P3)

La dueña entra al panel de administración y ve, por semana: impresiones, vistas de detalle, clics salientes y la tasa de clic (clics / impresiones), separadas entre personas con feed personalizado y sin él, y la lista de búsquedas frecuentes y búsquedas sin resultados.

**Why this priority**: permite decidir con datos si la v1 sirve y qué ajustar, pero el sistema funciona sin este tablero.

**Independent Test**: tras generar actividad de prueba con cuentas con y sin perfil de gusto, abrir el panel y comprobar que los números coinciden con lo generado.

**Acceptance Scenarios**:

1. **Given** una persona del equipo (curaduría o admin), **When** abre la sección de recomendación del panel, **Then** ve impresiones, vistas, clics salientes y tasa de clic por semana, separados en "feed personalizado" y "feed general".
2. **Given** el mismo panel, **When** revisa búsquedas, **Then** ve las búsquedas más frecuentes y las búsquedas sin resultados de los últimos 30 días.
3. **Given** una persona sin rol de equipo, **When** intenta abrir esa sección, **Then** no puede acceder.

---

### Edge Cases

- **Arranque en frío**: persona recién registrada que omitió el onboarding y no tiene interacciones → feed general, como hoy. Tras su primera interacción, el feed empieza a adaptarse.
- **Gusto muy estrecho**: persona que solo interactuó con una marca → la diversidad por marca (FR-014) y la exploración (FR-015) evitan que el feed sea solo esa marca.
- **Señales contradictorias**: eligió "elegante" en el onboarding pero solo abre prendas urbanas → con el tiempo lo que hace pesa más que lo declarado (FR-010).
- **Prenda despublicada o marca desactivada**: sus señales pasadas se conservan para el gusto agregado (estilos, categorías), pero el ítem nunca aparece en el feed ni en resultados.
- **Persona que borra su cuenta**: se eliminan su perfil de gusto y sus señales identificadas (o se desvinculan de ella, quedando anónimas).
- **Ráfagas y bots**: muchas impresiones o vistas repetidas en poco tiempo desde la misma persona o el mismo navegador → se cuentan una vez por ítem y ventana de tiempo; no inflan la popularidad.
- **Catálogo con filtros muy restrictivos**: la combinación deja cero resultados → pantalla vacía actual con "Limpiar filtros"; los contadores ya lo anticipaban.
- **Precio libre inválido**: mínimo mayor que máximo, valores negativos o no numéricos → se ignora o se corrige de forma visible, sin romper la página.
- **Prenda sin talla o sin color cargado**: no aparece cuando hay filtro de talla o color activo; sí aparece sin esos filtros.
- **Outfits**: hoy no hay outfits publicados; cuando existan, heredan talla, marca, color y precio de sus prendas etiquetadas.
- **Persona del equipo o marca navegando el feed**: se registran sus señales como las de cualquiera, pero se excluyen de las métricas del tablero.

## Requirements *(mandatory)*

### Functional Requirements

**Señales**

- **FR-001**: El sistema MUST atribuir cada clic saliente a la persona cuando tiene sesión, sin alterar el registro actual del clic ni la redirección a la tienda (principio II).
- **FR-002**: El sistema MUST registrar una impresión cuando una tarjeta del feed o de resultados de búsqueda está visible al menos en un 50 % durante al menos 1 segundo, una vez por tarjeta y por carga de página, indicando la posición, la superficie (feed / búsqueda), el orden activo y si el orden estaba personalizado.
- **FR-003**: El sistema MUST registrar una vista de detalle al abrir la ficha de una prenda, un outfit o una marca.
- **FR-004**: El sistema MUST registrar cada búsqueda o cambio de filtros que produce resultados en pantalla: texto buscado, filtros, pestaña, orden y número de resultados.
- **FR-005**: Las señales de visitantes sin sesión MUST registrarse sin identificador persistente entre visitas y MUST NOT alimentar ningún perfil.
- **FR-006**: Cada persona MUST poder leer solo sus propias señales; el equipo MUST poder leerlas de forma agregada; nadie más MUST poder leerlas. Las marcas MUST NOT acceder a señales individuales.
- **FR-007**: Un fallo al registrar una señal MUST NOT afectar la navegación ni mostrar errores, y el registro MUST NOT retrasar de forma perceptible la carga de páginas.
- **FR-008**: El sistema MUST descartar repeticiones de la misma señal (misma persona o navegador, mismo ítem, mismo tipo) dentro de una ventana corta, para evitar inflado por recargas o bots.

**Perfil de gusto**

- **FR-009**: El sistema MUST mantener, para cada persona con sesión, un perfil de afinidad hacia: estilos, ocasiones, categorías, marcas, ciudad y rango de precio.
- **FR-010**: El perfil MUST combinar lo declarado (estilos y ciudad del onboarding o de `/settings`) con lo que la persona hace, con pesos por tipo de acción en este orden de fuerza: clic saliente y guardado > like y seguir marca > vista de detalle > impresión sin interacción (que no suma). Las acciones MUST perder peso con el tiempo (media vida de referencia: 30 días), de modo que el comportamiento reciente domine sobre lo declarado al cabo de unas semanas de uso.
- **FR-011**: Un cambio de comportamiento (guardar, dar like, seguir, abrir una ficha, hacer clic hacia la tienda) MUST reflejarse en el orden del feed como tarde en la siguiente carga del feed.
- **FR-012**: Al cambiar estilos o ciudad en `/settings`, el perfil MUST actualizarse con los nuevos valores declarados.

**Feed personalizado**

- **FR-013**: En orden "Relevante", para personas con perfil de gusto no vacío, el feed MUST ordenarse combinando: afinidad del ítem con el perfil, calidad/popularidad del ítem y novedad. Para el resto, el orden MUST ser el actual.
- **FR-014**: El feed personalizado MUST conservar el reparto por marca: en cualquier bloque de 12 tarjetas consecutivas, una misma marca MUST NOT ocupar más de 3, salvo que los filtros activos dejen menos marcas disponibles.
- **FR-015**: Aproximadamente 1 de cada 5 tarjetas del feed personalizado MUST ser de exploración: ítems bien valorados en general que no coinciden con el gusto de la persona.
- **FR-016**: Los filtros activos MUST aplicarse siempre antes de personalizar; la personalización solo reordena.
- **FR-017**: La paginación del feed personalizado MUST ser estable durante el día para una persona: sin ítems repetidos ni saltados al cargar páginas siguientes, aunque su perfil cambie a mitad de la sesión.
- **FR-018**: Los órdenes "Nuevo", "Popular" y "A–Z" MUST NOT cambiar.
- **FR-019**: La interfaz MUST NOT mostrar indicadores de personalización (sin sección "Para ti" ni explicaciones); la experiencia visual de `/feed` se mantiene igual.
- **FR-020**: Las impresiones MUST NOT sumar a la popularidad pública de un ítem; la popularidad sigue alimentándose de guardados, likes y clics salientes.

**Filtros nuevos**

- **FR-021**: El panel de filtros de `/feed` MUST ofrecer, además de los actuales: **talla** (las tallas del catálogo, agrupadas por sistema alfabético/numérico/especial), **marca** (marcas activas con contenido publicado, con buscador si son más de 8), **color** y **precio libre** (mínimo y máximo en COP).
- **FR-022**: Cada opción de los filtros MUST mostrar el número de resultados que habría al elegirla, con los demás filtros activos aplicados; las opciones con cero resultados MUST verse atenuadas.
- **FR-023**: Los filtros nuevos MUST reflejarse en la URL (compartible), en la fila de chips activos (removibles uno a uno) y aplicarse tanto en el feed como en las pestañas de búsqueda donde tengan sentido (talla, color y precio en Prendas y Outfits; marca en Prendas, Outfits y Todo).
- **FR-024**: El filtro de color MUST trabajar sobre una paleta cerrada de colores. La paleta y la carga del color del catálogo existente las resuelve la spec `004-etiquetado-abierto-ia` (requisito previo de esta).

**Búsqueda**

- **FR-025**: En orden "Relevante", los resultados de búsqueda MUST priorizar, en este orden: coincidencia de todas las palabras (o sinónimos) sobre coincidencias parciales; coincidencia en el título sobre coincidencia en la descripción o etiquetas; y, en igualdad de pertinencia, afinidad con el gusto de la persona, ciudad y popularidad.
- **FR-026**: El equipo MUST contar con un conjunto de al menos 20 búsquedas de referencia con los resultados esperados en el top 5, usado para verificar que los cambios de relevancia no empeoran los resultados.
- **FR-027**: Las búsquedas sin resultados MUST quedar visibles para el equipo (ver FR-029).

**Medición**

- **FR-028**: El panel de administración MUST mostrar, por semana y separando "feed personalizado" de "feed general": impresiones, vistas de detalle, clics salientes y tasa de clic (clics salientes / impresiones). Las cuentas con rol de equipo o de marca MUST excluirse de estas métricas.
- **FR-029**: El panel MUST mostrar las búsquedas más frecuentes y las búsquedas sin resultados de los últimos 30 días.
- **FR-030**: Solo los roles curator y admin MUST poder ver esta sección.

**Privacidad y ciclo de vida**

- **FR-031**: Al eliminar una cuenta, su perfil de gusto MUST borrarse y sus señales MUST borrarse o quedar anónimas.
- **FR-032**: Las señales detalladas (impresiones, vistas, búsquedas) MUST conservarse un máximo de 180 días; los agregados para el tablero MAY conservarse más tiempo.
- **FR-033**: La política de privacidad / términos visibles MUST mencionar que Icon usa la actividad dentro de la plataforma para ordenar el contenido.

### Key Entities

- **Señal de comportamiento**: una acción observada. Atributos: tipo (impresión, vista de detalle, búsqueda, clic saliente; guardados, likes y follows ya existen como registros propios), persona (si hay sesión), ítem (prenda, outfit o marca, si aplica), superficie y posición, orden activo y si estaba personalizado, momento.
- **Búsqueda registrada**: texto, filtros, pestaña, orden, número de resultados, persona (si hay sesión), momento.
- **Perfil de gusto**: uno por persona con sesión. Afinidad (valor numérico) por estilo, ocasión, categoría, marca, ciudad y rango de precio; fecha de última actualización. Derivado de lo declarado y de las señales; no editable directamente.
- **Color del catálogo**: paleta cerrada de colores con nombre en español; cada prenda puede tener uno o más.
- **Talla, marca, precio** (existentes): ya forman parte del catálogo; se exponen como filtros nuevos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Al menos el 95 % de los clics salientes hechos con sesión quedan atribuidos a la persona (hoy prácticamente ninguno lo está).
- **SC-002**: Para una persona con gusto definido, al menos el 60 % de las primeras 24 tarjetas del feed "Relevante" coinciden con al menos uno de sus estilos, categorías o marcas de mayor afinidad, frente a la proporción del feed general.
- **SC-003**: En ningún bloque de 12 tarjetas del feed personalizado una marca ocupa más de 3 posiciones (salvo filtros que lo impidan).
- **SC-004**: Tras 4 semanas en producción, la tasa de clic saliente por impresión del feed personalizado es al menos un 20 % mayor que la del feed general para personas comparables. Si no se alcanza, el tablero permite verlo y el equipo ajusta pesos.
- **SC-005**: El feed y la búsqueda cargan, para quien navega, sin demora perceptible respecto a hoy: el tiempo hasta ver las primeras tarjetas no empeora más de 300 ms con el catálogo actual y con un catálogo 10 veces mayor.
- **SC-006**: En las 20 búsquedas de referencia, al menos 17 tienen el resultado esperado dentro del top 5.
- **SC-007**: Una persona encuentra una prenda de su talla, de una marca concreta y dentro de su presupuesto en menos de 30 segundos desde que abre `/feed`, sin escribir en el buscador.
- **SC-008**: El porcentaje de búsquedas sin resultados es medible desde el primer día y baja semana a semana a medida que el equipo agrega sinónimos.

## Assumptions

- "Persona", "usuario" y "quien navega" se usan como sinónimos de cuenta con rol `user`; el lenguaje sigue el principio VII.
- La personalización se calcula dentro de la base de datos existente, sin servicios nuevos (principio IV); la escala objetivo (10 marcas, 100 usuarios, cientos de ítems) no justifica infraestructura adicional. Se diseña para que siga funcionando con 10 veces más catálogo.
- Los guardados, likes y follows ya existen; esta feature solo los usa como señales, no los modifica.
- Los pesos concretos por tipo de acción, la media vida y la proporción de exploración son valores de partida ajustables por el equipo sin cambiar la interfaz.
- La "estabilidad durante el día" de la paginación (FR-017) se apoya en la mezcla diaria que ya existe.
- Los clics salientes históricos anónimos (más de 1 700) no se pueden atribuir a nadie y no se intentan reconstruir; sí siguen contando para la popularidad.
- La medición de impresiones solo aplica a las superficies de lista (feed y resultados de búsqueda); la landing y las fichas de marca no registran impresiones en esta versión.
- La política de privacidad existe o se agrega como texto simple; no requiere banner de consentimiento adicional, porque los datos se usan solo dentro de Icon y no se comparten con terceros.
- Los filtros de talla y precio aplican a outfits a través de sus prendas etiquetadas; mientras no haya outfits publicados, el efecto visible es solo sobre prendas.
- La rama de trabajo se crea a partir de `dev`, según el flujo de la constitución.
