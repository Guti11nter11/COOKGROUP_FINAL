# 05 · Arquitectura

## 1. Vista general

```
                 ┌──────────────────────── FUENTES ────────────────────────┐
                 │ Ticketmaster API · Live Nation ES/UK · Google News RSS  │
                 │ medios · YouTube RSS · Deezer · Last.fm · MusicBrainz   │
                 │ Jolpica · football-data · ticketeras sin API · Apify    │
                 └───────────────┬──────────────────────────┬──────────────┘
          rápido (≤ 5 min)       │                          │   pesado (minutos)
   ┌─────────────────────────────▼───────┐      ┌───────────▼────────────────────────┐
   │ CLOUDFLARE WORKER  "gira-core"      │      │ GITHUB ACTIONS  (repo público)      │
   │  • cron */5: Ticketmaster delta     │ ───► │  • noticias + extracción IA         │
   │  • despachador: dispara workflows   │ dispatch│ • ticketeras sin API (moderado)  │
   │    a la hora exacta                 │      │  • Apify (redes, mercado)           │
   │  • API de la PWA + passkeys         │ ◄─── │  • popularidad semanal              │
   │  • interacciones Discord (firmadas) │ ingest│ • resúmenes y audio (IA)           │
   │  • push web (VAPID)                 │  API │  • modelos (dificultad, precios)    │
   │  • feed .ics                        │      └─────────────────────────────────────┘
   └──────┬──────────────┬───────────────┘
          │              │
   ┌──────▼─────┐  ┌─────▼──────────────────┐   ┌──────────────┐   ┌───────────────┐
   │ D1 "gira"  │  │ Durable Object "Reloj" │   │ Queues       │   │ KV (caché de  │
   │ verdad     │  │ alarmas T-24h/1h/10m/0 │   │ reparto      │   │ lectura: feed,│
   │ única      │  │ precisión de segundos  │   │ de trabajo   │   │ .ics, config) │
   └──────┬─────┘  └─────┬──────────────────┘   └──────────────┘   └───────────────┘
          │              │
   ┌──────▼──────────────▼─────────────── SALIDAS ─────────────────────────────────┐
   │ PWA "GIRA" (Pages, privada, push) · Discord (servidor GIRA) · .ics suscribible │
   └────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Dos relojes (decisión clave)

| Necesidad | Dónde | Por qué |
|---|---|---|
| Detectar en ≤ 10 min (⭐⭐⭐) / ≤ 25 min (resto) (Ticketmaster) | Cron del Worker cada 5 min | Puntual y gratis (1 de los 5 crons de la cuenta) |
| Avisar a la hora exacta (T-10min, T-0) | **Durable Object "Reloj" con alarmas** | Precisión de segundos; el cron de 5 min no basta |
| Trabajo pesado (IA, scraping, Apify) | GitHub Actions **disparado por el Worker** (`workflow_dispatch`) | Minutos ilimitados; el cron propio de Actions se retrasa 5–30 min y se apaga a los 60 días sin actividad |
| Respaldo si el Worker falla | `schedule` de Actions a minutos impares (p. ej. `:17`, `:47`) | Evita la congestión de las horas en punto |

El Worker usa **un solo cron**: `*/5 * * * *` (monitor + despachador + vigilante del Reloj). Los
resúmenes de las 21:00 y las 08:00 son **alarmas del Reloj calculadas en Europe/Madrid**, así el
cambio de horario verano/invierno no obliga a tocar crons (los crons de Cloudflare van en UTC).
Quedan 4 crons libres en la cuenta.

## 3. Flujo de datos: de señal a aviso

```
Señal cruda ─► Extracción ─► Resolución ─► Fusión con procedencia ─► Reglas ─► Entrega
 (signal)      (claims)      (entidades)   (hechos + certeza)        (alertas)  (push/Discord/ics)
