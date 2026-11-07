# 12 · Formato de la ficha de gira (R2)

Base: el mensaje de Akari para **U2 — European / UK Leg 2027** que compartió el propietario. GIRA
mantiene todo lo que funciona y añade lo que Akari no puede hacer.

## Lo que se mantiene de Akari

1. **Cabecera de datos duros**: límite de entradas, rango de precios, aforo, oyentes mensuales,
   enlaces a reventa (Viagogo, Vivid Seats) solo como referencia.
2. **Enlaces de lanzamiento** generales por ticketera (Ticketmaster, TicketOne, eTicketing…).
3. **Horas de cada preventa en orden**, con la marca `<t:UNIX:F>` de Discord (cada dispositivo la
   ve en su hora) y la doble referencia 🇪🇺 / 🇬🇧.
4. **Qué hace falta** en cada preventa (membresía de pago, registro, código, tarjeta, mismo email).
5. **Enlace por fecha y ticketera** dentro de cada preventa.
6. **Consejos**: objetivos (baratas, pista, gradas bajas), mejores fechas, reventa histórica.

## Lo que GIRA añade

| Mejora | Por qué |
|---|---|
| Hora de **Madrid escrita** además de `<t:…>` | Akari solo pone la marca; la hora de Madrid evita confusiones cuando el móvil está en otro huso |
| **¿Puedo entrar?** por preventa (cartera de accesos) | "Feedback Group: ❌ no eres miembro antiguo · Album/VISA: ✅ tienes VISA" |
| **Fecha límite** de cada registro y aviso T-24 h | Akari dice "signup", GIRA dice hasta cuándo |
| **Certeza y fuentes** de cada dato | "Precios 84–538 € · Expresso, JN · confirmado" |
| **Dificultad 0–100** y **probabilidad de fecha extra** | Sustituye "keep in mind they'll add dates" por un número con motivos |
| Mercado: **mediana y P25–P75** por zona, no solo un multiplicador | Estadística robusta según el brief |
| **Historial de cambios** | "Feedback presale movida de 10:00 a 09:00 · hace 2 h" |
| Enlaces **siempre a la ficha oficial** | Akari enlaza a veces URLs de cola (`queues.ticketmaster.fr`, `wait.ticketmaster.it`); GIRA no comparte enlaces de cola |
| Botón **Modo Drop** (en la app) | Cuenta atrás, relojes, enlaces y checklist |

## Plantilla (Discord, publicación del foro `fichas`)

```
U2 — GIRA EUROPEA / UK 2027 🇪🇺🇬🇧                      ⚠ dificultad 82 · fecha extra: alta
Límite: 4 · Precios: 84–538 € · Aforo: ~60.000 · Oyentes: 24,5 M (Deezer 7,3 M fans)
Mercado (referencia): Viagogo · Vivid Seats — mediana pista 310 € (P25–P75 240–420)

ENLACES OFICIALES: Ticketmaster · TicketOne · eTicketing (Tottenham)

1) Feedback Group (miembros antiguos de pago u2.com)      ❌ no eres miembro
   🇪🇺 mar 2 nov 10:00 Madrid · <t:1793610000:F>   🇬🇧 09:00 Londres
   Requisito: mismo email en Ticketmaster y en u2.com · código tras la cola
   Fechas: Estocolmo 26 y 28 abr · París 5 y 6 may · Lisboa 8 may · Ámsterdam 5 y 6 jun ·
           Berlín 30 jun · Milán 5 y 6 jul · Londres 18 y 19 jun (enlaces oficiales)
2) Hype Group ... 3) Album + VISA ... 4) Artist presale ... 5) Venta general

Objetivo: baratas → pista → gradas bajas · Mejores fechas: Londres > Berlín > París
Fuentes: Live Nation ES (oficial), El País, Expresso · actualizado hace 12 min
```

En la app la misma ficha es la pantalla P3 de `07-dashboards.md`.
