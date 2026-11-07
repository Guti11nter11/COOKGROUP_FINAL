# 06 · Modelo de datos (D1)

Esquema de partida. Horas siempre en **UTC ISO-8601**; la zona horaria se guarda aparte
(`tz` del recinto). Las tablas de hechos llevan `certainty` y se alimentan de `claim`.

## Entidades del dominio

```
artist ─┬─< artist_ext_id            (mbid, tm_attraction, deezer, wikidata, lastfm, youtube…)
        ├─< follow                    (nivel ⭐/⭐⭐/⭐⭐⭐, motivo, desde)
        └─< tour ─< event >─ venue    (evento = una fecha concreta en un recinto)
                     ├─< sale_window ─< requirement      (preventas y venta general)
                     ├─< event_link                      (ticketera + URL oficial)
                     ├─< price_tier                      (oficial por zona)
                     ├─< market_observation              (Viagogo/StubHub, solo lectura)
                     └─< estimate                        (dificultad, fecha extra, reventa)

source ─< signal ─< claim >─ (artist|tour|event|sale_window|price_tier)
change_log  · alert ─< delivery · push_subscription · passkey · session
wallet_item (cartera de accesos) · drop_log (diario de drops) · quota_usage · job_run
competition ─< fixture (deporte; un fixture se trata como event)
```

## Tablas principales

| Tabla | Campos clave | Notas |
|---|---|---|
| `artist` | `id`, `name`, `sort_name`, `country`, `genres`, `popularity_json` | `id` interno (ULID) |
| `artist_ext_id` | `artist_id`, `system`, `ext_id` | Único por (`system`, `ext_id`) |
| `follow` | `artist_id`, `tier` (1–3), `regions`, `muted_until` | También para competiciones |
| `venue` | `id`, `name`, `city`, `country`, `tz`, `lat`, `lon`, `capacity`, `tm_venue_id` | Aforo editable a mano |
| `tour` | `id`, `artist_id`, `name`, `announced_at`, `certainty`, `region` | Agrupa eventos |
| `event` | `id`, `tour_id`, `venue_id`, `starts_at`, `status`, `is_extra_date`, `ticket_limit`, `certainty` | `status`: announced/onsale/soldout/cancelled/postponed |
| `sale_window` | `id`, `event_id` o `tour_id`, `kind`, `label`, `starts_at`, `ends_at`, `url`, `certainty`, `order_rank` | `kind` normalizado (ver abajo) |
| `requirement` | `sale_window_id`, `type`, `detail`, `deadline_at` | registro/código/tarjeta/cuenta/email/sorteo |
| `event_link` | `event_id`, `ticketer`, `url`, `is_official` | Nunca URLs con `queueittoken` |
| `price_tier` | `event_id`, `section`, `section_class`, `face_min`, `face_max`, `currency`, `fees_included` | `section_class`: pista/GA, golden/inner, grada_1/2/3, vip |
| `market_observation` | `event_id`, `section_class`, `platform`, `price`, `currency`, `seen_at`, `listing_hash` | Para detectar anuncios que no se mueven |
| `estimate` | `event_id`, `kind`, `value_json`, `confidence`, `model_version`, `computed_at` | dificultad, fecha_extra, reventa |
| `source` | `id`, `kind`, `name`, `trust` (0–1), `is_official`, `poll_minutes`, `enabled` | La confianza baja con cada "esto está mal" |
| `signal` | `id`, `source_id`, `url`, `fetched_at`, `content_hash`, `excerpt` | `excerpt` ≤ 4 KB (sin R2) |
| `claim` | `id`, `signal_id`, `subject_type`, `subject_id`, `field`, `value`, `quote`, `confidence` | La cita literal es obligatoria |
| `change_log` | `subject_type`, `subject_id`, `field`, `before`, `after`, `claim_id`, `at` | Historial visible en la ficha |
| `alert` | `id`, `kind`, `subject_id`, `urgency`, `dedupe_key`, `scheduled_for`, `created_at` | `dedupe_key` único |
| `delivery` | `alert_id`, `channel`, `status`, `attempts`, `sent_at` | push/discord/ics |
| `push_subscription` | `endpoint`, `p256dh`, `auth`, `created_at`, `last_ok_at` | |
| `passkey` / `session` | credencial WebAuthn / sesión rotada | |
| `wallet_item` | `type`, `value` (bool), `note` | "amex", "santander_mastercard", "o2_priority", "fanclub:<artista>", "cuenta:ticketmaster_es"… |
| `drop_log` | `sale_window_id`, `detected_at`, `lead_hours`, `outcome`, `sold_out_minutes`, `note` | Mide las métricas |
| `quota_usage` | `service`, `day`, `calls`, `cost_usd` | Freno al 80 % |
| `job_run` | `job`, `started_at`, `finished_at`, `ok`, `items`, `error` | Panel de salud |

## Tipos de preventa normalizados (`sale_window.kind`)

Orden por defecto (`order_rank`) y ejemplos reales vistos en la auditoría:

| Rango | `kind` | Ejemplos |
|---|---|---|
| 10 | `fanclub` | Fan club oficial |
| 20 | `artist` | *Artist Presale*, registro del artista, preventa por compra de álbum |
| 30 | `card` | *Citi®*, *Mastercard Presale*, Amex, VISA, **Banco Santander Mastercard** (Live Nation ES), *Preventa Banamex* |
| 40 | `telco` | **Priority from O2**, *Three+ Presale*, *Telekom Prio Tickets* |
| 45 | `platform` | *Spotify Presale*, *PayPal Prio Tickets* |
| 50 | `promoter` | *Live Nation Presale*, *MCD Presale*, *Promoter Presale* |
| 55 | `ticketer` | *Ticketmaster Presale* |
| 60 | `venue` | *Venue Presale* |
| 70 | `registration` | Registro (Verified Fan, "Registro" de Live Nation ES) — ventana para apuntarse, no para comprar |
| 80 | `lottery` | Sorteos (UEFA, JJOO, Glastonbury) |
| 90 | `general` | Venta general (`sales.public`) |
| 95 | `official_resale` | Reventa oficial |

Un diccionario `data/presale-kinds.json` mapea etiquetas crudas (en cualquier idioma) a `kind` y
a requisitos por defecto; lo que no encaje queda como `unknown` y se revisa.

## Reglas de integridad

- `alert.dedupe_key` = `kind:subject_id:hash(campos relevantes)` → un aviso por cambio real.
- Un `event` no pasa a `confirmed` sin al menos un `claim` de fuente `is_official = 1`.
- Borrado: los datos de eventos pasados > 18 meses se compactan (se conserva `drop_log`).
