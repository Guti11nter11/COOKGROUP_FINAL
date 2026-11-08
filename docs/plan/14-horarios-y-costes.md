# 14 · Horarios y costes (decisiones del 8 de noviembre de 2026)

## Horario (hora de Madrid)

| Franja | Barrido de Ticketmaster | Por qué |
|---|---|---|
| 00:00–08:00 | nada | No salen preventas de Europa ni EE. UU. (Asia/Australia, más adelante) |
| 08:00–08:30 | cada 15 min | Calentamiento antes de la hora punta |
| 08:30–14:30 | **cada 10 min** | Preventas de Europa y Reino Unido (sobre todo 09:00–12:00, algunas 13:00–14:00) |
| 14:30–16:00 | cada 15 min | Transición |
| 16:00–21:30 | **cada 10 min** | Preventas de EE. UU. (fase 2) y anuncios de tarde |
| 21:30–24:00 | cada 30 min | Repaso del día |

Recordatorios (24 h, 1 h, 10 min) y resúmenes (21:00, 08:00) siguen siempre en hora: solo leen la
base de datos y no cuestan nada.

Trabajos de GitHub, lanzados por el Worker a horas fijas (nunca de madrugada):

| Trabajo | Horas | Al día |
|---|---|---|
| Catálogo de Ticketmaster | 08:30, 09:30 … 14:30, 16:30, 18:30, 20:30, 22:30 | 11 |
| Noticias | 08:15, 10:15, 12:15, 14:15, 17:15, 20:15 | 6 |
| Enriquecer fichas (aforo, precios, registros, reventa) | 09:00, 13:00, 19:00 | 3 |
| Ticketeras (Entradas.com, Eventim DE, TicketOne IT, See Tickets, AXS) | 10:00 y 20:00 | 2 |
| Blueticket | 11:30 | 1 |

Se configura en `packages/core/src/schedule.ts`.

## Por qué GitHub se saltó pasadas

Los `schedule` de GitHub Actions son "lo mejor que se pueda": en horas de carga GitHub los retrasa o
los descarta sin avisar, y no hay garantía. Esta noche el radar horario corrió una vez en 6 h. Por
eso ahora los lanza el reloj del Worker (Cloudflare, exacto) con `workflow_dispatch` y el secreto
`GH_DISPATCH_TOKEN`. Ese secreto lo creaste ayer al preparar las claves (estaba previsto en el ADR
0001), pero el código que lo usa se añadió esta mañana. Funciona desde las 08:31.

## Costes

| Servicio | Plan | Uso previsto | Coste |
|---|---|---|---|
| Cloudflare (Worker, D1, colas, Browser Run) | gratis | ~300 ejecuciones/día de 100.000; Browser Run < 10 min/día | 0 € |
| GitHub Actions | gratis (repo público) | ~25 trabajos/día | 0 € |
| Ticketmaster | gratis | ~400 llamadas/día de 5.000 (antes ~1.300) | 0 € |
| IA (Groq → Gemini) | gratis | ~15 llamadas/día | 0 € |
| Apify (reventa StubHub + Blueticket) | de pago por uso | ~0,05–0,30 $/día; **tope 1 $/día** | ≤ 30 $/mes, normalmente < 5 $ |

Los 1,44 $ de ayer fueron el primer día: pruebas de los lectores de StubHub y el primer análisis de
reventa. Hoy: 0,01 $. Cada artista se vuelve a muestrear como mucho una vez por semana.

Comparado con Akari (~75 €/mes), GIRA queda por debajo de 5 €/mes en uso normal y nunca por encima
de 1 $ al día.
