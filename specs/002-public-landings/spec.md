# Feature Specification: Landings públicas para personas y para marcas

**Feature Branch**: `landings`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "Dos landings públicas para Icon: una para usuarios (la ruta `/` actual, rediseñada) y otra para marcas (`/marcas`). Cada una con propuesta de valor visible arriba, CTA claro, captura de interés funcionando (solicitar subida asistida de catálogo y postular una marca) y analítica instalada. Basado en el boceto `Note 4_11_2026.pdf`."

**Pilares que refuerza** (Constitución, principio I): *Local / independiente* (ambas landings existen para atraer al nicho: marcas colombianas independientes y quienes las buscan), *Intención* (la landing de personas enseña a buscar por necesidad concreta —ocasión, ciudad, precio, estilo— y no a "inspirarse") y *Curaduría / estética* (la landing de marcas explica que cada perfil se revisa antes de publicarse, y la calidad visual de las landings es parte de la propuesta premium). Apoya además la escala objetivo del MVP (10 marcas · 100 usuarios): son la puerta de entrada de ambos lados.

**Boceto de referencia**: `Note 4_11_2026.pdf` (5 páginas: landing de marca, "Tu panel", landing de usuario). Maqueta visual de esta spec: `specs/002-public-landings/mockups/landings.html`.

## Alcance

**Dentro**: rediseño de `/` como landing para personas que buscan ropa; nueva landing `/marcas`; los dos formularios de captura de interés (solicitud de subida asistida y postulación de marca); medición de visitas, clics y envíos; enlaces cruzados entre ambas landings; vista para el equipo de lo capturado.

**Fuera** (esta spec lo deja explícitamente fuera): perfil público de usuario y publicación de outfits por personas (Fase 1 del roadmap); reseñas de productos (Fase 2); correo transaccional de confirmación (Fase 2, requiere dominio propio); seguimiento de estados tipo CRM de lo capturado; pruebas A/B; blog o contenido SEO; versión en otro idioma; cambios al registro, al feed o al panel de marca; las funciones que la constitución mantiene fuera de alcance (PWA, pagos o inventario, dominio propio de imágenes, expansión fuera de Colombia).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Una marca entiende la propuesta y elige cómo subir su catálogo (Priority: P1)

Una persona que lleva una marca independiente llega a `/marcas` (desde un anuncio, un enlace compartido o la otra landing), sin tener cuenta. En la primera pantalla entiende qué gana: crear su perfil, etiquetar sus prendas y que quien busca justo lo que hace la encuentre y le escriba o compre directo en su tienda o su WhatsApp. Más abajo ve las dos formas de entrar —"Lo subo yo" y "Súbanlo ustedes"— y elige una.

**Why this priority**: sin marcas no hay contenido; es el lado del mercado que hoy limita el crecimiento (escala objetivo: 10 marcas). Es la landing que mueve la métrica de adquisición.

**Independent Test**: abrir `/marcas` en un celular, sin sesión, y verificar que en la primera pantalla se lee la propuesta y se ve el botón principal; luego recorrer la página y llegar a cualquiera de los dos caminos de entrada.

**Acceptance Scenarios**:

1. **Given** una persona sin cuenta, **When** abre `/marcas`, **Then** ve sin desplazarse la propuesta de valor, los tres pasos (Crea → Etiqueta → Vende en tu canal) y un botón principal claro.
2. **Given** la sección "¿Cómo subo?", **When** la persona lee las dos opciones, **Then** entiende qué incluye cada una, qué debe aportar ella y cuál es gratuita ("por ahora"), y cada opción tiene su propio botón (crear cuenta de marca / solicitar).
3. **Given** la persona elige "Lo subo yo", **When** pulsa el botón, **Then** llega al registro de marca ya existente, con el tipo de cuenta de marca preseleccionado.
4. **Given** la persona ya tiene sesión de marca, **When** abre `/marcas`, **Then** el botón principal la lleva a su panel en vez de pedirle crear una cuenta.

