# 10 · Riesgos y revisiones del plan

## Riesgos

| # | Riesgo | Prob. | Impacto | Mitigación | Señal de alarma |
|---|---|---|---|---|---|
| R-1 | Ticketmaster trae pocas preventas en España (medido: 3 de 200) | **Cierta** | Alto | R4 (prensa + Live Nation ES + promotoras) es parte del núcleo, no un extra | Cobertura ES < 90 % en el diario |
| R-2 | 10 ms de CPU del Worker gratis no bastan para parsear Ticketmaster | Media | Alto | Páginas de 50, consultas por artista, reparto en Queues, normalizar en `core` con código simple; medir el primer día | `exceededCpu` en logs |
| R-3 | La IA inventa o confunde horas/fechas | Media | **Muy alto** | Cita literal obligatoria + validador determinista + casos de oro; nunca aviso urgente desde una afirmación solo-IA sin fuente oficial o 2 fuentes | Avisos marcados "esto está mal" |
| R-4 | Cuota diaria de Ticketmaster (5.000) | Media | Medio | Contador con freno, rotación por nivel ⭐, lotes de artistas por llamada si la API lo permite | `quota_usage` > 80 % |
| R-5 | Webs bloquean la lectura (403/429) | Alta | Medio | Respetar, retroceso exponencial, apagado automático y aviso; usar APIs y prensa | Fuente en rojo en el panel |
| R-6 | Apify 5 $/mes se queda corto; actores de reventa frágiles | Alta | Bajo | Solo top 30 y eventos calientes; corte al 70 %; probar actores con presupuesto cerrado | Gasto > 3 $ antes del día 20 |
| R-7 | Push en iOS falla en silencio (suscripción caducada) | Media | Alto | Discord y `.ics` como canales redundantes; prueba diaria de push; renovar suscripción al abrir la app | Sin entregas push en 24 h |
| R-8 | Ruido: demasiados avisos y el propietario deja de mirarlos | Media | Alto | Niveles ⭐, resumen 21:00/08:00, métricas de ruido, 👍/👎 | > 6 push/día |
| R-9 | Cambios de condiciones de uso de una fuente | Baja | Medio | Revisar trimestralmente; cada fuente con interruptor `enabled` | — |
| R-10 | Repo público expone algo sensible | Baja | Alto | Nunca secretos; logs solo con recuentos; `run_secret_scanning`; códigos de preventa cifrados y fuera del repo | — |
| R-11 | Discord: límites de canales y eventos | Media | Bajo | Foro con hilos; eventos programados solo para ⭐⭐⭐ (máx. 100) | — |
| R-12 | GitHub desactiva crons tras 60 días | Alta a largo plazo | Medio | Workflows disparados por el Worker (`workflow_dispatch`), cron de Actions solo como respaldo | Workflow "disabled" |
| R-13 | Duplicados de Ticketmaster (p. ej. "Hombres G … \| VIP Packages" como evento aparte) | **Cierta** | Medio | Agrupar por (recinto, fecha local, artista) y tratar paquetes VIP como variante, no como fecha extra | Fechas extra falsas |

## Revisión 1 — contra el brief (`CLAUDE.md`)

| Requisito del brief | Dónde queda cubierto | Estado |
|---|---|---|
| Solo información, nada de compra/bots/colas | Principios (02), Modo Drop sin acciones, ideas descartadas (08) | ✅ |
| Nunca claves en el repo | Arquitectura §6, R-10 | ✅ |
| Lectura moderada 15–30 min, solo fichas, respetar bloqueos | H-87, H-63, R-5 | ✅ |
| Sin cookies/sesiones personales en redes | No-objetivos (02), cartera solo booleanos | ✅ |
| PWA iPhone privada, passkey, sesión ~1 año, no indexable | H-85, arquitectura §6 | ✅ |
| Servidor Discord con las categorías indicadas | 07 (estructura) | ✅ con un cambio: **GIRAS como foro** en vez de un canal por gira (límite de 500 canales). Requiere activar Comunidad (A2) |
| `.ics` suscribible | H-43 | ✅ |
| Horas de silencio 01–08 y reglas de urgencia | H-44, H-82, relato A2 | ✅ |
| Cloudflare Workers cron 5 min, D1, KV, R2, Queues, AI, Gateway, Browser Run, Vectorize | 05 | ✅ salvo **R2 no activado** (A3) y KV limitado a caché |
| GitHub Actions para lo pesado; resumen 21:00 | 05 §2 | ✅ **ajuste**: el resumen lo programa el Reloj del Worker; Actions se dispara desde el Worker |
| IA con fallback Groq → Gemini → Workers AI → NVIDIA → OpenAI | 05 §5 | ✅ |
| Fuentes (TM, ticketeras sin API, noticias, YouTube, Apify, Last.fm, Deezer) | 01 §5, R4–R7 | ✅ |
| Fases por región, no empezar sin terminar la anterior | 02 (regla de cambio de fase), 09 | ✅ con criterio medible |
| ~100 artistas + descubrimiento automático | H-10, H-07 | ✅ (falta la lista completa en `data/`, se crea en R1) |
| Festivales y deporte de alta demanda | R5 (modo festival), R6 | ✅ |
| Formato de ficha Akari | 07 P3 | ✅ ampliado |
| Estimación de precios y lectura de Viagogo/StubHub con estadística robusta | H-61, H-62, 07 P3 | ✅ |
| Reddit no | No-objetivos | ✅ |
| Fuera de alcance: viajes | No-objetivos; el mapa de giras (idea 15) solo muestra dónde caen las fechas | ✅ |
| Coste 0 € | Presupuesto de cuotas (05 §4) | ✅ salvo dominio opcional (idea 19), marcado como opcional |

## Revisión 2 — lo que se había pedido en la conversación

| Petición | Respuesta |
|---|---|
| Analizar todo lo que tenemos | 01 · Auditoría (repo, 14 claves, permisos finos de Cloudflare, Discord, fuentes sin clave, calidad real de datos por país) |
| Planificación y desarrollo para el objetivo | 02 · Objetivo · 05 · Arquitectura · 09 · Roadmap · plan paso a paso de R0+R1 |
| Un mapping | 03 · Story map |
| Diferentes story tellings / user stories | 04 · 7 relatos + ~60 historias con criterios |
| Análisis | 01 (hallazgos medidos) y 10 (riesgos) |
| Dashboards | 07 · 7 pantallas de la PWA, panel de salud, Discord, resumen diario |
| Reajustar, detallar, mejorar | Ajustes al brief marcados abajo |
| Diseñar con ideas innovadoras | 08 · 22 ideas con valor/esfuerzo |
| Revisar de nuevo lo que queríamos | Esta sección |
| Qué APIs y permisos tenemos, si falta alguno | 01 §2–§7 (acciones A1–A8) |
| No elaborar todavía, solo plantear | No se ha escrito código de producto; solo documentos y la ampliación del workflow de verificación |

## Ajustes propuestos al brief (pendientes de que el propietario los acepte)

1. Apify: **5 $/mes**, no 10 $ (medido).
2. GIRAS en Discord como **foro** (un hilo por gira), no un canal por gira.
3. Resúmenes programados por el **Reloj** (Durable Object) del Worker, no por el cron de Actions.
4. KV solo como caché de lectura (1.000 escrituras/día).
5. R4 (fuentes españolas) es **imprescindible** para la Fase 1, no un añadido.
6. Francia y Portugal requieren fuentes propias (Ticketmaster Discovery devuelve 0 eventos).
