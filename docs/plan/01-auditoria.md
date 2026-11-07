# 01 · Auditoría: qué tenemos, qué funciona, qué falta

Fecha de la auditoría: **2026-11-07**. Todo lo marcado como ✅/❌ se comprobó en vivo con el
workflow `Verificar claves` (ejecuciones 4 y 7) o desde la sesión. Lo marcado como 📄 sale de
documentación oficial y está pendiente de medir en uso real.

## 1. Estado del repositorio

| Elemento | Estado |
|---|---|
| Código de producto | **No existe todavía.** Solo hay brief (`CLAUDE.md`), skills vendorizadas y el workflow de verificación. |
| `CLAUDE.md` | Brief completo y coherente: objetivo, límites, salidas, arquitectura, fuentes, secretos. |
| `.github/workflows/verify-secrets.yml` | Funciona. Ampliado hoy con un paso informativo de permisos finos, cuotas y calidad de datos. |
| `.mcp.json` | Servidor MCP de Apify configurado. En esta sesión **no** expone herramientas (ver §4). |
| Skills | `karpathy-guidelines`, `ui-ux-pro-max`, `design-taste-frontend`, `mp-*` (revisadas, sin hooks). |
| Ramas | `claude/vigilant-euler-pkmop0` (rama por defecto) y `claude/magical-franklin-u415fe` (esta). Mismo contenido salvo este plan y la ampliación del workflow. |

## 2. Claves (GitHub Secrets): 14/14 válidas

| Servicio | Estado | Cuota / plan real medido | Uso previsto |
|---|---|---|---|
| Ticketmaster Discovery | ✅ 200 | 5.000 llamadas/día, 5/s (cabecera `Rate-Limit-Available`: 4.970 tras las pruebas) | Núcleo de eventos y preventas |
| Discord bot | ✅ 200, en el servidor GIRA, **con Administrador** | — | Montar el servidor, publicar, slash commands |
| Discord APPLICATION_ID / PUBLIC_KEY | ✅ coinciden con el bot | — | Verificar firmas de interacciones |
| Groq | ✅ | Modelos: `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`, `whisper-large-v3(-turbo)` | IA nivel 1 (extracción rápida) |
| Gemini | ✅ | `gemini-3.x-flash(-lite)`, `gemini-2.5-pro`, `gemini-3.1-pro-preview`, modelos TTS | IA nivel 2, contexto largo, **TTS para el resumen en audio** |
| NVIDIA | ✅ | — | IA nivel 4 |
| OpenAI | ✅ | De pago | Último recurso |
| Firecrawl | ✅ | **1.400 créditos** restantes | Páginas difíciles, puntual |
| Apify | ✅ (en Actions) | **Plan FREE: 5 $/mes de crédito** (no 10 $), tope de gasto 10 $ | Redes y mercado secundario, muy dosificado |
| Cloudflare token | ✅ | Ver §3 | Toda la plataforma |
| Last.fm | ✅ | — | Popularidad |
| football-data.org | ✅ | 10 peticiones/min; 13 competiciones: `PD, PL, CL, EC, WC, BL1, SA, FL1, DED, PPL, ELC, BSA, CLI` | Fútbol |

> ⚠️ **Corrección al brief:** `CLAUDE.md` dice "crédito gratuito 10 $/mes" para Apify. El plan real
> es **FREE con 5 $/mes**. El tope de 10 $ es el límite de gasto configurado, no crédito incluido.

## 3. Cloudflare: permisos por producto

| Producto | Estado | Límite plan gratuito 📄 | Consecuencia de diseño |
|---|---|---|---|
| Workers (scripts) | ✅ | 100k peticiones/día · **10 ms de CPU** por invocación · 50 subpeticiones · **5 cron triggers por cuenta** | El Worker hace trabajo ligero; lo pesado va a Actions o se trocea con Queues |
| D1 | ✅ | 5 M filas leídas/día · 100k escritas/día · 500 MB por BD | BD principal |
| Pages | ✅ | — | PWA |
| KV | ✅ | 100k lecturas/día · **solo 1.000 escrituras/día** | KV **solo** para caché de lectura (feed, `.ics`), nunca para estado por ciclo |
| Queues | ✅ | 10.000 operaciones/día · retención 24 h | Reparto de trabajo, sin abusar (~3 ops por mensaje) |
| Durable Objects (SQLite) | ✅ | 100k peticiones/día · 100k filas escritas/día | **Reloj de preventas** con alarmas exactas |
| Vectorize | ✅ | — | Búsqueda semántica (Pregunta a GIRA, deduplicar noticias) |
| Workers AI | ✅ catálogo e inferencia | 10.000 neuronas/día (~2,4 M tokens de entrada con Llama 3.1 8B fp8) | IA nivel 3 y embeddings `bge` |
| AI Gateway | ✅ | — | Caché, logs y control de gasto de todos los proveedores de IA |
| Browser Run | ✅ (`/content` respondió 200) | **10 min/día**, 3 navegadores, 1 petición cada 10 s | Solo para fichas que no se leen sin JS |
| **R2** | ❌ `10042: Please enable R2 through the Cloudflare Dashboard` | 10 GB | **Acción del propietario**, o prescindir de R2 (ver §6) |
| **Subdominio workers.dev** | ❌ `10007: You do not have a workers.dev subdomain` | — | **Acción del propietario**: abrir *Workers & Pages* una vez en el panel |