---

### User Story 2 - Una persona que busca ropa entiende la propuesta y crea su cuenta o explora (Priority: P1)

Quien busca ropa colombiana llega a `/` sin cuenta. En la primera pantalla entiende que en Icon *busca* lo que necesita (por ocasión, ciudad, precio y estilo), *ve* qué marcas lo tienen y *compra directo* a la marca. Puede crear su cuenta o explorar el feed sin registrarse.

**Why this priority**: es la landing por defecto (`/`) y la primera impresión del producto; además da la señal de demanda que convence a las marcas.

**Independent Test**: abrir `/` en un celular, sin sesión, y en menos de 10 segundos identificar qué hace Icon y ejecutar el botón principal o el de explorar.

**Acceptance Scenarios**:

1. **Given** una persona sin cuenta, **When** abre `/`, **Then** ve sin desplazarse la propuesta de valor, los tres pasos (Busca → Muestra → Compra) y un botón principal ("Crea tu cuenta") con uno secundario ("Explorar el feed").
2. **Given** la sección de búsqueda por necesidad, **When** la persona la ve, **Then** entiende con un ejemplo concreto ("Necesito un … para …") que se busca por intención y no por marca.
3. **Given** la persona pulsa "Explorar el feed", **When** llega al feed, **Then** puede navegar y filtrar sin crear cuenta.
4. **Given** la persona ya tiene sesión, **When** abre `/`, **Then** no se le pide crear una cuenta: el botón principal la lleva al feed.

---

### User Story 3 - Una marca pide que Icon suba su catálogo por ella (Priority: P1)

Una marca que no quiere (o no puede) cargar su catálogo elige "Súbanlo ustedes" y pulsa "Solicitar". Deja los datos mínimos para que el equipo la contacte y ve una confirmación clara de qué pasa después.

**Why this priority**: es la captura de interés que pide el criterio de aceptación y la vía de menor fricción para sumar marcas: el equipo ya puede importar un catálogo desde una tienda (spec 001), así que la solicitud conecta una demanda con una capacidad que ya existe.

**Independent Test**: enviar una solicitud completa y verificar que (a) la persona ve la confirmación, (b) el equipo la ve en su vista con todos los datos, y (c) enviar dos veces seguidas no la duplica.

**Acceptance Scenarios**:

1. **Given** el formulario de solicitud, **When** la persona lo completa con datos válidos y acepta el tratamiento de datos, **Then** ve una confirmación inmediata que dice qué sigue y por qué canal la contactarán.
2. **Given** un dato inválido o faltante, **When** intenta enviar, **Then** el mensaje de error, en español, aparece junto al campo y no pierde lo ya escrito.
3. **Given** un envío exitoso, **When** el equipo abre su vista de solicitudes, **Then** ve la solicitud con tipo, datos de contacto, enlace de la marca, ciudad, fecha y de qué landing o campaña llegó.
4. **Given** la persona pulsa dos veces "Solicitar" o recarga justo después, **When** el sistema recibe ambos envíos, **Then** queda una sola solicitud.

---

### User Story 4 - Una persona postula una marca que quiere ver en Icon (Priority: P2)

Quien navega la landing de personas conoce una marca independiente que le gusta y no está en Icon. La postula con un formulario corto. Esto sirve a Icon como lista de marcas a invitar.

**Why this priority**: convierte la landing de personas en una fuente de marcas (la otra mitad del mercado) a bajo costo y da una segunda captura de interés.

**Independent Test**: postular una marca solo con su nombre y su Instagram o enlace y verificar que el equipo la ve; repetir con la misma marca y verificar que se reconoce como repetida.

**Acceptance Scenarios**:

