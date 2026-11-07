# 03 · Mapa de historias (User Story Map)

El mapa sigue el recorrido del propietario de izquierda a derecha (la "columna vertebral") y corta
el trabajo en entregas horizontales. Cada entrega es usable por sí sola: la primera ya avisa de
preventas reales; las siguientes la hacen más completa, más precisa y más lista.

Los IDs (`H-xx`) remiten a [04-historias.md](04-historias.md).

## Columna vertebral

```
 DESCUBRIR ──► SEGUIR ──► ENTENDER ──► PREPARARME ──► ESTAR A LA HORA ──► EJECUTAR ──► PLAN B ──► APRENDER
 qué sale      qué me      la gira de    qué preventas    avisos justos      todo a mano   agotado:   qué pasó y
               importa     un vistazo    puedo usar       (silencio 01–08)   (yo compro)   ¿y ahora?  mejorar
```

Actividad transversal: **OPERAR** (salud de fuentes, cuotas, coste, privacidad).

## Entregas

### R1 · "Primer pitido" — Ticketmaster → Discord (esqueleto que ya da valor)

| Descubrir | Seguir | Entender | Prepararme | Estar a la hora | Ejecutar | Plan B | Aprender | Operar |
|---|---|---|---|---|---|---|---|---|
| H-01 Detectar eventos nuevos de artistas seguidos en Europa+UK | H-10 Lista semilla de ~100 artistas con IDs resueltos | H-20 Ficha mínima: fechas, recinto, ciudad, enlaces | H-30 Ventanas de venta (pública + preventas TM) con hora Madrid/UK | H-40 Aviso en #nuevas-giras y #preventas | H-50 Enlace correcto por fecha | — | — | H-80 Montar servidor Discord · H-81 Deduplicación · H-82 Horas de silencio · H-83 Salud mínima |

### R2 · "La ficha" — calendario, resumen y fichas temporales en Discord

| Descubrir | Seguir | Entender | Prepararme | Estar a la hora | Ejecutar | Plan B | Aprender | Operar |
|---|---|---|---|---|---|---|---|---|
| H-02 Fechas extra como evento propio | H-11 Slash `/seguir`, `/dejar` | H-21 Ficha de gira agregada (todas las fechas) · H-22 Historial de cambios de la ficha | H-31 Calendario de preventas en orden · H-32 Requisitos por preventa | H-41 Recordatorios T-24h / T-1h / T-10min (Reloj DO) · H-42 Resumen diario 21:00 · H-43 `.ics` suscribible | H-51 Hilo de foro por gira con todo | — | — | H-84 Presupuesto de cuotas |

### R3 · "En el bolsillo" — PWA privada con push

| Descubrir | Seguir | Entender | Prepararme | Estar a la hora | Ejecutar | Plan B | Aprender | Operar |
|---|---|---|---|---|---|---|---|---|
| H-03 Pantalla Radar | H-12 Mis artistas (peso, nivel) | H-23 Ficha en la PWA | H-33 **Cartera de accesos** (qué tarjetas/cuentas tengo) · H-34 "¿Puedo entrar?" por preventa | H-44 Push web con urgencia · H-45 Resumen de la mañana | H-52 **Modo Drop** (cuenta atrás, relojes, enlaces, checklist) | — | H-70 Botón "esto está mal" | H-85 Passkey + sesión 1 año · H-86 Panel de salud |

### R4 · "España de verdad" — prensa, promotoras y procedencia

| Descubrir | Seguir | Entender | Prepararme | Estar a la hora | Ejecutar | Plan B | Aprender | Operar |
|---|---|---|---|---|---|---|---|---|
| H-04 Noticias (Google News, Los40, NME, Billboard…) · H-05 Live Nation ES/UK · H-06 YouTube RSS | H-13 Promotoras y recintos seguidos | H-24 **Escalera de certeza** con fuentes · H-25 Conflictos entre fuentes | H-35 Registros abiertos (#registros-abiertos) con fecha límite | H-46 Aviso de registro que cierra | — | — | H-71 Diario de drops (manual) | H-87 Lectura moderada de ticketeras sin API |

### R5 · "Inteligencia" — popularidad, dificultad, precios, descubrimiento

| Descubrir | Seguir | Entender | Prepararme | Estar a la hora | Ejecutar | Plan B | Aprender | Operar |
|---|---|---|---|---|---|---|---|---|
| H-07 **Descubrimiento automático** de giras de estadios/arenas | H-14 Sugerencias "por si te interesa" | H-26 Popularidad (Deezer, Last.fm, YouTube, ruido) · H-27 **Índice de dificultad** | H-36 Precio oficial por zona | — | — | H-60 **Probabilidad de fecha extra** · H-61 Mercado secundario (Viagogo/StubHub, solo lectura) · H-62 Estimación de reventa con confianza | H-72 Calibrar modelos con el diario | H-88 Gasto Apify/IA |

### R6 · "Deporte" — F1, fútbol, tenis y más

| Descubrir | Seguir | Entender | Prepararme | Estar a la hora | Ejecutar | Plan B | Aprender | Operar |
|---|---|---|---|---|---|---|---|---|
| H-08 Calendarios (Jolpica, football-data, Grand Slams, UFC…) | H-15 Seguir competiciones/equipos | H-28 Ficha deportiva (fase, sede, sorteo de entradas UEFA) | H-37 Sorteos y ventas de clubes/federaciones | H-47 Avisos de sorteo | — | — | — | — |

### R7 · "Oído fino" — redes, preguntas y audio

| Descubrir | Seguir | Entender | Prepararme | Estar a la hora | Ejecutar | Plan B | Aprender | Operar |
|---|---|---|---|---|---|---|---|---|
| H-09 Redes vía Apify (IG, TikTok, X) para el top 30 | — | H-29 **Pregunta a GIRA** (PWA y `/gira`) | — | H-48 **Resumen en audio** de 2 min | H-53 Atajo de Siri "¿Qué sale hoy?" | H-63 Reventa oficial (Fan-to-Fan / reventa TM) | H-73 Aprender de 👍/👎 | — |

### R8+ · Regiones siguientes (misma columna, nuevas fuentes)

EE. UU. → Latinoamérica → Australia → Asia. Solo cuando la región anterior cumpla la regla de
cambio de fase (4 semanas con cobertura ≥ 90 %).

## Por qué este corte

- **R1** valida lo más arriesgado técnicamente (Ticketmaster dentro de los 10 ms de CPU, deduplicar,
  horas de silencio) y ya da avisos reales en Reino Unido/Irlanda, donde la API es buena.
- **R2 antes que la PWA** porque Discord ya existe y el `.ics` llega al iPhone sin desarrollar nada:
  el propietario tiene calendario y recordatorios desde la segunda entrega.
- **R4 es la entrega que hace útil GIRA en España** (la API apenas trae preventas españolas).
  Puede adelantarse a R3 si el propietario prefiere cobertura a interfaz (decisión abierta).
- **R5** necesita datos acumulados de R1–R4 para calibrar los modelos.