## 4. Discord: estado del servidor GIRA

- Servidor prácticamente vacío: **4 canales** (2 categorías por defecto, 1 texto, 1 voz).
- **Features: ninguna** → el servidor **no es Comunidad**. Sin Comunidad no hay canales de
  anuncios (los que se pueden "seguir").
- **Interactions endpoint: sin configurar.** Slash commands registrados: **0**.
- Permiso para eventos programados: ✅ (útil para la idea de "eventos de Discord por preventa").

## 5. Fuentes sin clave (comprobadas desde la sesión)

| Fuente | Estado | Nota |
|---|---|---|
| Deezer API | ✅ | `nb_fan` por artista (Sabrina Carpenter: 1,84 M) y charts |
| MusicBrainz | ✅ | MBID como identificador canónico de artista (exige User-Agent propio y 1 req/s) |
| Wikidata | ✅ | IDs cruzados (Spotify, Deezer, MusicBrainz, redes oficiales) |
| Jolpica (F1) | ✅ | Calendario 2027 aún vacío (0 carreras): normal en noviembre |
| Nager.Date | ✅ | Festivos |
| Nominatim | ✅ | Geocodificar recintos (1 req/s, caché obligatoria) |
| Google News RSS | ✅ | **Fuente estrella para España**: hoy devuelve "U2 Barcelona y Sevilla 2027: cuándo sale la preventa", Noah Kahan en Sevilla, Scorpions, BBK Live… |
| YouTube RSS | ✅ | Incluye `<media:statistics views>`: popularidad gratis |
| Live Nation ES / UK | ✅ HTML accesible | Embebe un **catálogo de tipos de preventa** (p. ej. "Registro", "Preventa Banco Santander Mastercard") |
| Dice | ✅ | `ld+json` y `__NEXT_DATA__` |
| ticketmaster.es, See Tickets, AXS, Viagogo, StubHub, Bandsintown | 🚫 403 a lectura directa | Solo vía API oficial, Apify o Browser Run, y respetando bloqueos |

## 6. Hallazgo crítico: la cobertura de Ticketmaster en Europa es desigual

Muestra de 200 eventos de música por país (próximas fechas):

| País | Eventos totales | Con preventas | Con precios | Con límite de entradas |
|---|---|---|---|---|
| 🇬🇧 GB | 9.946 | 64 | 0 | 92 |
| 🇮🇪 IE | 1.199 | 84 | 0 | 179 |
| 🇩🇪 DE | 1.112 | 40 | 0 | 0 |
| 🇪🇸 **ES** | 1.110 | **3** | **0** | **0** |
| 🇳🇱 NL | 854 | 7 | 0 | 0 |
| 🇧🇪 BE | 678 | 2 | 0 | 0 |
| 🇮🇹 IT | 438 | 0 | 0 | 0 |
| 🇫🇷 **FR** | **0** | — | — | — |
| 🇵🇹 **PT** | **0** | — | — | — |
| 🇺🇸 US | 10.000+ | 59 | 44 | 63 |
| 🇲🇽 MX | 574 | 80 | 0 | 200 |
| 🇦🇺 AU | 1.361 | 44 | 0 | 47 |

Tipos de preventa más vistos en la API: *Artist Presale, Ticketmaster Presale, Preventa Banamex,
Spotify Presale, MCD Presale, Live Nation Presale, Venue Presale, **Priority from O2**, Telekom Prio
Tickets, PayPal Prio Tickets, Three+ Presale, Promoter Presale, Citi, Mastercard*.

**Conclusiones:**

1. Para **Reino Unido/Irlanda** Ticketmaster es casi suficiente (preventas y límites de entradas).
2. Para **España** Ticketmaster da el evento pero **casi nunca la preventa ni el precio**. La
   información de preventas en España sale de **prensa** (Los40, EuropaFM, El Mundo, Time Out…),
   **Live Nation ES**, promotoras (Doctor Music, Last Tour, Madness Live, Planet Events…) y redes
   del artista. Eso convierte la **extracción con IA de noticias y fichas** en pieza central de la
   Fase 1, no en un extra.
