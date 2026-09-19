# TODO — camino al primer MVP con marcas y usuarios reales

**Objetivo de esta lista:** no es "construir más features" — es llegar al punto en que se pueda poner
Icon en frente de marcas independientes reales y de usuarios reales, y sacar feedback antes de seguir
construyendo. Todo lo que no sirva directamente a eso se queda fuera a propósito.

Marcado `[ ]` pendiente, `[x]` hecho. Cuando termines algo, muévelo a "Hecho" con la fecha — así el
historial de qué se decidió no se pierde en el chat del equipo.

## Bloqueadores reales — sin esto no se puede lanzar

- [x] **Producción funciona** (verificado 2026-09-09): `/feed` en `https://icon-iota-two.vercel.app`
      carga y sirve contenido real. En una revisión anterior (principios de septiembre) devolvía
      `TypeError: fetch failed`, probablemente por el proyecto de Supabase pausado por inactividad —
      ya no es el caso. Si vuelve a pasar (plan gratuito de Supabase pausa proyectos sin tráfico),
      reactivar desde el dashboard de Supabase.
- [ ] **Confirmación de email.** Si `Confirm email` sigue activo en Supabase Auth, una marca o usuario
      que se registre no puede entrar hasta clickear un correo que puede no leer. Para el piloto,
      apagarlo (Authentication → Providers → Email) baja la fricción de entrada a cero.
- [x] **Cuentas de staff en la nube confirmadas** (verificado 2026-09-09): hay 2 usuarios con
      `role` en (`admin`, `curator`) sobre 5 usuarios totales en la nube — el equipo sí puede entrar a
      `/admin` en producción para seguir cargando contenido.

## Antes de invitar a la primera marca

El piloto probablemente empieza con 3-5 marcas cargadas manualmente por el equipo (así funciona hoy:
MVP curado). Lo mínimo para que eso no se sienta roto:

- [ ] **Catálogo real cargado.** Ahora mismo la nube tiene 3 marcas / 9 prendas / 3 posts — apenas
      alcanza para probar que la app funciona, no para que un usuario sienta que hay algo que explorar.
      Meta razonable para el piloto: **8-10 marcas, 5-8 prendas cada una, 2-3 posts por marca** (usar
      `/admin/bulk` para la carga de prendas, ya soporta plantilla `.xlsx`).
- [ ] **Confirmar que el flujo completo de una marca se ve bien de punta a punta**: `/marca/[slug]` →
      sus prendas → clic en "comprar" → llega al `product_url` real de la marca (no un placeholder) y
      el clic queda registrado en `outbound_clicks`. Si el `product_url` está vacío o roto para alguna
      prenda cargada, la marca lo va a notar de inmediato.
- [ ] **Página de error 404 decente para `/marca/[slug]` y `/prenda/[id]` con id inválido.** Hoy no
      existen `not-found.tsx` (estaba despriorizado porque "esperaba diseño concreto del UI" — para
      un piloto, aunque sea genérico, es mejor que la página en blanco/error crudo de Next).

## Próxima iniciativa (decidida): catálogo de marca vía Instagram API

Decisión de producto: adelantar lo que hasta ahora estaba en "fuera de alcance" — que una marca cargue
**su propio catálogo** conectando su cuenta de Instagram, en vez de depender de que el equipo lo cargue
a mano en `/admin`. Esto no bloquea el piloto (que sigue arrancando con MVP curado), pero es la iniciativa
que sigue después. La dejo con el detalle técnico de una vez porque tiene piezas no triviales:

- [ ] **Vincular `users` ↔ `brand`.** Hoy no existe (`users.brand_id` no existe, ni una tabla de
      membresía). Decidir el modelo: `brands.owner_user_id` ya existe en el esquema pero no se usa —
      puede que alcance con una relación 1:1 marca-dueño para el primer corte, o si varias personas de
      una marca necesitan acceso, una tabla `brand_members (user_id, brand_id, role)`.
- [ ] **Rol/capability "marca" + RLS nuevo.** Cada marca solo debe poder ver/editar lo suyo — esto es
      RLS nuevo sobre `brands`, `garments`, `garment_images`, `posts`, no una extensión de `is_staff()`.
      Repasar el patrón de policies + GRANT de `20260614120000_init.sql` como plantilla.
- [ ] **Elegir la vía de la API de Instagram.** Meta retiró la Instagram Basic Display API (dic. 2024);
      hoy el camino es la **Instagram Platform vía Graph API** (Instagram Login o Facebook Login), que
      exige que la marca tenga cuenta de Instagram **Business o Creator** (no personal). Definir cuál de
      los dos flujos de login conviene antes de escribir código de integración.
- [ ] **Meta App Review.** Los permisos para leer media de una cuenta ajena (`instagram_business_basic`
      y similares) requieren revisión de la app por parte de Meta — esto puede tardar días a semanas.
      **Meter la solicitud de review al inicio del desarrollo**, no al final, para que no sea el cuello
      de botella final del feature.
- [ ] **Flujo de conexión y ciclo de vida del token.** Pantalla en `/settings` (o una nueva `/marca/panel`)
      donde la marca autoriza Icon vía OAuth de Instagram. El access token de larga duración expira a los
      ~60 días y necesita refresh antes de vencer — sin esto, el catálogo de una marca deja de
      sincronizar en silencio dos meses después de conectarla. Guardar el token solo server-side, nunca
      en un campo expuesto al cliente.
