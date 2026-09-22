# Icon — Roadmap por fases

> Cada fase tiene un objetivo de producto y un criterio de salida.
> No se pasa a la siguiente hasta cumplir el criterio — no por tiempo, sino por señal.
>
> **Escala objetivo del MVP:** 10 marcas · 100 usuarios.

---

## Fase 0 — Fundación: marca completa + usuario básico

**Objetivo:** que una marca pueda registrarse, armar su catálogo y publicar contenido completo.
Que un usuario pueda registrarse e interactuar con ese contenido. El perfil público de usuario
(storefront) no entra en esta fase.

### Flujo de marca

- [ ] **Registro de marca con cola de aprobación:** al crear cuenta, el usuario elige ser marca o
      usuario regular. Si elige marca, completa su perfil (nombre, bio, ciudad, foto de portada,
      link a sitio/WhatsApp) y sube al menos un post inicial durante el registro. El perfil completo
      entra a una cola de aprobación — la marca no es visible en el feed hasta que un admin apruebe
      su cuenta. Una vez aprobada, sus posts futuros se publican sin revisión individual.
      *(La marca ve el resultado — pendiente / rechazada con nota / activa — en el banner de su
      panel. El aviso por correo se difirió: ver "Correo transaccional" en la Fase 2.)*
- [ ] Catálogo de productos: creación manual (título, precio, talla, categoría, foto, link de compra
      — sitio web o WhatsApp) y carga masiva por plantilla `.xlsx`.
- [ ] Creación de post de outfit: subir foto, escribir caption, etiquetar **al menos un producto**
      del catálogo propio. Sin producto etiquetado no se puede publicar.
- [ ] **Importación desde Instagram:** la marca conecta su cuenta Business/Creator vía OAuth,
      importa fotos como `draft` y completa precio, talla, categoría y link antes de publicar.
      (Implementación existente — esta fase es prueba e integración con el registro.)
      Access token almacenado solo server-side con refresh automático antes de los ~60 días.
      Si la marca revoca el acceso, el panel muestra "reconectar Instagram" en vez de fallar.
- [ ] Seguimiento de clics salientes (`outbound_clicks`) cada vez que alguien hace clic en
      "comprar" desde un post o producto de la marca.

### Flujo de usuario

- [ ] Registro y onboarding (ciudad + estilos preferidos).
- [ ] Guardar (favoritos) posts y productos de marcas.
- [ ] Seguir marcas.
- [ ] Dar like a posts y prendas.

### Flujo de búsqueda y feed

- [ ] Feed principal: masonry de posts de marcas y usuarios, ordenado por score
      (popularidad + recencia).
- [ ] Filtros: ocasión, ciudad, precio, estilo, categoría.
- [ ] Búsqueda por texto en prendas, posts y marcas (trigram + unaccent, ya implementado).
- [ ] Tab de búsqueda: Prendas · Outfits · Marcas.

### Flujo de admin

- [ ] Panel admin: cargar y editar marcas, prendas y posts en nombre de una marca que no lo haga.
- [ ] **Cola de aprobación de marcas:** ver perfiles de marca en `pending`, aprobar o rechazar
      con nota opcional. La aprobación activa la marca y hace visible todo su contenido inicial.
- [ ] Métricas: clics salientes por marca y prenda, usuarios activos, posts publicados.
- [ ] Carga masiva de prendas (`.xlsx`): ya implementado en `/admin/bulk`.

### Infraestructura de esta fase

- [ ] Cuotas de almacenamiento en R2: 50 MB por cuenta de usuario, 300 MB por cuenta de marca.
      Upload falla con mensaje claro al alcanzar el límite.
- [ ] Pipeline de imagen: resize a máx. 1200px + WebP 85% con `sharp` antes de subir a R2.
- [ ] shadcn/ui integrado como librería de componentes base.
- [ ] Mensajes de error en español para login/signup (contraseña incorrecta, correo ya registrado, etc.).
- [ ] Páginas 404 mínimas para rutas con ID inválido (`/marca/[slug]`, `/prenda/[id]`, `/post/[id]`).

**Criterio de salida:** 3 marcas registradas, aprobadas por admin, con catálogo real y al menos
1 post publicado cada una. 5 usuarios reales (no del equipo) con cuenta activa que hayan guardado
o dado like a al menos 1 post. Al menos 1 clic saliente a tienda registrado.

---