1. **Given** la sección "Postula una marca", **When** la persona escribe el nombre de la marca y su enlace o Instagram y envía, **Then** ve la confirmación y el equipo ve la postulación.
2. **Given** la persona deja su contacto, **When** envía, **Then** se le pide aceptar el tratamiento de datos; sin contacto no se pide, porque no se guarda ningún dato personal suyo.
3. **Given** una marca postulada por varias personas, **When** el equipo revisa las postulaciones, **Then** puede ver cuántas veces se postuló esa misma marca.
4. **Given** una marca que ya está en Icon, **When** alguien la postula, **Then** se le indica que ya está y se le ofrece verla.

---

### User Story 5 - El equipo mide qué funciona en cada landing (Priority: P2)

Tras publicar, el equipo quiere saber cuánta gente llega a cada landing, de dónde viene, cuántos pulsan el botón principal y cuántos envían cada formulario, para decidir qué ajustar.

**Why this priority**: es el criterio "analítica instalada"; sin medición, las landings no se pueden mejorar y la métrica de adquisición no se puede atribuir.

**Independent Test**: tras visitar cada landing con un enlace de campaña de prueba, pulsar los botones y enviar ambos formularios, verificar que cada acción aparece en la herramienta de medición.

**Acceptance Scenarios**:

1. **Given** una visita a `/` o `/marcas`, **When** llega con parámetros de campaña, **Then** la visita queda registrada con su origen.
2. **Given** cualquier botón de acción (principal, secundario, de sección), **When** se pulsa, **Then** queda registrado cuál botón y en qué sección.
3. **Given** un envío de formulario, **When** termina bien o con error, **Then** se registra el resultado, sin incluir ningún dato personal.
4. **Given** una persona con bloqueador de anuncios, **When** usa la landing, **Then** todo funciona igual (solo se pierde esa medición).

---

### User Story 6 - Se ve prueba de que Icon ya funciona (Priority: P3)

Quien llega ve cifras reales (marcas, publicaciones, personas) y las marcas que ya están, para creer que no es una promesa vacía.

**Why this priority**: refuerza la confianza y la conversión, pero ambas landings funcionan sin ello; con pocas marcas puede incluso restar.

**Independent Test**: con cifras reales por encima del mínimo, verificar que se muestran y coinciden con los datos; con cifras por debajo, verificar que se ocultan.

**Acceptance Scenarios**:

1. **Given** cifras reales por encima del umbral mínimo, **When** se abre la landing, **Then** los contadores muestran esos valores (redondeados hacia abajo con "+" cuando corresponda).
2. **Given** una cifra por debajo del umbral, **When** se abre la landing, **Then** ese contador no se muestra.
3. **Given** marcas activas con logo, **When** se abre `/marcas`, **Then** se muestra una franja con esos logos; si no hay ninguna, la franja no aparece.

### Edge Cases

- Conexión lenta o móvil de gama baja: el titular, la propuesta y el botón principal aparecen primero; las ilustraciones no bloquean la lectura.
- Pantalla de 360 px de ancho: sin desplazamiento horizontal; botones y campos cómodos de tocar.
- Persona con sesión iniciada visitando cualquiera de las dos landings (ver US1 y US2).
- Envío con correo mal escrito, teléfono con espacios o prefijo, enlace sin "https", Instagram con o sin "@".
- Envíos repetidos, automatizados o masivos: no deben saturar la vista del equipo ni dejar entrar basura.
- Una marca que se postula a sí misma desde la landing de personas, o una persona que usa la solicitud de marca: se acepta igual, el equipo las distingue por tipo.
- Contadores en cero o muy bajos; ninguna marca activa con logo; todo se oculta sin dejar huecos.
- Enlaces con parámetros de campaña muy largos: no se rompen ni se muestran al visitante.
- Navegación solo con teclado y lectores de pantalla; animaciones para quien pide reducir el movimiento.
- Bloqueadores de anuncios o fallas de la medición: nunca impiden navegar ni enviar formularios.
- Compartir el enlace por WhatsApp o Instagram: cada landing muestra su propio título, descripción e imagen.

## Clarifications

### Session 2026-11-04

