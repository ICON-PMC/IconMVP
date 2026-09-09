# TODO — camino al primer MVP con marcas y usuarias reales

**Objetivo de esta lista:** no es "construir más features" — es llegar al punto en que se pueda poner
Icon en frente de marcas independientes reales y de usuarias reales, y sacar feedback antes de seguir
construyendo. Todo lo que no sirva directamente a eso se queda fuera a propósito.

Marcado `[ ]` pendiente, `[x]` hecho. Cuando termines algo, muévelo a "Hecho" con la fecha — así el
historial de qué se decidió no se pierde en el chat del equipo.

## Bloqueadores reales — sin esto no se puede lanzar

- [x] **Producción funciona** (verificado 2026-09-09): `/feed` en `https://icon-iota-two.vercel.app`
      carga y sirve contenido real. En una revisión anterior (principios de septiembre) devolvía
      `TypeError: fetch failed`, probablemente por el proyecto de Supabase pausado por inactividad —
      ya no es el caso. Si vuelve a pasar (plan gratuito de Supabase pausa proyectos sin tráfico),
      reactivar desde el dashboard de Supabase.
- [ ] **Confirmación de email.** Si `Confirm email` sigue activo en Supabase Auth, una marca o usuaria
      que se registre no puede entrar hasta clickear un correo que puede no leer. Para el piloto,
      apagarlo (Authentication → Providers → Email) baja la fricción de entrada a cero.
- [x] **Cuentas de staff en la nube confirmadas** (verificado 2026-09-09): hay 2 usuarias con
      `role` en (`admin`, `curator`) sobre 5 usuarias totales en la nube — el equipo sí puede entrar a
      `/admin` en producción para seguir cargando contenido.

## Antes de invitar a la primera marca

El piloto probablemente empieza con 3-5 marcas cargadas manualmente por el equipo (así funciona hoy:
MVP curado). Lo mínimo para que eso no se sienta roto:

- [ ] **Catálogo real cargado.** Ahora mismo la nube tiene 3 marcas / 9 prendas / 3 posts — apenas
      alcanza para probar que la app funciona, no para que una usuaria sienta que hay algo que explorar.
      Meta razonable para el piloto: **8-10 marcas, 5-8 prendas cada una, 2-3 posts por marca** (usar
      `/admin/bulk` para la carga de prendas, ya soporta plantilla `.xlsx`).
- [ ] **Confirmar que el flujo completo de una marca se ve bien de punta a punta**: `/marca/[slug]` →
      sus prendas → clic en "comprar" → llega al `product_url` real de la marca (no un placeholder) y
      el clic queda registrado en `outbound_clicks`. Si el `product_url` está vacío o roto para alguna
      prenda cargada, la marca lo va a notar de inmediato.
- [ ] **Página de error 404 decente para `/marca/[slug]` y `/prenda/[id]` con id inválido.** Hoy no
      existen `not-found.tsx` (estaba despriorizado porque "esperaba diseño concreto del UI" — para
      un piloto, aunque sea genérico, es mejor que la página en blanco/error crudo de Next).

## Antes de invitar a las primeras usuarias

- [ ] **Onboarding probado de principio a fin en un dispositivo real (celular).** Es la primera
      impresión de cualquier usuaria nueva — vale la pena un pase manual completo: signup → onboarding
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
      salientes por marca/prenda — confirmar que se puede leer sin fricción (la dueña o quien dé
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

- **Perfiles de marca con acceso propio** (que una marca cargue su propio catálogo). Requiere vincular
  `users` ↔ `brand` y RLS nuevo — trabajo real de varios días. El MVP curado (equipo carga todo) es
  suficiente para validar si hay interés antes de construir esto.
- **Reviews/UGC.** La tabla `post_brand_reviews` existe pero no tiene interfaz. No sirve para validar
  la hipótesis central (¿la gente encuentra y compra ropa colombiana independiente por intención?).
- **PWA instalable** (faltan íconos PNG 192/512 y service worker). Cosmético para un piloto que se usa
  desde el navegador.
- **Búsqueda semántica cross-idioma** (pgvector/embeddings). La búsqueda actual por trigram ya resuelve
  acentos, plurales y errores de tipeo — suficiente para el volumen de catálogo de un piloto.

## Hecho

*(mover ítems aquí con fecha al completarlos, para que el equipo vea el progreso sin escarbar el chat)*