## Fase 1 — Usuarios como creadores de contenido

**Objetivo:** que los usuarios puedan publicar sus propios outfits, etiquetar marcas de la plataforma
y tener un perfil público con su contenido (storefront).

- [ ] **Publicar outfit:** el usuario sube foto, escribe caption y etiqueta marcas o productos
      de la plataforma. Los posts de usuarios se publican sin moderación previa.
- [ ] **Storefront de usuario:** página pública con los outfits del usuario, visible sin cuenta.
- [ ] Estadísticas básicas en el perfil: outfits publicados, marcas que sigue, seguidores.
- [ ] Seguir otros usuarios (además de marcas).
- [ ] Opción de perfil privado (el storefront no es visible sin seguir al usuario).

**Criterio de salida:** al menos 10 usuarios han publicado ≥1 outfit con una marca etiquetada.
Al menos 3 marcas han recibido tráfico desde un outfit de usuario.

---

## Fase 2 — Comunidad y confianza

**Objetivo:** que los usuarios sean una razón para volver a Icon, no solo las marcas.

- [ ] **Reseñas de productos:** los usuarios pueden escribir una reseña de un producto que compraron
      (puntuación + texto). Las reseñas son visibles en la página del producto.
- [ ] Notificaciones básicas: alguien guardó tu post, alguien te siguió, tu reseña fue publicada.
- [ ] **Correo transaccional** (diferido desde el registro de marcas): avisar por correo a la marca
      cuando su perfil es aprobado ("¡Tu marca fue aprobada en Icon!", con link al panel) o rechazado
      ("Tu solicitud en Icon necesita ajustes", con la nota del equipo y link para editar). Además,
      sirve de base para las notificaciones de arriba.
      **Prerrequisito: dominio propio** con SPF/DKIM verificados; sin él, los correos desde una
      dirección tipo Gmail caen en spam o son rechazados por DMARC.
      Ya hay una implementación probada en local (nodemailer + SMTP, plantillas en español,
      envío solo al dueño de la marca, aviso en la cola si el envío falla) en el commit `60c6d4e`
      (`src/lib/email.ts`, `src/lib/brand-emails.ts`, `reviewBrand()` en `src/app/admin/actions.ts`);
      se retiró de la rama principal del feature. Las RPC `approve_brand`/`reject_brand` ya devuelven
      el correo del dueño y el nombre de la marca para este uso. Proveedor sugerido: Resend (con
      dominio) o Brevo; usar también el mismo SMTP en Supabase Auth.
- [ ] Sistema de reporte de contenido (posts o reseñas que violan las normas de la comunidad).
- [ ] Feed personalizado: posts de marcas y usuarios que sigo, priorizados sobre el feed general.

**Criterio de salida:** al menos 20 reseñas publicadas. Al menos 50% de los usuarios activos
vuelven al feed en la semana siguiente a su registro.

---

## Fase 3 — Monetización

**Objetivo:** que Icon sea sostenible financieramente con su base de usuarios y marcas.

Los modelos de monetización se diseñan con datos reales del piloto, no con supuestos previos.
Candidatos:

- **Referidos:** comisión por venta atribuible a un clic saliente desde Icon (requiere integración
  con sistemas de la marca — no trivial).
- **Membresía por volumen:** cuentas que superen un umbral de posts o almacenamiento pasan a un
  plan de pago. El umbral y el precio se definen con los datos de uso de las fases anteriores.
- **Visibilidad premium para marcas:** aparecer destacado en el feed o en búsquedas relevantes.

**Criterio de entrada a esta fase:** métricas de retención y engagement del piloto que justifiquen
que los usuarios y marcas pagarían por el acceso.

---

## Fuera de alcance hasta nueva decisión explícita

- **PWA instalable** — falta íconos PNG 192/512 y service worker; cosmético para el piloto.
- **Búsqueda semántica** (pgvector/embeddings) — el trigram actual cubre el MVP; se añade si
  el volumen de catálogo lo justifica.
- **Dominio propio para imágenes** — `pub-*.r2.dev` tiene rate limit; se nota solo con tráfico alto.
- **Paginación del feed** — `post_feed.select("*")` sin límite es aceptable con el catálogo del piloto.
- **Procesar pagos o inventario** — Icon conecta, no vende.
- **Expandir fuera de Colombia** — primero profundidad en el nicho, luego amplitud geográfica.