- Q: ¿Cómo se muestran "Comparte tu estilo" y "Escribe reseñas" si hoy no existen? → A: Se incluyen en el diseño, rotuladas "Próximamente" (FR-017).
- Q: ¿Qué compromiso de respuesta declara la confirmación de la subida asistida? → A: El mismo día hábil, por el canal (WhatsApp o correo) que dejó la marca (FR-024).
- Q: ¿Tipografía del wordmark y títulos? → A: Una serif de exhibición (Instrument Serif) solo para el wordmark y los títulos grandes, añadida como token al sistema compartido; el cuerpo sigue en Geist.
- Q: ¿Aviso de tratamiento de datos? → A: Se redacta un borrador en `/privacidad`, marcado para revisión legal antes de captar datos reales en producción.
- Q: ¿Dónde se miden clics y envíos? → A: En una tabla propia (sin datos personales) consultable desde `/admin`; las visitas siguen en la analítica actual. No depende del plan de la plataforma de despliegue.
- Dominios: la landing de personas vive en `iconcolombia.com/` y la de marcas en `iconcolombia.com/marcas`. El dominio ya está comprado y conectado a la plataforma de despliegue.
- Q: ¿Umbral de las cifras públicas (FR-020)? → A: Se muestran desde 10 marcas, 50 publicaciones y 100 personas; por debajo, cada contador se oculta.
- Q: ¿Quién atiende las solicitudes? → A: Un grupo del equipo, solo con WhatsApp personales (sin WhatsApp Business). El aviso al grupo queda pendiente de decidir (ver plan).
- Assets: las ilustraciones (personas, camiseta, caja de ropa, marcador) y las imágenes para compartir son SVG con la paleta. Las fotos de prendas y outfits quedan como marcadores que el equipo reemplaza.
- "Importar desde Instagram" se muestra como "Próximamente" mientras esté apagado en producción (pendiente de la revisión de Meta).
- Diseño: la UI sigue la estructura del boceto `Note 4_11_2026.pdf` y usa más la paleta existente (coral, honey, leaf, blush, sky además de forest/cream).

## Requirements *(mandatory)*

### Functional Requirements

**Acceso público**

- **FR-001**: `/` (personas) y `/marcas` (marcas) MUST poder abrirse mediante un enlace público, sin cuenta de Icon y sin pedir credenciales de ningún servicio, incluido el entorno de revisión que se comparta con terceros.
- **FR-002**: Cada landing MUST enlazar a la otra de forma visible arriba (por ejemplo, "Soy persona / Tengo una marca") y en el pie.
- **FR-003**: Si la persona ya tiene sesión, el botón principal MUST cambiar a una acción útil (ir al feed o a su panel) en vez de pedir crear una cuenta.

**Propuesta de valor y llamado a la acción**

- **FR-004**: En la primera pantalla, sin desplazarse, tanto en un celular de 360×640 como en un escritorio de 1366×768, MUST verse el titular con la propuesta de valor, una frase de apoyo y el botón principal.
- **FR-005**: Cada landing MUST tener un único botón principal, con la misma etiqueta cada vez que se repite (arriba, a mitad de página y al cierre), y como máximo un botón secundario.
- **FR-006**: Cada landing MUST abrir con el nombre ICON y tres pasos numerados que expliquen el recorrido. Marcas: **Crea → Etiqueta → Vende**. Personas: **Busca → Muestra → Compra**.
- **FR-007**: El texto MUST respetar el principio "Conectar, no vender": nunca debe sugerir que Icon cobra, procesa pagos o gestiona envíos. El paso "Vende" de marcas MUST aclarar que la venta ocurre en el canal propio de la marca (su tienda o su WhatsApp); el paso "Compra" de personas MUST decir que se compra directo a la marca.
- **FR-008**: Todo lo que las landings muestren como disponible MUST existir hoy en el producto; lo que no exista MUST rotularse "Próximamente" o no mostrarse. No se permiten promesas sin respaldo.

