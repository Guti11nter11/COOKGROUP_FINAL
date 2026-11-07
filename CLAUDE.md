# GIRA — radar personal de conciertos, giras, preventas y grandes eventos

Proyecto personal del propietario (habla español; responder siempre en español). Sustituye a un
"cook group" de pago (Akari, ~75 €/mes) **solo en la parte de información**: qué sale, cuándo,
dónde registrarse y cómo entrar en cada preventa, para **viajar a conciertos y eventos de todo el
mundo**. Coste objetivo: 0 € (todo en planes gratuitos).

## Límites (no negociables)

- Solo información. **Nada** de compra automática, bots de checkout, saltar colas, compartir
  pases/enlaces con `queueittoken`, cookies o cuentas, ni bypass de antibots.
- Nunca subir claves al repo (es **público**). Todas viven en GitHub Secrets / Cloudflare.
- Leer webs sin API con moderación (cada 15–30 min, solo fichas de evento) y respetando bloqueos.
- No usar las cookies/sesiones personales del propietario en ninguna red social.

## Salidas

1. **App iPhone (PWA)** instalable desde Safari con notificaciones push — salida principal.
2. **Servidor de Discord "GIRA"** (ID `1568641743853715516`) montado por el bot con categorías:
   INICIO · CALENDARIO (#daily-release, #esta-semana, #recordatorios) · ALERTAS (#nuevas-giras,
   #fechas-extra, #preventas, #registros-abiertos) · GIRAS (un canal por gira) · POR REGIÓN ·
   NOTICIAS · TICKETERAS · VIAJES · DEPORTES.
3. **Calendario `.ics`** suscribible.

## Arquitectura

- **Cloudflare Workers** (cron cada 5 min): monitor Ticketmaster, push web, endpoint de
  interacciones de Discord (slash commands). D1 (BD), KV, R2, Queues, Workers AI, AI Gateway,
  Browser Run, Vectorize. Cuenta `61fba2a15c66bf4a4a86477a4d74c51e`.
- **GitHub Actions** (repo público → minutos ilimitados): noticias, ticketeras sin API, Apify,
  resúmenes y fichas con IA, resumen diario 21:00 Europe/Madrid.
- **Cloudflare Pages**: la PWA.
- IA con fallback en este orden: Groq → Gemini → Workers AI → NVIDIA → OpenAI (de pago, último).

## Fuentes

- Ticketmaster Discovery API (núcleo, 20+ países). Clave = Consumer Key.
- Ticketeras sin API (revisar ficha de evento): AXS, Eventim/Fansale/TicketOne, Blueticket,
  See Tickets, Dice, Fnac, eTicketing, Vivaticket, Ticketportal, Puntoticket, LaLiga/clubes…
- Noticias (Google News RSS, NME, Billboard, Los40, Mondosonoro…), Reddit, feeds RSS de YouTube.
- Redes vía **Apify** (crédito gratuito ~5 $/mes, dosificar): `apify/instagram-scraper`,
  `clockworks/tiktok-scraper`, el mejor scraper de X mantenido. Meta Business Discovery como
  respaldo oficial para Instagram.
- Popularidad: Last.fm + Deezer (Spotify exige Premium, descartado).

## Qué vigilar

- ~100 artistas de referencia (ver `docs/` cuando exista): U2, Harry Styles, Oasis, Bad Bunny,
  Metallica, The Weeknd, Bruno Mars, Sabrina Carpenter, Olivia Rodrigo, Ariana Grande, Shakira,
  Springsteen, Foo Fighters, Guns N' Roses, Radiohead, BTS, Twice, aespa, Quevedo, Raye,
  Olivia Dean, Noah Kahan, Tate McRae, Charli XCX, Celine Dion, Morgan Wallen… + **descubrimiento
  automático** de cualquier gira de estadios/arenas con mucha popularidad.
- Festivales: Tomorrowland, Glastonbury, Primavera Sound, Mad Cool, BBK, Coachella…
- Deporte de alta demanda: F1, LaLiga y otras ligas, finales UCL/UEL/UECL, Eurocopa, JJOO LA 2028,
  NFL/NBA internacional, Wimbledon/RG/US Open, UFC, boxeo top, dardos PDC, Euroleague, LoL Worlds.

## Formato de referencia (lo que publicaba Akari, versión para viajar)

Ficha de gira: límite de entradas, precios por zona, aforo, popularidad, enlaces por ticketera y
fecha/ciudad, calendario de preventas en orden (Fan club, álbum, VISA, Amex, O2, operadoras,
artist presale, venta general) con hora de España y Reino Unido, qué hace falta en cada una
(registro, código, tarjeta, email), fechas extra, avisos de sala de espera y de stock. Sustituir
los consejos de reventa por consejos de viaje.

## Secrets (GitHub → Settings → Secrets and variables → Actions)

`TICKETMASTER_API_KEY`, `DISCORD_BOT_TOKEN`, `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY`,
`GROQ_API_KEY`, `GEMINI_API_KEY`, `NVIDIA_API_KEY`, `OPENAI_API_KEY`, `FIRECRAWL_API_KEY`,
`APIFY_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `LASTFM_API_KEY` (opcional).
Comprobar cuáles faltan antes de depender de ellos; nunca pedirlos por chat.

## Forma de trabajar

- Plugins activos en la cuenta: Superpowers (plan → TDD → revisión), Cloudflare, Apify,
  frontend-design, playwright, Design, Security Guidance, context7, pr-review-toolkit.
- Skills del repo en `.claude/skills/` (ver `THIRD_PARTY.md`): karpathy-guidelines,
  ui-ux-pro-max, design-taste-frontend, `mp-*` de Matt Pocock. Las skills propias de GIRA llevarán
  prefijo `gira-`.
- Rama de trabajo: `claude/vigilant-euler-pkmop0`.
