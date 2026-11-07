# GIRA — radar personal de conciertos, giras, preventas y grandes eventos

Proyecto personal del propietario (habla español; responder siempre en español). Sustituye a un
"cook group" de pago (Akari, ~75 €/mes) **solo en la parte de información**: qué sale, cuándo,
dónde registrarse y cómo entrar en cada preventa, con un único objetivo: **conseguir entradas para
conciertos y eventos de todo el mundo**. El propietario vive en **Madrid**. Coste objetivo: 0 €.

**Fuera de alcance:** planificar viajes, buscar vuelos, hoteles o precios de transporte. GIRA solo
trata de los eventos y de cómo conseguir las entradas.

## Límites (no negociables)

- Solo información. **Nada** de compra automática, bots de checkout, saltar colas, compartir
  pases/enlaces con `queueittoken`, cookies o cuentas, ni bypass de antibots.
- Nunca subir claves al repo (es **público**). Todas viven en GitHub Secrets / Cloudflare.
- Leer webs sin API con moderación (cada 15–30 min, solo fichas de evento) y respetando bloqueos.
- No usar las cookies/sesiones personales del propietario en ninguna red social.

## Salidas

1. **App iPhone (PWA) "GIRA"** instalable desde Safari con notificaciones push — salida principal.
   **Privada, solo para el propietario**: registro una vez con passkey (Face ID) y sesión recordada
   (~1 año) para no volver a identificarse. Nunca pública ni indexable.
2. **Servidor de Discord "GIRA"** (ID `1568641743853715516`) montado por el bot con categorías:
   INICIO · CALENDARIO (#daily-release, #esta-semana, #recordatorios) · ALERTAS (#nuevas-giras,
   #fechas-extra, #preventas, #registros-abiertos) · GIRAS (foro `fichas`) · POR REGIÓN ·
   NOTICIAS · TICKETERAS · DEPORTES · ARCHIVO. **Nunca un canal por artista ni por concierto**: la
   información se recopila en canales temáticos; cada gira con fechas futuras tiene una publicación
   en el foro `fichas` que, al pasar su última fecha, se resume en `#archivo` y se borra. **Solo
   eventos futuros** (nada de historial pasado). La PWA guarda todo sin límite.
3. **Calendario `.ics`** suscribible.

**Horas de silencio:** 01:00–08:00 Europe/Madrid. Solo se notifica en ese tramo si es urgente
(preventa o venta en < 1 h, sala de espera abierta, fecha extra de un artista seguido).

## Arquitectura

- **Cloudflare Workers** (cron cada 5 min): monitor Ticketmaster, push web, endpoint de
  interacciones de Discord (slash commands). D1 (BD), KV, R2, Queues, Workers AI, AI Gateway,
  Browser Run, Vectorize. Cuenta `61fba2a15c66bf4a4a86477a4d74c51e`.
- **GitHub Actions** (repo público → minutos ilimitados): noticias, ticketeras sin API, Apify,
  resúmenes y fichas con IA. Los lanza el Worker (`workflow_dispatch`) para que sean puntuales.
- Resúmenes 21:00 y 08:00 Europe/Madrid: alarmas del Durable Object "Reloj" del Worker.
- KV solo como caché de lectura (el plan gratuito permite 1.000 escrituras/día).
- **Cloudflare Pages**: la PWA.
- IA con fallback en este orden: Groq → Gemini → Workers AI → NVIDIA → OpenAI (de pago, último).

## Fuentes

- Ticketmaster Discovery API (núcleo, 20+ países). Clave = Consumer Key.
- Ticketeras sin API (revisar ficha de evento): AXS, Eventim/Fansale/TicketOne, Blueticket,
  See Tickets, Dice, Fnac, eTicketing, Vivaticket, Ticketportal, Puntoticket, LaLiga/clubes…
- Noticias (Google News RSS, NME, Billboard, Los40, Mondosonoro…), feeds RSS de YouTube.
- Redes vía **Apify** (plan FREE: 5 $/mes de crédito, medido el 2026-11-07; dosificar): `apify/instagram-scraper`,
  `clockworks/tiktok-scraper`, el mejor scraper de X mantenido. Meta Business Discovery como
  respaldo oficial para Instagram.
- Popularidad: Last.fm + Deezer (Spotify exige Premium, descartado).

## Qué vigilar

- **Cobertura por fases:** 1) Europa (incl. Reino Unido) → 2) EE. UU. → 3) Latinoamérica →
  4) Australia → 5) Asia. No empezar una región hasta que la anterior funcione bien.