**Landing de marcas** (`/marcas`, en el orden del boceto)

- **FR-009**: MUST incluir la sección **"¿Cómo subo?"** con dos opciones lado a lado: **A. Tú** (creas tu cuenta, armas tu perfil y subes tu catálogo —manual, por Excel o importando de Instagram—) y **B. Nosotros** (el equipo carga tu catálogo por ti a partir de tu tienda o tu Excel). Cada opción MUST listar qué incluye y qué debe aportar la marca, y tener su botón ("Crear tu cuenta" / "Solicitar"). La opción B MUST rotularse gratuita "por ahora", en coherencia con la pregunta frecuente vigente.
- **FR-010**: Ambas opciones MUST aclarar que el perfil se revisa antes de publicarse.
- **FR-011**: MUST incluir una sección **"Tu panel"** que muestre únicamente lo que el panel de marca ofrece hoy (resumen de prendas y looks, borradores, estado de aprobación del perfil, conexión con Instagram, espacio usado). Si se quiere mostrar clics hacia la tienda o el WhatsApp de la marca, esa parte MUST rotularse "Próximamente", porque hoy la marca no ve esa métrica.
- **FR-012**: MUST incluir una sección que explique el recorrido **tu publicación → tu página o tu WhatsApp**: cada prenda etiquetada lleva a la tienda o al WhatsApp de la marca, y Icon registra los clics.
- **FR-013**: MUST incluir una ilustración de la demanda ("Quiero algo para…") que muestre a la marca que la gente busca por necesidad y no por marca.
- **FR-014**: MUST incluir cierre con botón "Únete ya" y pie con contacto por WhatsApp.

**Landing de personas** (`/`)

- **FR-015**: MUST incluir "Busca todo lo que necesites" (búsqueda y filtros por ocasión, ciudad, precio y estilo) y "Guarda todos tus gustos para después" (guardar, dar like y seguir marcas), ambas funciones existentes.
- **FR-016**: MUST incluir una ilustración de intención ("Necesito un … para …") y una respuesta con una prenda, para enseñar que se busca por necesidad.
- **FR-017**: Las secciones **"Comparte tu estilo"** (perfil público, `iconcolombia.com/me`; Fase 1 del roadmap) y **"Escribe reseñas"** (Fase 2) MUST aparecer en el diseño, en el lugar que les da el boceto, pero rotuladas **"Próximamente"** y sin botones ni enlaces que lleven a una función inexistente (el "Crea tu cuenta" de esa zona lleva al registro, que sí existe). Cumple FR-008.
- **FR-018**: MUST incluir "Postula una marca" con un formulario corto (ver FR-023).
- **FR-019**: MUST cerrar con "Mejora tu estilo con ropa de tu ciudad" y un botón, nombrando únicamente las ciudades donde Icon opera (Barranquilla, Medellín, Bogotá).

**Prueba social**

- **FR-020**: Los contadores (marcas, publicaciones, personas) MUST mostrar valores reales y solo cuando alcancen un mínimo creíble que el equipo defina; por debajo del mínimo MUST ocultarse sin dejar huecos. Los contadores MUST NOT exponer datos individuales de nadie.
- **FR-021**: La franja de logos MUST mostrar solo marcas activas y publicadas, y ocultarse si no hay ninguna.

**Captura de interés**