```

1. **Señal** (`signal`): lo que llega de una fuente, tal cual (respuesta de API, artículo, post).
   Se guarda su huella (hash) para no reprocesar.
2. **Extracción** → **afirmaciones** (`claim`): "la preventa Amex de X en Madrid empieza el
   2026-12-03T09:00Z", con fuente, cita literal y confianza. Determinista para APIs; IA con
   esquema JSON para texto libre.
3. **Resolución**: a qué artista/gira/fecha/recinto se refiere (IDs: MBID, `attractionId`,
   `venueId`, Wikidata).
4. **Fusión**: las afirmaciones se combinan en **hechos** con certeza (`rumor → probable →
   confirmado`). Los cambios se registran en `change_log`.
5. **Reglas de aviso** (función pura, testeada): ¿importa? ¿es urgente? ¿horas de silencio?
   ¿ya avisado? → `alert`.
6. **Entrega**: push, Discord, `.ics`; con reintentos y registro de entrega.

## 4. Presupuesto de cuotas (diario salvo indicación)

| Recurso | Límite | Presupuesto GIRA | Holgura |
|---|---|---|---|
| Ticketmaster | 5.000 llamadas | ~2.500 (lotes de `attractionId` separados por comas: ⭐⭐⭐ cada 5 min ≈ 1.440 + barrido completo cada 20 min ≈ 1.080) + descubrimiento ≤ 500 | 20 % |
| Worker peticiones | 100.000 | ~5.000 (cron, PWA, Discord) | 95 % |
| Worker CPU | 10 ms/invocación | Páginas de 50 eventos; reparto por Queues si hace falta | **medir en R1** |
| D1 escrituras | 100.000 filas | ≤ 20.000 | 80 % |
| KV escrituras | 1.000 | ≤ 100 (feed y `.ics` regenerados solo si cambian) | 90 % |
| Queues | 10.000 ops | ≤ 3.000 | 70 % |
| Durable Objects | 100.000 peticiones | ≤ 2.000 | 98 % |
| Workers AI | 10.000 neuronas | embeddings + respaldo de IA | — |
| Browser Run | 10 min | ≤ 6 min, solo fichas que lo necesiten | 40 % |
| Apify (mensual) | 5 $ | ≤ 3,50 $ con corte automático | 30 % |
| Firecrawl (total) | 1.400 créditos | último recurso de lectura | — |
| football-data | 10/min | cola con espera | — |
| MusicBrainz / Nominatim | 1/s | caché permanente | — |

Cada llamada externa pasa por un **contador** (`quota_usage`) con freno al 80 %.

## 5. IA con fallback

Orden: **Groq** (`gpt-oss-120b` / `qwen3.8-27b`) → **Gemini** (`gemini-3.x-flash`) → **Workers AI**
(Llama 3.1 8B fp8) → **NVIDIA** → **OpenAI** (de pago, solo si todo falla y con tope).

- Todo pasa por **AI Gateway** (caché de respuestas idénticas, logs, límites).
- Tareas: extraer afirmaciones de noticias (JSON con esquema), resumir, redactar fichas, responder
  "Pregunta a GIRA", audio (Gemini TTS).
- **Las horas y fechas nunca las inventa la IA:** la IA cita el texto; un validador determinista
  convierte la cita a UTC con la zona del recinto y rechaza lo ambiguo.
- Conjunto de **casos de oro** (artículos reales anotados a mano) para medir cada cambio de prompt
  o modelo.

## 6. Seguridad y privacidad

- **Passkey (WebAuthn)** como único acceso a la PWA. El registro solo está abierto hasta que exista
  la primera credencial (y se puede reabrir con un código de un solo uso que el Worker imprime en
  sus logs). Sesión en cookie `HttpOnly; Secure; SameSite=Strict` de ~1 año, rotada al usarse.
- `X-Robots-Tag: noindex, nofollow`, `robots.txt` que lo bloquea todo, sin enlaces públicos.
- Interacciones de Discord verificadas con Ed25519 (`DISCORD_PUBLIC_KEY`); comandos solo para el ID
  de usuario del propietario.
- Ingesta desde Actions al Worker con **token HMAC** compartido (secreto en ambos lados).
- Secretos solo en GitHub Secrets y Cloudflare. El repo es público: los logs de Actions solo
  imprimen códigos y recuentos.
- **Cartera de accesos**: solo booleanos ("tengo Amex"). Los códigos de preventa que el propietario
  guarde van cifrados en D1 (AES-GCM con clave del Worker) y se borran 7 días después del evento.

## 7. Estructura del repositorio propuesta

```
/
├─ packages/
│  ├─ core/          dominio puro (tipos, reglas de aviso, horas de silencio, fusión, certeza,
│  │                 orden de preventas, dificultad, precios). Sin E/S. 100 % testeado.
│  ├─ sources/       clientes de fuentes (Ticketmaster, Deezer, News…) con fixtures grabados
│  └─ db/            esquema D1, migraciones, consultas tipadas
├─ apps/
│  ├─ worker/        Cloudflare Worker (cron, API, Discord, push, ics, Durable Object Reloj)
│  ├─ pwa/           PWA (Vite + Preact + TypeScript), desplegada en Pages
│  └─ jobs/          trabajos de GitHub Actions (Node + TypeScript con tsx)
├─ data/             semillas: artistas, tipos de preventa, recintos, competiciones
├─ docs/             plan, ADRs, glosario
└─ .github/workflows/
```

**Un solo lenguaje (TypeScript)** en Worker, PWA y trabajos: el modelo de dominio se escribe una
vez y se comparte. Pruebas con Vitest (y `@cloudflare/vitest-pool-workers` para el Worker),
Playwright para la PWA.

## 8. Decisiones abiertas (ADR pendientes)

| Decisión | Recomendación | Alternativa |
|---|---|---|
| Framework PWA | Vite + Preact (ligero, rápido en iPhone) | SvelteKit estático |
| R2 | Prescindir al principio; guardar extractos en D1 | Activar R2 para HTML crudo y capturas |
| Un canal por gira en Discord | **Foro "giras"** con un hilo por gira | Canales (límite 500/50 por categoría) |
| Orden R3/R4 | R4 (España) antes que la PWA si se prioriza cobertura | Orden actual |
| Workers de pago (5 $/mes) | No: el diseño cabe en gratis | Solo si la CPU de 10 ms resulta insalvable |
