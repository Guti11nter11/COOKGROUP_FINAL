# 09 · Roadmap y forma de trabajar

Unidad de medida: **sesión** = una sesión larga de trabajo de Claude (varias horas). Las
estimaciones son orientativas; cada entrega termina con algo que el propietario usa.

| Entrega | Contenido (historias) | Sesiones | Listo cuando… |
|---|---|---|---|
| **R0 · Cimientos** | Monorepo TypeScript, CI, esquema D1, despliegue del Worker, acciones del propietario A1–A2 | 1 | CI en verde y el Worker desplegado responde `/health` |
| **R1 · Primer pitido** | H-01, H-10, H-20, H-30, H-40, H-50, H-80–H-83 | 2 | Durante 7 días, cada evento nuevo de un artista seguido en Europa+UK llega a Discord en ≤ 10 min, sin duplicados |
| **R2 · La ficha** | H-02, H-11, H-21, H-22, H-31, H-32, H-41–H-43, H-51, H-84 | 2–3 | Foro de giras vivo, recordatorios exactos, `.ics` suscrito en el iPhone, resumen 21:00 |
| **R3 · En el bolsillo** | H-03, H-12, H-23, H-33, H-34, H-44, H-45, H-52, H-70, H-85, H-86 | 3 | PWA instalada con passkey, push recibido de noche solo si es urgente, Modo Drop probado en una preventa real |
| **R4 · España de verdad** | H-04–H-06, H-13, H-24, H-25, H-35, H-46, H-71, H-87 | 3 | La gira española grande del momento (p. ej. U2 2027) tiene su calendario completo de preventas con fuentes |
| **R5 · Inteligencia** | H-07, H-14, H-26, H-27, H-36, H-60–H-62, H-72, H-88 | 3–4 | Dificultad, fecha extra y precios con confianza en todas las fichas activas |
| **R6 · Deporte** | H-08, H-15, H-28, H-37, H-47 | 2 | F1 2027, finales UEFA y Grand Slams en calendario con sus ventas/sorteos |
| **R7 · Oído fino** | H-09, H-29, H-48, H-53, H-63, H-73 | 2–3 | Redes del top 30 dentro de 3,50 $/mes, Pregunta a GIRA, audio diario |
| **Fase 2+** | EE. UU. → LatAm → Australia → Asia | 1–2 por región | Regla de cambio de fase cumplida en la región anterior |

**Total hasta Europa completa (R0–R7): ~18–21 sesiones.**

Orden alternativo recomendado si se prioriza cobertura en España: **R0 → R1 → R2 → R4 → R3 → …**
(la PWA llega una entrega más tarde, pero los avisos españoles llegan antes).

## Definición de "hecho" (para cada historia)

1. Tests primero (TDD) y en verde en CI; el dominio (`packages/core`) sin E/S y con cobertura de
   reglas al 100 %.
2. Fixtures reales grabados de cada fuente (sin secretos) para que los tests no llamen a la red.
3. Revisión de código (pr-review-toolkit) antes de fusionar.
4. Desplegado y verificado con datos reales: se enseña la salida (mensaje de Discord, push, `.ics`).
5. Panel de salud actualizado con la nueva fuente o trabajo.
6. Presupuesto de cuotas revisado.

## Forma de trabajar

- **Ramas**: una rama por entrega; PR hacia la rama por defecto; el propietario fusiona.
- **Skills**: Superpowers (plan → TDD → revisión), `karpathy-guidelines`, `mp-domain-modeling`
  (glosario y ADRs), `frontend-design` + `ui-ux-pro-max` para la PWA, Cloudflare (`wrangler`,
  `workers-best-practices`, `durable-objects`) y Apify.
- **ADRs** en `docs/adr/` para cada decisión abierta de la arquitectura.
- **Diario de drops** desde R4 para medir la cobertura con preventas reales.

## Plan detallado de la primera tarea

[R0 + R1 · plan de implementación paso a paso](../superpowers/plans/2026-11-07-gira-r0-r1.md)
