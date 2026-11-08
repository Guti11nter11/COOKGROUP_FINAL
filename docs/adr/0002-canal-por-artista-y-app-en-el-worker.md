# ADR 0002 · Canal por artista, reloj en el cron y app servida por el Worker

**Estado:** aceptada (2026-11-08) · **Contexto:** R2, R3, R4 (noche del 7 al 8 de noviembre)

## Contexto

- El propietario pidió **un canal por artista como en Akari**, solo mientras haya ventas por
  llegar (preventa o venta general futura; lo ya lanzado no interesa aunque el concierto sea futuro),
  enlaces agrupados, formato Akari y saber **dónde registrarse** en cada preventa.
- El plan original (ADR 0001) preveía un Durable Object "Reloj" y la PWA en Cloudflare Pages.

## Decisión

1. **Fichas por artista** (`sheet`, `sheet_dirty`): canal `#artista` en 🎤 GIRAS / 🏟️ DEPORTES
   (50 por categoría, numeradas al llenarse) mientras haya alguna venta futura; la ficha se **edita**
   en sitio. Sin ventas por llegar: si GIRA la siguió, el canal va a 📦 ARCHIVO; si nunca la tuvo, se
   borra. Con el servidor cerca de 500 canales se borra el archivado más antiguo.
2. **Avisos agrupados**: uno por artista y pasada, en el canal temático, con enlace a su canal.
3. **Reloj en el cron de 5 min** (no Durable Object): recordatorios T-24 h / T-1 h / T-10 min con
   granularidad de 5 min, resúmenes 21:00 / 08:00 y #esta-semana. Más simple y gratis; si hiciera
   falta precisión de segundos (T-0), se añadirá el DO.
4. **App servida por el propio Worker** (`/app/`, static assets) en vez de Pages: mismo origen que la
   API (sin CORS ni otra cuenta), un único despliegue. Acceso con passkey; alta solo con el código
   publicado en el Discord privado; sesión de 1 año.
5. **Enriquecimiento en GitHub Actions** (`/enrich/todo` → trabajo → `/enrich`): aforo (Wikidata /
   Wikipedia), precios oficiales (Ticketmaster `priceRanges` + prensa con IA y cita literal
   comprobada), registros (web oficial renderizada con Chromium, lista del propietario), reventa
   (StubHub vía Apify con tope de 3 $/mes + prensa + modelo).
6. **Ticketeras sin API** con Cloudflare Browser Run (navegador real, 1 página cada ~10 s, dentro de
   los 10 min/día), solo páginas de búsqueda del artista; nunca colas ni pases.

## Consecuencias

- Discord: ~4 artistas por pasada (límite de 50 subpeticiones); un relleno grande tarda horas.
- Las claves VAPID viven en D1 (no en el repo); rotarlas = borrar `setting.vapid` y volver a activar
  las notificaciones en el iPhone.
- Los precios de prensa pueden faltar o llegar tarde; se muestran siempre con su fuente.