- [ ] **Resolver el hueco real: Instagram da fotos y caption, no precio/talla/categoría/`product_url`.**
      Este es el punto que puede parecer "solo conectar la API" pero no lo es — una foto importada de
      Instagram no trae nada de lo que hace útil el catálogo de Icon (filtrar por precio, talla, ciudad).
      Decidir para el primer corte: ¿la marca completa esos campos a mano por cada foto importada antes
      de publicar (fricción baja pero manual), o se explora extracción asistida por IA más adelante
      (conecta con la idea de "catalogación con visión" ya planteada para el pitch)? Para este feature,
      recomiendo empezar con completar a mano — es mucho menos trabajo que construir visión por
      computadora, y ya reduce la fricción real (la marca ya no arranca desde cero, solo completa datos
      sobre fotos que ya tiene).
- [ ] **Moderación de lo importado.** Decidir si el contenido que trae la marca desde Instagram entra
      como `pending`/`draft` para que el equipo lo revise antes de publicar, o se publica directo y se
      audita después. La tabla `post_brand_reviews` ya existe en el esquema (sin uso hoy) — vale la pena
      evaluar si sirve para este flujo de moderación en vez de construir una tabla nueva.
- [ ] **Manejar la desconexión y el token revocado con gracia en la UI.** Si la marca revoca el acceso
      desde Instagram (no desde Icon), la próxima sincronización va a fallar — el panel de la marca debe
      mostrar "reconectar tu Instagram" en vez de fallar en silencio o mostrar un error crudo.

## Antes de invitar a los primeros usuarios

- [ ] **Onboarding probado de principio a fin en un dispositivo real (celular).** Es la primera
      impresión de cualquier usuario nuevo — vale la pena un pase manual completo: signup → onboarding
      (ciudad + estilos) → feed, en un iPhone/Android real, no solo en el simulador de Chrome.
- [ ] **Decidir qué pasa con Google OAuth para el piloto.** Está cableado en el código
      (`google-button.tsx`, `/auth/callback`) pero deshabilitado por falta de credenciales
      (`enabled = false` en `supabase/config.toml`). Dos caminos: (a) conseguir las credenciales de
      Google Cloud y activarlo antes del piloto — baja fricción de registro, o (b) aceptar que el
      piloto arranca solo con email+password y dejarlo para después. Cualquiera de las dos es válida;
      lo que no vale es dejarlo a medias con el botón visible pero roto — si se decide (b), ocultar el
      botón de Google en `/login` y `/signup` hasta que esté listo.
- [ ] **Un mecanismo para recibir feedback dentro de la app.** No hace falta nada elaborado — un link
      "mailto:" o a un formulario de Google en el footer/settings alcanza para el piloto. Sin esto,
      el feedback que buscamos con este lanzamiento no tiene dónde aterrizar.
- [ ] **Revisar el copy en español en las páginas de error del navegador (login/signup) para casos
      comunes**: contraseña incorrecta, correo ya registrado, correo con formato inválido. Un mensaje
      de error en inglés o genérico de Supabase rompe la sensación de producto terminado.

## Nice-to-have para el piloto, no bloqueante

Estas ayudan pero no impiden lanzar — hacerlas si sobra tiempo antes de invitar gente:

- [ ] **Analítica básica de qué está pasando durante el piloto**: `/admin` ya tiene métricas y clics
      salientes por marca/prenda — confirmar que se puede leer sin fricción (quien sea dueño de la marca o quien dé
      seguimiento al piloto debería poder abrir `/admin` una vez al día y entender qué se está usando).
- [ ] **Dominio propio para las imágenes.** Hoy se sirven desde `pub-*.r2.dev`, que tiene rate limit.
      Con el tráfico de un piloto chico probablemente no se nota, pero si el piloto crece es la primera
      pared con la que se choca.
- [ ] **Paginación del feed.** `post_feed.select("*")` no tiene límite — funciona bien con catálogo
      chico (que es justo el estado del piloto), se vuelve un problema si el catálogo crece rápido
      después de que las marcas empiecen a cargar contenido con feedback positivo.

## Deliberadamente fuera de esta lista

Para que quede explícito qué NO estamos haciendo ahora y por qué — si alguien propone retomarlo antes
de tener feedback del piloto, esta es la razón para decir "todavía no":

- **Reviews/UGC.** La tabla `post_brand_reviews` existe pero no tiene interfaz. No sirve para validar
  la hipótesis central (¿la gente encuentra y compra ropa colombiana independiente por intención?).
  **Corrección (2026-09-09):** esto se mantiene fuera de alcance — a diferencia de "perfiles de marca
  con acceso propio" (que se movió arriba a "Próxima iniciativa", ya no está fuera de alcance), reviews
  sigue explícitamente pospuesto hasta después del piloto.
- **PWA instalable** (faltan íconos PNG 192/512 y service worker). Cosmético para un piloto que se usa
  desde el navegador.
- **Búsqueda semántica cross-idioma** (pgvector/embeddings). La búsqueda actual por trigram ya resuelve
  acentos, plurales y errores de tipeo — suficiente para el volumen de catálogo de un piloto.

## Hecho

*(mover ítems aquí con fecha al completarlos, para que el equipo vea el progreso sin escarbar el chat)*