- **FR-022**: La **solicitud de subida asistida** (marca) MUST pedir como máximo seis datos: nombre de la marca, nombre de contacto, un canal de contacto (WhatsApp o correo), enlace a su tienda o Instagram, ciudad y, opcional, un mensaje; MUST pedir la aceptación explícita del tratamiento de datos con un aviso consultable desde el formulario.
- **FR-023**: La **postulación de marca** (persona) MUST pedir solo el nombre de la marca y su enlace o Instagram; la ciudad, un mensaje y el contacto de quien postula son opcionales; si se deja contacto, MUST pedir la aceptación del tratamiento de datos.
- **FR-024**: Cada envío exitoso MUST mostrar una confirmación inmediata que diga qué sigue. Para la **solicitud de subida asistida** el compromiso es **el mismo día hábil**, por el canal que dejó la marca: "Recibimos tu solicitud. Te escribimos hoy mismo por WhatsApp o correo (el que nos dejaste). Si nos escribes fuera de horario o en fin de semana, te respondemos el siguiente día hábil." Para la **postulación de marca**, la confirmación agradece y explica que el equipo la revisa (sin plazo).
- **FR-025**: Los errores de validación MUST estar en español, junto al campo afectado, sin borrar lo escrito. Un doble envío MUST producir un solo registro.
- **FR-026**: Todo envío MUST guardarse y ser consultable por el equipo autorizado, con tipo, datos, fecha y origen (landing y campaña). El público MUST NOT poder ver lo enviado por otras personas.
- **FR-027**: El formulario MUST resistir envíos automatizados o masivos sin exigir pasos molestos a personas reales.
- **FR-028**: MUST guardarse solo los datos mínimos necesarios y nada que no se haya pedido.

**Analítica**

- **FR-029**: Por cada landing MUST medirse: visitas, origen de la visita (campaña), clics en cada botón (cuál y en qué sección) y envíos de cada formulario (éxito o error).
- **FR-030**: Los eventos de medición MUST NOT contener datos personales (nombre, correo, teléfono, contenido de mensajes).
- **FR-031**: Una falla de la medición MUST NOT afectar la navegación ni los formularios.
- **FR-032**: La medición MUST poder verificarse antes de publicar: el equipo debe poder comprobar que cada evento llega.

**Diseño y calidad**

- **FR-033**: Las landings MUST usar el sistema visual existente de Icon (estética glass/tropical, su paleta y sus componentes compartidos). Cualquier elemento visual nuevo —por ejemplo, la tipografía del wordmark ICON— se incorpora al sistema compartido; no se crea un sistema visual paralelo.
- **FR-034**: MUST funcionar en móvil desde 360 px de ancho, sin desplazamiento horizontal, con botones y campos cómodos de tocar.
- **FR-035**: Todo el texto visible MUST estar en español con lenguaje inclusivo ("persona", "quien…", sin asumir género).
- **FR-036**: MUST cumplir criterios básicos de accesibilidad: contraste suficiente, uso completo con teclado, foco visible, texto alternativo en imágenes y animaciones que respeten la preferencia de reducir movimiento.
- **FR-037**: Al compartir el enlace de cada landing, MUST mostrarse un título, una descripción y una imagen propios y distintos para `/` y `/marcas`.
- **FR-038**: Ambas landings MUST poder ser encontradas por los buscadores y mostrar su contenido principal sin depender de que cargue código adicional.

### Key Entities *(include if feature involves data)*