- ~100 artistas de referencia (semilla en `data/artists.seed.json` cuando exista; plan maestro en `docs/plan/00-LEEME.md`): U2, Harry Styles, Oasis, Bad Bunny,
  Metallica, The Weeknd, Bruno Mars, Sabrina Carpenter, Olivia Rodrigo, Ariana Grande, Shakira,
  Springsteen, Foo Fighters, Guns N' Roses, Radiohead, BTS, Twice, aespa, Quevedo, Raye,
  Olivia Dean, Noah Kahan, Tate McRae, Charli XCX, Celine Dion, Morgan Wallen… + **descubrimiento
  automático** de cualquier gira de estadios/arenas con mucha popularidad.
- Festivales: Tomorrowland, Glastonbury, Primavera Sound, Mad Cool, BBK, Coachella…
- Deporte de alta demanda: F1, LaLiga y otras ligas, finales UCL/UEL/UECL, Eurocopa, JJOO LA 2028,
  NFL/NBA internacional, Wimbledon/RG/US Open, UFC, boxeo top, dardos PDC, Euroleague, LoL Worlds.

## Formato de referencia (lo que publicaba Akari)

Ficha de gira: límite de entradas, precios por zona, aforo, popularidad, enlaces por ticketera y
fecha/ciudad, calendario de preventas en orden (Fan club, álbum, VISA, Amex, O2, operadoras,
artist presale, venta general) con hora de España y Reino Unido, qué hace falta en cada una
(registro, código, tarjeta, email), fechas extra, avisos de sala de espera y de stock.

**Estimación de precios (solo informativa, sin reventa):** para cada evento y sección/zona,
precio oficial (face value) y **rango estimado de reventa** (mín.–máx., multiplicador sobre el
oficial) calculado con un modelo propio: demanda (popularidad Last.fm/Deezer, ruido en noticias y
redes, nº de fechas y fechas extra, aforo, velocidad de agotado), tipo de sección (pista/GA, Inner
Circle/Red Zone, gradas por anillo) y país. Mostrar siempre como estimación con nivel de
confianza; sirve para saber lo difícil/caro que será si no se consigue en la venta oficial.
Además, **leer (solo lectura, vía Apify, con poca frecuencia) los precios publicados en Viagogo y
StubHub** por sección como dato de mercado. Son precios *pedidos*, no ventas: filtrar anuncios
absurdos con estadística robusta (mediana y percentiles P25–P75 por sección, descartar valores
fuera de ~3×IQR y los que no se mueven en días) en vez de un tope fijo, porque en eventos como una
final del Mundial 10.000 € puede ser lo normal. Mostrar: oficial · mercado (mediana, P25–P75) ·
estimación del modelo · confianza.

## Secrets (GitHub → Settings → Secrets and variables → Actions)

`TICKETMASTER_API_KEY`, `DISCORD_BOT_TOKEN`, `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY`,
`GROQ_API_KEY`, `GEMINI_API_KEY`, `NVIDIA_API_KEY`, `OPENAI_API_KEY`, `FIRECRAWL_API_KEY`,
`APIFY_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `LASTFM_API_KEY`,
`FOOTBALL_DATA_API_KEY`. **Reddit: NO usar** (ni API, ni Apify, ni RSS, ni scraping). Su política
exige aprobación previa y prohíbe extraer datos o usar varias cuentas. Solo se activará si llegan
`REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET` aprobados oficialmente.
Setlist.fm descartado. Fuentes sin clave: Deezer, MusicBrainz, Wikidata, Jolpica (F1),
Nager.Date (festivos), Nominatim/OSM, Google News RSS, RSS de YouTube.
Verificar todas con el workflow `Verificar claves` (`.github/workflows/verify-secrets.yml`).
Comprobar cuáles faltan antes de depender de ellos; nunca pedirlos por chat.

## Forma de trabajar

- Plugins activos en la cuenta: Superpowers (plan → TDD → revisión), Cloudflare, Apify,
  frontend-design, playwright, Design, Security Guidance, context7, pr-review-toolkit.
- Skills del repo en `.claude/skills/` (ver `THIRD_PARTY.md`): karpathy-guidelines,
  ui-ux-pro-max, design-taste-frontend, `mp-*` de Matt Pocock. Las skills propias de GIRA llevarán
  prefijo `gira-`.
- MCP del proyecto en `.mcp.json`: servidor oficial de Apify (`mcp.apify.com`). El token NO va en
  el repo: lo inyecta el proxy del entorno `COOKGROUP` (secretos de red para `api.apify.com` y
  `mcp.apify.com`). Si Apify responde 401 en sesión, el secreto de red falta o caducó.
- Orden de entregas acordado: R0 → R1 → R2 → R4 (España) → R3 (PWA) → R5 → R6 → R7. Ejecución
  "Native" (Claude implementa; revisión de rama completa al final de cada entrega). Ver
  `docs/plan/09-roadmap.md`.
- Rama de trabajo: la que indique la sesión (ahora `claude/magical-franklin-u415fe`).
