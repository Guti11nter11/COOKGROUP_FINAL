# ADR 0001 · Dos relojes y barrido troceado por cola

**Estado:** aceptada (2026-11-07) · **Contexto:** R0+R1

## Contexto

- Workers gratis: 10 ms de CPU por invocación, 50 subpeticiones, 5 crons por cuenta.
- Un barrido completo de ~100 artistas son varios MB de JSON de Ticketmaster: no cabe en 10 ms.
- El cron de GitHub Actions se retrasa 5–30 min, se apaga tras 60 días sin actividad y solo corre
  en la rama por defecto.

## Decisión

1. **Detectar**: cron del Worker cada 5 min. Solo planifica (`planSweep`) y encola un mensaje por
   lote de artistas (Cloudflare Queues, `max_batch_size = 1`). El consumidor procesa **una página**
   por invocación (≈ 1–3 ms de CPU) y encola las páginas siguientes.
2. **Filtrar en origen**: `geoPoint` (48N 8E) + radio 3.500 km para pedir solo Europa, y lista de
   países de la Fase 1 después.
3. **Avisar al segundo** (R2): Durable Object "Reloj" con alarmas T-24 h / T-1 h / T-10 min / T-0
   y resúmenes 21:00 / 08:00 en hora de Madrid.
4. **Trabajo pesado** (R4+): GitHub Actions lanzado por el Worker con `workflow_dispatch`
   (`GH_DISPATCH_TOKEN`), con `schedule` solo como respaldo.

## Consecuencias

- ~1.300 mensajes/día ≈ 3.900 operaciones de Queues (límite gratis 10.000).
- ~2.500 llamadas/día a Ticketmaster (cuota 5.000, freno al 80 %).
- Si `exceededCpu` aparece en los logs: bajar `PAGE_SIZE` a 50.