- **Solicitud de subida asistida**: una marca pide que Icon cargue su catálogo. Atributos: nombre de la marca, nombre y canal de contacto, enlace a tienda o Instagram, ciudad, mensaje opcional, fecha, origen (landing/campaña) y consentimiento aceptado.
- **Postulación de marca**: una persona recomienda una marca que quiere ver en Icon. Atributos: nombre de la marca, enlace o Instagram, ciudad y mensaje opcionales, contacto de quien postula (opcional, con consentimiento), fecha, origen. Varias postulaciones de la misma marca se pueden agrupar.
- **Evento de medición**: acción registrada en una landing (visita, clic en botón, envío de formulario). Atributos: landing, sección o botón, resultado, origen de campaña. Nunca contiene datos personales.
- **Cifras públicas**: totales agregados (marcas activas, publicaciones, personas registradas) usados solo para prueba social; no identifican a nadie.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En una prueba con 5 personas de cada audiencia (quienes llevan una marca y quienes compran ropa) que miran su landing 5 segundos en el celular, al menos 4 de 5 saben decir qué es Icon y qué harían a continuación.
- **SC-002**: La propuesta de valor y el botón principal son visibles sin desplazarse en el 100 % de los tamaños de pantalla de prueba (360×640 y 1366×768).
- **SC-003**: Una marca completa la solicitud de subida asistida en menos de 2 minutos desde que llega a la landing.
- **SC-004**: El 100 % de las solicitudes y postulaciones de prueba (incluyendo doble clic y conexión intermitente) llegan al equipo, consultables y sin duplicados.
- **SC-005**: Durante los 7 primeros días tras publicar, el equipo puede responder sin pedir datos a nadie más: visitas por landing, porcentaje que pulsó el botón principal, formularios enviados y origen de las visitas.
- **SC-006**: El contenido principal de cada landing aparece en menos de 3 segundos en una conexión móvil 4G típica.
- **SC-007**: Cero promesas sin respaldo: en una revisión contra el producto, el 100 % de las funciones mostradas existen hoy o están rotuladas "Próximamente".
- **SC-008**: Ninguna landing tiene fallas críticas de accesibilidad (contraste, teclado, foco) en la revisión previa a publicar.
- **SC-009**: *(objetivo propuesto; el equipo lo confirma o ajusta)* En las primeras 4 semanas tras publicar, llegan al menos 5 solicitudes o postulaciones de marcas reales a través de las landings.

## Assumptions

- **Rutas**: `/` pasa a ser la landing de personas (su contenido para marcas se traslada a `/marcas`) y `/marcas` es nueva. Ambas son públicas y se enlazan entre sí.
- **Destinos de los botones**: se reutilizan los destinos existentes (crear cuenta de persona, crear cuenta de marca con el tipo preseleccionado, explorar el feed, panel de marca). Esta spec no cambia el registro.
- **Opción B "Nosotros"**: se apoya en la capacidad ya entregada de importar el catálogo de una marca desde el panel de carga masiva (spec 001). Requiere que el equipo pueda atender las solicitudes; ese es un compromiso operativo, no técnico.
- **"Gratis"**: se comunica como "por ahora", igual que la pregunta frecuente vigente; no se promete gratuidad permanente.
- **Wordmark y motivos**: el wordmark ICON en grande, el arco sobre los tres pasos y las líneas que convergen en un horizonte vienen del boceto. La maqueta propone una tipografía de exhibición para el wordmark que evoque la "I" con serifas del favicon; es una decisión de marca por confirmar en el plan.
- **Prueba social**: las cifras salen de datos reales ya públicos por diseño (marcas activas y contenido publicado); el umbral mínimo para mostrarlas lo fija el equipo en el plan. El perfil de cada marca ya es público en el feed, así que mostrar su logo no revela nada nuevo.
- **Tratamiento de datos**: capturar contactos exige un aviso de tratamiento de datos publicado y accesible. **Dependencia**: confirmar con quien lleve lo legal el texto y los requisitos de la normativa colombiana de protección de datos personales (Ley 1581 de 2012) antes de publicar.
- **URL pública sin credenciales**: los entornos de revisión de la plataforma de despliegue pueden estar protegidos por inicio de sesión. **Dependencia**: decidir antes de publicar si las landings se revisan desde el dominio público de producción o si se desactiva esa protección para las vistas previas.
- **Medición**: ya existe medición básica de visitas. Los eventos personalizados (clics, envíos) dependen de lo que permita el plan de la herramienta actual; el plan de implementación decide si basta o si hace falta otra.
- **Confirmación**: sin correo transaccional (Fase 2), la confirmación de un envío es solo en pantalla.
- **Panel de marca**: no incluye hoy métricas de clics hacia la tienda o el WhatsApp. Si el equipo quiere que "Tu panel" lo muestre como gancho, es una feature aparte (no está en esta spec).
- **Idioma y tono**: español inclusivo en todo el texto visible, según el principio VII de la constitución.
