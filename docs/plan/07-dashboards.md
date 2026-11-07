# 07 · Dashboards y pantallas

Tres superficies: **PWA** (principal), **Discord** (archivo y canal secundario), **`.ics`**
(calendario nativo). Diseño pensado para iPhone a una mano, modo oscuro por defecto (se mira de
noche y en salas de espera), tipografía grande para horas y cuentas atrás.

## Navegación de la PWA

Barra inferior de 4 pestañas + botón central contextual:

```
 [ Hoy ]  [ Radar ]  ( ● Drop )  [ Calendario ]  [ Yo ]
```

El botón central solo se ilumina cuando hay una ventana en < 15 min (lleva a Modo Drop).

> Los datos de los bocetos (artistas, fechas, horas, precios) son **de ejemplo**.

---

### P1 · Hoy (pantalla de inicio)

Lo que importa en las próximas 48 h, en orden de hora (Madrid).

```
┌──────────────────────────────────────────┐
│ Hoy · sáb 7 nov            🔕 silencio 01–08 │
│                                          │
│ PRÓXIMA  ─────────────────────────────── │
│  10:00  Raye · Preventa artista          │
│         Madrid WiZink · 22 may           │
│         ✅ Puedes entrar  ·  en 14 h 12 m │
│         [Registrarme]  [Abrir ficha]     │
│                                          │
│ MAÑANA ───────────────────────────────── │
│  09:00  U2 · Live Nation (ES)    ⚠ difícil 82 │
│  10:00  U2 · Banco Santander     ❌ te falta tarjeta │
│  12:00  Noah Kahan · general     🟢 fácil 28 │
│                                          │
│ NOVEDADES DESDE AYER (3) ─────────────── │
│  🆕 Scorpions · 4 fechas ES      confirmado │
│  ➕ Oasis · fecha extra Wembley  confirmado │
│  💬 Harry Styles · estadios 2027  rumor    │
└──────────────────────────────────────────┘
```

### P2 · Radar

Todas las novedades con la **escalera de certeza** y filtros (región, tipo, certeza, solo
seguidos / descubrir).

```
 Filtros: [Europa ▾] [Todo ▾] [≥ probable ▾]

 ● ● ● ○ ○  U2 · Europa 2027              CONFIRMADO
            3 fuentes · Live Nation ES, El País, Time Out
 ● ● ○ ○ ○  Harry Styles · estadios 2027  PROBABLE
            2 fuentes · The Sun, Billboard
 ● ○ ○ ○ ○  Bad Bunny · Europa            RUMOR
            1 fuente · cuenta de fans (no oficial)
```

### P3 · Ficha de gira

Lo que publicaba Akari, mejorado. Secciones plegables:

1. **Cabecera**: artista, nombre de gira, certeza, dificultad (0–100) y probabilidad de fecha extra.
2. **Fechas**: lista por país con recinto, aforo, estado y enlace oficial por ticketera.
3. **Calendario de preventas** en orden, cada una con hora Madrid · UK · local, requisitos y
   "¿puedo entrar?" según la cartera.
4. **Precios**: tabla por zona → `oficial · mercado (mediana, P25–P75) · modelo · confianza`.
5. **Límite de entradas** y condiciones (nominales, cambio de nombre, reventa oficial).
6. **Historial**: cambios con fecha y fuente.
7. **Fuentes**: cada dato enlaza a su origen.

```
 PRECIOS · Madrid, Metropolitano
 Zona            Oficial   Mercado (P25–P75)   Modelo     Conf.
 Pista           95 €      310 € (240–420)     2,8–3,6×   ●●○
 Inner Circle    180 €     520 € (450–690)     2,5–3,2×   ●○○
 Grada anillo 1  75 €      160 € (130–210)     1,8–2,4×   ●●○
 Grada anillo 3  49 €      95 € (80–120)       1,6–2,0×   ●●●
 Estimación informativa. GIRA no compra ni vende entradas.
```

### P4 · Modo Drop

Pantalla completa, sin distracciones, se mantiene encendida (Wake Lock API).

```
┌──────────────────────────────────────────┐
│ U2 · Preventa Live Nation · Sevilla      │
│                                          │
│              09:58:41                    │
│        empieza en  01:19                 │
│                                          │
│  Madrid 09:58 · Londres 08:58 · Sevilla 09:58 │
│                                          │
│  ENLACES                                 │
│  ▸ 12 jun · La Cartuja · Ticketmaster ES │
│  ▸ 13 jun · La Cartuja · Ticketmaster ES │
│                                          │
│  TU CÓDIGO   ••••••  [mostrar] [copiar]  │
│                                          │
│  CHECKLIST (tuyo)                        │
│  ☑ Sesión iniciada en Ticketmaster       │
│  ☑ Tarjeta guardada                      │
│  ☐ Datos de facturación revisados        │
│                                          │
│  Límite: 4 entradas · nominales          │
│  Consejo: una pestaña, no refrescar la   │
│  sala de espera.                         │
└──────────────────────────────────────────┘
```

