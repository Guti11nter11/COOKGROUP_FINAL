# Operación de GIRA

Qué corre, cuándo y cómo intervenir. Todo es gratis salvo Apify (tope automático).

## Qué corre y cuándo

| Pieza | Dónde | Frecuencia | Qué hace |
|---|---|---|---|
| Reloj del Worker | Cloudflare (cron cada 5 min) | siempre | Recordatorios (1 h y 10 min, uno por hora de inicio), resumen diario 22:00, #esta-semana |
| Barrido del Worker | Cloudflare | por franjas: nada 00–08; cada 10 min 08:30–14:30 y 16:00–21:30; 15/30 min el resto | Ticketmaster (⭐⭐⭐) en Europa y en América (EE. UU., Canadá, México), fichas y avisos, panel de #estado, lanza los trabajos de GitHub |
| Radar del catálogo | Actions `feed-radar` | 11 veces/día (lo lanza el Worker) | Catálogo de Ticketmaster: GB, IE, ES, FR, DE, IT, NL, BE, EE. UU. y México en cada pasada; el resto (Europa, Canadá, Brasil y Latinoamérica) 4 por pasada; cambios → Worker; descubre sin tope giras de arenas/estadios y de alta demanda |
| Enriquecer fichas | Actions `enrich` | 09:00, 13:00, 19:00 (Worker) | Aforo, precios oficiales (prensa + IA) e imagen de precios, límite de entradas, registros (también de ⭐⭐⭐ sin fechas), reventa (StubHub) |
| Webs de deporte | Actions `sports` | 09:45 y 18:45 (Worker) | Webs oficiales de entradas (`data/sports-pages.json`); lo nuevo al canal del deporte |
| Radar de noticias | Actions `news-radar` | 6 veces/día (Worker) | Prensa de Europa, una noticia por artista y tipo al día |
| Ticketeras sin API | Actions `ticketers` | 10:00 y 20:00 (Worker) | Entradas.com, Eventim DE, TicketOne IT y See Tickets con Browser Run, por turnos; AXS por sitemaps |
| Redes | Actions `social` | 11:30 (Worker) | Instagram oficial de Blueticket y de los artistas ⭐⭐⭐ (Apify, ~0,1 $/día) |
| Mantenimiento D1 | Actions `d1-maintenance` | al subir un `.sql` a `apps/worker/maintenance/` | Ejecuta ese SQL en producción e imprime el resultado |

Horario y costes: [plan/14-horarios-y-costes.md](plan/14-horarios-y-costes.md). Los trabajos los lanza el
Worker sobre la rama por defecto (`claude/vigilant-euler-pkmop0`): fusionar ahí cada cambio.

## Tareas habituales

- **Seguir a un artista o evento:** en Discord, `/seguir Nombre` (⭐⭐⭐, sin límite). Dejar: `/dejar Nombre`.
- **Pausar todo lo que publica en Discord:** `DELIVERY_PAUSED: "1"` en `apps/worker/wrangler.jsonc`
  y subir (despliega solo). Los avisos se siguen guardando.
- **Ver el estado:** panel en #estado, o `https://gira-core.eleven-snk-11.workers.dev/health`.
- **Revisar el texto de las fichas activas:** lanzar *Vista previa de fichas* en Actions (solo datos públicos).
- **Añadir un programa de preventa** (cómo entrar): `data/presale-programs.json`.
- **Añadir un registro que ya conoces** (Laylo, Live Nation…): `data/watchlist.json`.
- **Vigilar otra web de entradas de deporte:** añadirla a `data/sports-pages.json` (nombre, canal y URL).
- **Añadir un registro a mano:** en Discord, `/registro artista:… url:…` (sale en su ficha en minutos).
- **SeatGeek (venta oficial, sobre todo EE. UU.):** secreto `SEATGEEK_CLIENT_ID` (ya configurado).
- **Rotar las claves de las notificaciones:** borrar `setting.vapid` (SQL de mantenimiento) y volver a
  activar las notificaciones en el iPhone.

## Reglas que no se tocan

- Solo información: nada de comprar, colas, cookies ni pases (`queueittoken` se descarta siempre).
- Los logs de Actions son públicos: nunca imprimir mensajes del Discord privado, enlaces de alta o
  calendario, tokens ni la tabla `setting` completa.
- Apify: como mucho **1 $ al día** (decisión del propietario); por encima, los trabajos se saltan solos.
- Browser Run: 10 min/día; los trabajos van por turnos para no pasarse.

## Límites del plan gratuito que condicionan el diseño

- Worker: 10 ms de CPU por ejecución → como mucho 8 fichas por pasada y fichas ya renderizadas para la app.
- 50 subpeticiones por ejecución → como mucho 4 artistas con cambios en Discord por pasada.
- Ticketmaster: 5.000 llamadas/día, freno al 80 %.
- D1: 100.000 filas escritas al día (se reinicia a las 00:00 UTC). Uso normal < 10.000. La semilla de
  artistas solo se carga si cambia y no reescribe filas iguales (el 8-nov se agotó el cupo por
  recargarla en cada despliegue). Si se agota, el Worker solo lee hasta las 01:00/02:00 de Madrid.