3. **Francia y Portugal no existen en la Discovery API** → ticketeras propias (Ticketmaster FR es
   otro sistema, Blueticket/Ticketline en PT).
4. **Precios oficiales fuera de EE. UU.**: salen de prensa y fichas, no de la API. El modelo de
   precios tiene que tolerar que falte el oficial.
5. El filtro `onsaleStartDateTime` devolvió ventas antiguas: no fiarse de él; calcular las
   ventanas próximas en nuestra BD a partir de `sales.public` y `sales.presales`.
6. **`attractionId` acepta varios IDs separados por comas** (medido: U2 24 + Oasis 44 + Metallica
   50 = 118 eventos, idéntico a una sola llamada con los tres). Con ~100 artistas y ~30 fechas
   cada uno salen ~15 páginas de 200 por barrido completo. Presupuesto: barrido de los ⭐⭐⭐ cada
   5 min (~5 páginas → ~1.440 llamadas/día) + barrido completo cada 20 min (~1.080/día) ≈ **2.500
   llamadas/día**, la mitad de la cuota.
7. Ticketmaster publica **duplicados comerciales** ("Hombres G … | VIP Packages" como evento
   aparte de la misma fecha). Hay que agruparlos como variante para no generar fechas extra falsas.
8. IDs de ejemplo resueltos: U2 `K8vZ91712W7`, Oasis `K8vZ9171fw7`, Metallica `K8vZ9171G9V`.

## 7. Permisos y piezas que faltan (acciones del propietario)

| # | Qué | Por qué | Bloquea | Coste |
|---|---|---|---|---|
| A1 | ✅ **Hecho** (2026-11-07): subdominio `eleven-snk-11.workers.dev` | Crea el subdominio `workers.dev` | — | 0 € |
| A2 | Activar Comunidad en el servidor de Discord (Ajustes → Habilitar Comunidad) | Los **canales de anuncios y los foros** solo existen en servidores Comunidad | El foro "giras" y #daily-release como anuncios | 0 € |
| A3 | Decidir sobre **R2** (activarlo en el panel; puede pedir tarjeta aunque tenga capa gratuita) | Guardar HTML crudo y capturas | Nada crítico: sin R2 se guarda un extracto en D1 | 0 € dentro de la capa gratuita |
| A4 | Crear un **token fino de GitHub** (*fine-grained*, solo este repo, permiso *Actions: write*) y guardarlo como **GitHub Secret** `GH_DISPATCH_TOKEN` (el despliegue lo copia al Worker) | Que Cloudflare dispare los workflows a la hora exacta (ver arquitectura) | Puntualidad de los trabajos pesados | 0 € |
| A5 | Arreglar el **secreto de red de Apify** del entorno `COOKGROUP` | En esta sesión `api.apify.com` responde 401 y el MCP de Apify no carga | Solo el trabajo interactivo de Claude con Apify; en Actions funciona | 0 € |
| A6 | Tener **iOS 16.4+** (mejor 18.4+) y añadir GIRA a la pantalla de inicio | Push web en iPhone solo funciona instalada | Notificaciones push | 0 € |
| A7 | *(Opcional, aplazado)* Dominio `cyclevoltlogistics.com` (ya comprado): hoy usa DNS de Squarespace y correo de Google Workspace (MX `smtp.google.com`) | Email Routing exigiría pasar los DNS a Cloudflare sin romper ese correo; la app puede ir en `*.pages.dev` | Solo el "buzón de preventas" | 0 € (dominio ya pagado) |
| A8 | *(Opcional)* Meta Business Discovery (cuenta profesional de IG + app de Meta) | Respaldo oficial de Instagram | Nada: Apify cubre | 0 € |

Secretos nuevos que **genera el propio sistema** (no hay que pedirlos): claves VAPID para push,
secreto de firma de sesiones, ID del RP de passkeys.

## 8. Riesgos detectados en la auditoría

- **10 ms de CPU por invocación** en Workers gratis: parsear 200 eventos de Ticketmaster puede
  pasarse. Mitigar con páginas pequeñas, consultas por artista y reparto en Queues; medir el
  primer día.
- **KV 1.000 escrituras/día**: un cron cada 5 min que escriba 4 claves ya gasta 1.152. Prohibido
  usar KV para estado de ciclo.
- **Cron de GitHub Actions**: se retrasa 5–30 min en horas punta y **se desactiva tras 60 días**
  sin actividad en repos públicos. No usarlo para nada urgente.