### P5 · Calendario

Mapa de calor semanal (filas = días, columnas = franjas horarias de Madrid) con cada ventana como
punto coloreado por tipo; vista lista debajo. Botón "Suscribir en Calendario" (`.ics`).

### P6 · Yo

- **Mis artistas** (nivel ⭐/⭐⭐/⭐⭐⭐, silenciar, regiones).
- **Cartera de accesos**: interruptores por tarjeta, operadora, plataforma, fan club, cuentas de
  ticketeras. Solo sí/no.
- **Avisos**: horas de silencio, qué es urgente, canales.
- **Diario de drops**: historial y métricas (cobertura, antelación, conseguidas).

### P7 · Salud del radar (operación)

```
 FUENTE              ÚLTIMO OK   PERIODO   ESTADO   CUOTA HOY
 Ticketmaster        hace 3 min  5 min     🟢       1.204 / 5.000
 Google News         hace 22 min 30 min    🟢       —
 Live Nation ES      hace 41 min 30 min    🟡 lento —
 Apify (mes)         ayer        semanal   🟢       1,12 $ / 5 $
 Workers AI          hace 1 h    —         🟢       2.310 / 10.000 neuronas
 Push iPhone         hace 2 h    —         🟢       último entregado 19:04
```

Más: cobertura del mes (⭐ métrica principal), avisos por día, despertares nocturnos, errores.

---

## Discord · estructura del servidor GIRA

```
📌 INICIO          #bienvenida (qué es, comandos) · #estado (salud, automático)
📅 CALENDARIO      #daily-release · #esta-semana (mensaje fijo que se edita) · #recordatorios
🚨 ALERTAS         #nuevas-giras · #fechas-extra · #preventas · #registros-abiertos
🎤 GIRAS           📋 foro "fichas": solo giras con fechas FUTURAS; etiquetas [Europa][España]…[confirmado][a la venta][agotado]
🌍 POR REGIÓN      #europa · #reino-unido · #eeuu · #latam · #australia · #asia (se activan por fases)
📰 NOTICIAS        #noticias · #rumores
🎟️ TICKETERAS      #ticketmaster · #live-nation · #eventim · #dice · #axs · #otras
🏟️ DEPORTES        #f1 · #futbol · #tenis · #otros-deportes
📦 ARCHIVO         #archivo (resumen final de cada gira cuando pasa su última fecha)
```

**Reglas acordadas con el propietario (2026-11-07):**

- **Nunca un canal por artista ni por concierto.** La información se va recopilando en los canales
  temáticos de arriba (por tipo de aviso, región, ticketera, deporte). Un artista que pase 10 años
  sin gira no aparece en ningún sitio durante esos 10 años.
- **Solo futuro:** no se publican conciertos que ya han pasado ni se rellena el historial; el primer
  barrido guarda en silencio.
- **Fichas temporales:** cada gira con fechas futuras tiene una publicación en el foro `fichas`
  (las publicaciones de un foro no cuentan como canales). Cuando pasa su última fecha, el bot
  publica un resumen en `#archivo` y **borra** la publicación del foro.
- **Tope de seguridad:** si el servidor se acercase al límite de Discord (500 canales / 1.000 hilos
  activos), el bot borra primero lo más antiguo ya archivado.
- **La app del iPhone lo guarda todo** sin límite (también el histórico), con buscador.
- El foro necesita **Comunidad** activada; sin ella, `fichas` se crea como canal de texto normal.

- **Eventos programados de Discord** para cada preventa ⭐⭐⭐: Discord avisa de forma nativa a
  quien marque "Interesado" (límite 100 eventos activos → solo los importantes).
- Embeds con color por urgencia, horas en formato `<t:UNIX:F>` (Discord las pinta en la hora local
  del dispositivo) **y** la hora de Madrid escrita, por claridad.
- Slash commands: `/seguir`, `/dejar`, `/gira <artista>`, `/hoy`, `/semana`, `/pregunta`,
  `/estado`, `/silencio <horas>`.

## Resumen diario (21:00, #daily-release + push)

```
GIRA · Resumen del sábado 7 nov
🆕 2 giras nuevas · ➕ 1 fecha extra · 🎟️ 4 preventas en 48 h · 📝 1 registro cierra pronto
Mañana:
 09:00  U2 · Live Nation ES (Sevilla, Barcelona)  ⚠ 82
 10:00  U2 · Banco Santander Mastercard          ❌ te falta tarjeta
Esta semana: 11 ventanas · ver calendario
```
