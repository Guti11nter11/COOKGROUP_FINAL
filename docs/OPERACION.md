# Operación de GIRA

Qué corre, cuándo y cómo intervenir. Todo es gratis salvo Apify (tope automático).

## Qué corre y cuándo

| Pieza | Dónde | Frecuencia | Qué hace |
|---|---|---|---|
| Ciclo del Worker | Cloudflare (cron) | cada 5 min | Recordatorios, resúmenes 21:00/08:00, #esta-semana, barrido de Ticketmaster (⭐⭐⭐), fichas y avisos, panel de #estado (cada hora) |
| Radar del catálogo | Actions `feed-radar` | cada hora (:17) | Catálogo completo de Ticketmaster por país; cambios → Worker; descubre giras de alta demanda |
| Enriquecer fichas | Actions `enrich` | cada 3 h (:41) | Aforo, precios oficiales (prensa + IA), registros de la web oficial, reventa |
| Radar de noticias | Actions `news-radar` | cada 2 h (:23) | Prensa de Europa, una noticia por artista y tipo al día |
| Ticketeras sin API | Actions `ticketers` | 09:07 y 19:07 UTC | Entradas.com y See Tickets con Browser Run, por turnos |
| Blueticket | Actions `social` | 10:37 UTC | Instagram oficial de Blueticket (Apify) |
| Mantenimiento D1 | Actions `d1-maintenance` | al subir un `.sql` a `apps/worker/maintenance/` | Ejecuta ese SQL en producción e imprime el resultado |

Los `schedule` de GitHub solo corren en la rama por defecto (`claude/vigilant-euler-pkmop0`):
fusionar ahí cada cambio de los trabajos.

## Tareas habituales

- **Seguir a un artista o evento:** en Discord, `/seguir Nombre` (⭐⭐⭐, sin límite). Dejar: `/dejar Nombre`.
- **Pausar todo lo que publica en Discord:** `DELIVERY_PAUSED: "1"` en `apps/worker/wrangler.jsonc`
  y subir (despliega solo). Los avisos se siguen guardando.
- **Ver el estado:** panel en #estado, o `https://gira-core.eleven-snk-11.workers.dev/health`.
- **Revisar el texto de las fichas activas:** lanzar *Vista previa de fichas* en Actions (solo datos públicos).
- **Añadir un programa de preventa** (cómo entrar): `data/presale-programs.json`.
- **Añadir un registro que ya conoces** (Laylo, Live Nation…): `data/watchlist.json`.
- **Rotar las claves de las notificaciones:** borrar `setting.vapid` (SQL de mantenimiento) y volver a
  activar las notificaciones en el iPhone.

## Reglas que no se tocan

- Solo información: nada de comprar, colas, cookies ni pases (`queueittoken` se descarta siempre).
- Los logs de Actions son públicos: nunca imprimir mensajes del Discord privado, enlaces de alta o
  calendario, tokens ni la tabla `setting` completa.
- Apify: tope de 3 $/mes para reventa y 3,5 $/mes en total; por encima, los trabajos se saltan solos.
- Browser Run: 10 min/día; los trabajos van por turnos para no pasarse.

## Límites del plan gratuito que condicionan el diseño

- Worker: 10 ms de CPU por ejecución → como mucho 8 fichas por pasada y fichas ya renderizadas para la app.
- 50 subpeticiones por ejecución → como mucho 4 artistas con cambios en Discord por pasada.
- Ticketmaster: 5.000 llamadas/día, freno al 80 %.