- **Apify 5 $/mes**: los actores de Viagogo/StubHub tienen 1–9 usuarios al mes (frágiles). Hay
  que probarlos con presupuesto cerrado antes de depender de ellos.
- **Discord**: 500 canales por servidor y 50 por categoría. "Un canal por gira" choca con el
  límite en cuanto haya más de ~40 giras activas → usar **foro** (cada gira es un hilo y los
  hilos no cuentan para el límite de canales).

## 9. Dónde se publican las preventas en España (medido el 2026-11-07)

Barrido de Google News (búsquedas de "preventa", "registro preventa", "cuándo salen a la venta"…,
últimos 30–90 días) contando qué webs publican los artículos:

| Fuente | Artículos | Feed propio | Uso en GIRA |
|---|---|---|---|
| **blog.ticketmaster.es** (blog oficial de Ticketmaster España) | 8 | ✅ RSS (`/feed/`) | **Fuente oficial**: anuncia giras y explica preventas (hoy: U2, Noah Kahan, NFL Madrid) |
| europafm.com | 24 | — (vía Google News) | "Dónde registrarse para la preventa" |
| los40.com | 24 | — (403 directo; vía Google News) | Códigos, horarios y precios de preventas |
| modofestival.es | 7 | ✅ RSS | Precios por zona, abonos, agotados |
| conciertospormadrid.com | 4 | ✅ RSS | "Cómo acceder a la preventa" en Madrid |
| mondosonoro.com · mercadeopop.com | — | ✅ RSS | Anuncios y precios |
| elpais.com · elmundo.es · abc.es · lavanguardia.com · cadenaser.com · elconfidencial.com · 20minutos.es · cadena100.es | 3–6 c/u | — | Confirmaciones y horas de venta |
| livenation.es | — | HTML (Next.js) | Tipos de preventa oficiales (Santander Mastercard, Registro…) |
| Clubes de fútbol (realsporting.com, rccelta.es, cordobacf.com…) | 3–6 | — | Ventas de entradas de LaLiga (R6) |

Conclusión: la estrategia de R4 es **Google News RSS por artista + RSS directos** (blog de
Ticketmaster España, Modo Festival, Conciertos por Madrid, Mondo Sonoro, Mercadeo Pop) **+ Live
Nation ES**, con extracción por IA con cita literal. Casi todo el contenido útil es legible sin
saltarse nada.

## 10. Francia, Portugal y ticketeras sin API

| Mercado / ticketera | Qué es | Lectura desde servidor | Plan |
|---|---|---|---|
| **Ticketmaster Francia** | Sistema propio heredado de **Ticketnet** (comprado por Live Nation en 2010); no está en Discovery API (0 eventos) | 403 | Prensa francesa (Google News FR) + **Live Nation FR** (legible, con Queue-it en picos) + actor de Apify `ticketmaster-fr-es-scraper` solo si hace falta |
| **Portugal** | No hay Ticketmaster PT. Líder **MEO Blueticket**, luego **Ticketline**, **BOL** y See Tickets (CTS Eventim). Promotora clave: **Everything is New**. En Portugal la reventa por encima del precio facial está prohibida | Blueticket redirige a una **sala de espera Queue-it** (no se toca); Ticketline no responde; **BOL** legible con `ld+json`; Everything is New y Live Nation PT legibles | Prensa portuguesa (Google News PT) + BOL + promotoras; nunca entrar en la cola de Blueticket |
| **Eventim / Entradas.com / TicketOne / Fansale** | Grupo CTS Eventim (Entradas.com = Eventim España) | Sin respuesta desde centros de datos (bloqueo) | Prensa + Apify/Browser Run solo para fichas concretas, con moderación |
| **AXS** | O2 Arena, Wembley… en UK | 403 | Prensa y Ticketmaster/LN cuando revenden lo mismo; Browser Run puntual |
| **See Tickets** | UK, FR, PT | 403 | Prensa |
| **Dice** | Salas medianas, festivales | ✅ `ld+json` + Next.js | Lectura directa de fichas |
| **Fever, Wegow, Taquilla.com** | ES | ✅ con `ld+json` | Lectura directa de fichas |
| **El Corte Inglés entradas** | ES | 403 | Prensa |

Fuentes: Ticketnet/Live Nation ([FrenchWeb](https://www.frenchweb.fr/ticketnet-rachete-par-lamericain-live-nation-entertainment/7389)),
mercado portugués ([IQ International Ticketing Report 2025](https://www.iqmagazine.com/publications/international-ticketing-report-2025/portugal/)).
