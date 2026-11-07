# GIRA · Plan maestro

Plan completo para construir GIRA, el radar personal de conciertos, giras, preventas y grandes
eventos. **Estado: planificación. Aún no hay código de producto.** Fecha: 2026-11-07.

## Resumen en 1 minuto

- **Todo listo para empezar**: las 14 claves funcionan; Cloudflare tiene permisos para Workers,
  D1, Pages, KV, Queues, Durable Objects, Vectorize, Workers AI, AI Gateway y Browser Run.
- **Del propietario**: subdominio `workers.dev` ✅ hecho. Pendiente: activar **Comunidad** en
  Discord, token fino de GitHub (`GH_DISPATCH_TOKEN`) y renovar el secreto de red de Apify. R2 se
  deja sin activar (no es imprescindible).
- **Hallazgo más importante**: Ticketmaster trae casi todas las preventas de Reino Unido/Irlanda
  pero **casi ninguna de España** (3 de 200 eventos) y **nada de Francia ni Portugal**. En España
  la información de preventas sale de la **prensa, Live Nation ES y las promotoras** → la lectura
  de noticias con IA es pieza central de la Fase 1.
- **Apify es 5 $/mes, no 10 $** (plan FREE medido).
- **Ticketmaster admite varios artistas por llamada** → se pueden vigilar ~100 artistas cada 5–20
  min usando la mitad de la cuota diaria.
- **8 entregas** hasta Europa completa (~18–21 sesiones). La primera ("Primer pitido") ya manda
  avisos reales a Discord y tiene plan paso a paso.

## Documentos

| # | Documento | Qué contiene |
|---|---|---|
| 01 | [Auditoría](01-auditoria.md) | Repo, claves, permisos finos, cuotas reales, calidad de datos por país, qué falta |
| 02 | [Objetivo](02-objetivo.md) | Frase objetivo, persona, trabajos que hace GIRA, principios, métricas, regla de cambio de fase |
| 03 | [Story map](03-story-map.md) | Recorrido del propietario × 8 entregas |
| 04 | [Relatos e historias](04-historias.md) | 7 escenas de uso + ~60 historias con criterios de aceptación |
| 05 | [Arquitectura](05-arquitectura.md) | Componentes, dos relojes, flujo señal→aviso, presupuesto de cuotas, IA, seguridad, estructura del repo |
| 06 | [Modelo de datos](06-modelo-datos.md) | Tablas D1 y tipos de preventa normalizados |
| 07 | [Dashboards](07-dashboards.md) | 7 pantallas de la PWA, panel de salud, servidor de Discord, resumen diario |
| 08 | [Ideas innovadoras](08-ideas.md) | 22 ideas con valor/esfuerzo; las 5 que cambian el juego |
| 09 | [Roadmap](09-roadmap.md) | Entregas, estimación, definición de hecho, forma de trabajar |
| 10 | [Riesgos y revisiones](10-riesgos-y-revisiones.md) | 13 riesgos, revisión contra el brief y contra lo pedido, ajustes propuestos |
| — | [Glosario](../GLOSARIO.md) | Vocabulario del dominio |
| — | [Plan R0+R1 paso a paso](../superpowers/plans/2026-11-07-gira-r0-r1.md) | 10 tareas TDD listas para ejecutar |

## Decisiones tomadas (2026-11-07)

1. Orden: **R4 (España) antes que R3 (app)**.
2. Ajustes al brief **aceptados** (Apify 5 $, fichas en foro, resúmenes por el Reloj, KV solo
   caché, R4 imprescindible, Francia/Portugal con fuentes propias).
3. Discord: **nunca un canal por artista o concierto**; canales temáticos + fichas temporales +
   `#archivo`; solo eventos futuros. La app guarda todo.
4. Ejecución en modo **Native**.
5. Niveles ⭐⭐⭐: por defecto los 26 artistas del brief.
6. Dominio `cyclevoltlogistics.com`: disponible pero **aplazado** (su DNS y correo están en
   Squarespace/Google; moverlo tiene riesgo y no es necesario para empezar).
