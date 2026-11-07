# 04 · Relatos e historias de usuario

## Parte A · Relatos (cómo se vive GIRA)

Siete escenas concretas. Cada una conecta con las historias de la parte B. **Son ilustrativas:**
artistas, recintos, horas y precios son ejemplos para explicar el comportamiento, no datos reales
(salvo que U2 anunció de verdad Barcelona y Sevilla 2027, según la prensa de esta semana).

### A1 · Martes, 21:00 — el resumen

El iPhone vibra una vez. *"GIRA · Resumen del martes: 2 giras nuevas, 1 preventa mañana, 1 registro
que cierra el jueves."* Al abrir: **Raye** anuncia arena tour europeo (Madrid, WiZink Center,
22-may); la preventa del artista es mañana a las 10:00 (Madrid) y requiere registro, que ya está
abierto. GIRA marca en verde la preventa de Ticketmaster porque el propietario tiene cuenta, y en
gris la de O2 porque no tiene línea O2. Un toque en "Registrarme" abre la página oficial. Treinta
segundos y listo. *(H-42, H-23, H-33, H-34, H-35)*

### A2 · Jueves, 03:12 — el despertar que sí vale la pena

Silencio absoluto toda la noche… salvo una notificación crítica: *"⚡ Fecha extra · Oasis añade
2.º Wembley. Venta general en 47 min (04:00 Madrid / 03:00 UK)."* Es un artista seguido con nivel
⭐⭐⭐ y faltan menos de 60 minutos: cumple la regla de urgencia. El resto de novedades de la noche
esperan al **resumen de la mañana** de las 08:00. *(H-02, H-44, H-45, H-82)*

### A3 · Lunes, 09:50 — Modo Drop

A las 09:50 llega el aviso T-10min. Al abrir, GIRA está en **Modo Drop**: cuenta atrás grande,
tres relojes (Madrid 09:50 · Londres 08:50 · local), enlaces ordenados por fecha y ticketera, el
código de preventa que el propietario guardó, y un checklist suyo ("sesión iniciada en TM",
"tarjeta guardada", "datos del pago revisados"). Abajo, en pequeño: *"Consejo oficial: no
refresques la sala de espera; una pestaña por cuenta."* GIRA no hace nada más: el propietario
compra. *(H-41, H-52, H-33)*

### A4 · Semana de rumores — la escalera de certeza

Un medio británico publica que "U2 prepara estadios en Europa para 2027". GIRA lo registra como
**rumor** (1 fuente, no oficial). Dos días después, El País y Time Out confirman Barcelona y Sevilla
con fecha: pasa a **confirmado**. La ficha enseña de dónde sale cada dato y cuándo cambió.
Cuando Live Nation ES publica la preventa, el aviso dice: *"Confirmado por 3 fuentes · preventa
Live Nation viernes 10:00."* *(H-04, H-05, H-24, H-22)*

### A5 · Agotado en 11 minutos — Plan B

La primera fecha de Madrid se agota. GIRA no grita: muestra la **probabilidad de fecha extra**
(*alta: demanda 4× aforo, patrón habitual del artista, registro masivo*), la **reventa oficial** si
existe, y el **mercado secundario** como dato: *"Pista: oficial 95 € · mercado mediana 310 €
(P25–P75: 240–420) · modelo 2,8–3,6× · confianza media"*. Recomendación implícita: esperar a la
fecha extra antes de pagar 3×. *(H-60, H-61, H-62, H-63)*

### A6 · Mayo — final de Champions

GIRA sabe que la final es en una sede concreta y que la UEFA vende por **sorteo** con ventana de
registro. Aviso: *"Sorteo de entradas para público general abierto hasta el 14 de marzo."* Fecha
límite en el calendario y recordatorio dos días antes. *(H-08, H-28, H-37, H-47)*

### A7 · Después de cada drop — aprender

Al día siguiente GIRA pregunta en una línea: *"¿Conseguiste entradas para Raye Madrid?"*
(Sí / No / No lo intenté). Con eso y la hora de agotado, el **Diario de drops** mide si GIRA avisó a
tiempo y calibra la dificultad y la probabilidad de fecha extra. *(H-71, H-72)*

---

## Parte B · Historias de usuario

Formato: **Como** propietario **quiero** … **para** … · Prioridad MoSCoW · Entrega · Criterios de
aceptación (Dado / Cuando / Entonces). Talla: S (≤ ½ sesión), M (1 sesión), L (2–3 sesiones).

### Épica E1 · Descubrir

**H-01 · Eventos nuevos de artistas seguidos (Ticketmaster)** · Must · R1 · M
Quiero enterarme de cada evento nuevo de un artista seguido en Europa y Reino Unido, para no
depender de mirar webs.
- Dado un artista seguido con `attractionId` resuelto, cuando Ticketmaster publique un evento nuevo,
  entonces GIRA lo guarda una sola vez y avisa en ≤ 10 min.
- Dado un evento ya conocido, cuando vuelva en otra consulta, entonces no se repite el aviso.
- Dado un evento cancelado o aplazado (`dates.status.code`), entonces se avisa del cambio.

**H-02 · Fechas extra** · Must · R2 · M
Quiero que una fecha nueva de una gira ya conocida se trate como "fecha extra", para reaccionar
antes que el resto.
- Dado una gira con N fechas, cuando aparezca una fecha N+1 en el mismo país, entonces se publica
  en #fechas-extra y es **urgente** si su venta empieza en < 1 h.

**H-03 · Pantalla Radar** · Should · R3 · M
Quiero una lista viva de novedades con su certeza, para ver qué ha pasado de un vistazo.

**H-04 · Noticias** · Must · R4 · L
Quiero que GIRA lea Google News RSS y medios musicales y extraiga giras, fechas, preventas y
precios, para cubrir España, donde Ticketmaster casi no trae preventas.
- Dado un artículo con "preventa" y fecha, cuando se procese, entonces se crean **afirmaciones**
  (`claim`) con valor, fuente, cita literal y confianza, nunca hechos sin fuente.
- Dado el mismo hecho en 3 artículos, entonces se fusiona en uno con 3 fuentes.
- La extracción usa salida JSON con esquema y valida fechas/horas; si no valida, se descarta.

**H-05 · Live Nation ES/UK** · Must · R4 · M
Quiero leer las fichas públicas de Live Nation, para obtener tipos de preventa (p. ej. "Banco
Santander Mastercard", "Registro") y horas oficiales en España.

**H-06 · YouTube RSS** · Could · R4 · S — vídeos de anuncio y visualizaciones como señal temprana.

**H-07 · Descubrimiento automático** · Should · R5 · L
Quiero que GIRA proponga giras de estadios/arenas muy populares de artistas que no sigo, para no
perderme lo grande.
- Dado un evento en un recinto de aforo ≥ 15.000 o un artista con popularidad por encima del
  umbral, entonces aparece en "Descubrir" con motivo ("estadio", "top Deezer", "ruido en prensa").

**H-08 · Calendarios deportivos** · Should · R6 · M — F1 (Jolpica), fútbol (football-data),
Grand Slams, UFC, PDC, Euroleague, LoL Worlds; JJOO LA 2028 como evento fijo.

**H-09 · Redes sociales (Apify)** · Could · R7 · M
Quiero leer las últimas publicaciones del top 30 de artistas en IG/TikTok/X con presupuesto fijo,
para captar teasers y anuncios antes que la prensa.
- El trabajo se detiene si el gasto del mes supera 3,50 $ (70 % del crédito).

### Épica E2 · Seguir

**H-10 · Lista semilla con IDs resueltos** · Must · R1 · M
Quiero cargar los ~100 artistas de referencia con sus IDs en Ticketmaster, MusicBrainz, Deezer y
Wikidata, para que las búsquedas no confundan homónimos.
- Cada artista tiene `mbid` y `tm_attraction_id`; los que no se resuelvan automáticamente quedan
  en una lista "por revisar" en vez de adivinarse.

**H-11 · `/seguir` y `/dejar` en Discord** · Should · R2 · S
**H-12 · Mis artistas con peso** · Should · R3 · S — niveles ⭐ (me interesa), ⭐⭐ (voy si
puedo), ⭐⭐⭐ (imprescindible: me puede despertar).
**H-13 · Seguir promotoras y recintos** · Could · R4 · S
**H-14 · Sugerencias** · Could · R5 · M — artistas parecidos (Vectorize/Last.fm similar).
**H-15 · Seguir competiciones y equipos** · Should · R6 · S

### Épica E3 · Entender

**H-20 · Ficha mínima** · Must · R1 · S — fecha, recinto, ciudad, país, enlace, estado.

**H-21 · Ficha de gira agregada** · Must · R2 · M
Quiero una ficha por gira con todas las fechas, aforo, límite de entradas, precios por zona,
enlaces por ticketera y fecha, para no ir web por web.
- Las fechas se agrupan por gira usando nombre del tour, artista y ventana temporal; si hay duda,
  se pregunta (`/gira unir`) en vez de fusionar a ciegas.

**H-22 · Historial de cambios** · Should · R2 · S — cada campo cambiado queda registrado
(antes → después, fuente, hora) y se ve en la ficha.

**H-23 · Ficha en la PWA** · Must · R3 · M

**H-24 · Escalera de certeza** · Must · R4 · M
- Rumor = 1 fuente no oficial · Probable = 2+ independientes o 1 medio de referencia ·
  Confirmado = fuente oficial (artista, promotora, recinto, ticketera) · A la venta · Agotado.
- Ningún aviso push sale de un "rumor" salvo artistas ⭐⭐⭐ y marcado como rumor.

**H-25 · Conflictos** · Should · R4 · S — si dos fuentes dan horas distintas, se muestran ambas
con aviso ⚠️ y gana la oficial.

**H-26 · Popularidad** · Should · R5 · M — Deezer `nb_fan`, Last.fm oyentes, YouTube vistas,
volumen de noticias; instantánea semanal y tendencia.

**H-27 · Índice de dificultad (0–100)** · Should · R5 · M
Quiero saber lo difícil que será conseguir entrada, para decidir cuánto esfuerzo poner.
- Combina demanda (popularidad, ruido), oferta (aforo × fechas), nº de preventas, historial de
  agotados del artista. Se muestra con nivel de confianza y los 3 factores principales.

**H-28 · Ficha deportiva** · Should · R6 · S
**H-29 · Pregunta a GIRA** · Could · R7 · M — "¿qué necesito para la preventa de U2 en Sevilla?"
responde citando la ficha; si no lo sabe, dice que no lo sabe.

### Épica E4 · Prepararme

**H-30 · Ventanas de venta** · Must · R1 · S
- Toda ventana (`sales.public`, `sales.presales[]`) se guarda en UTC y se muestra en Madrid y
  Reino Unido (y local si es otro huso).

**H-31 · Calendario de preventas en orden** · Must · R2 · S — Fan club → álbum → tarjetas
(VISA, Amex, Mastercard/Santander) → operadoras (O2, Three, Telekom) → promotora/ticketera →
recinto → general.

**H-32 · Requisitos por preventa** · Must · R2 · M — registro, código, tarjeta, cuenta, email;
fecha límite si existe.

**H-33 · Cartera de accesos** · Should · R3 · S
Quiero declarar qué tengo (tarjetas, cuentas de ticketeras, operadora, fan clubs), para que GIRA
me diga qué preventas puedo usar de verdad.
- Se guarda solo "tengo / no tengo" por tipo; **nunca** números de tarjeta, contraseñas ni cookies.

**H-34 · "¿Puedo entrar?"** · Should · R3 · S — cada preventa muestra ✅ puedo · ❌ me falta X ·
🛠 puedo conseguirlo antes de <fecha> (p. ej. unirse al fan club).

**H-35 · Registros abiertos** · Must · R4 · S — canal #registros-abiertos y fecha de cierre.
**H-36 · Precio oficial por zona** · Should · R5 · M
**H-37 · Sorteos y ventas de clubes/federaciones** · Should · R6 · S

### Épica E5 · Estar a la hora

**H-40 · Avisos en Discord** · Must · R1 · S — #nuevas-giras, #preventas, embeds con horas Madrid/UK.

**H-41 · Recordatorios exactos** · Must · R2 · M
- Para cada ventana de un artista seguido: T-24h (resumen), T-1h (push), T-10min (push crítico),
  T-0 ("abierta"). Programados con alarmas de Durable Object, precisión de segundos.
- Si la hora cambia, los recordatorios se reprograman y se avisa del cambio.

**H-42 · Resumen diario 21:00** · Must · R2 · S — #daily-release + push único.
**H-43 · Calendario `.ics`** · Must · R2 · S — URL secreta, con `VALARM`, un feed por categoría.

**H-44 · Push web con urgencia** · Must · R3 · M
- Fuera de 01:00–08:00: normal. Dentro: solo urgentes (venta < 1 h, sala de espera abierta,
  fecha extra de artista seguido). El resto se acumula para el resumen de las 08:00.

**H-45 · Resumen de la mañana 08:00** · Should · R3 · S
**H-46 · Aviso de registro que cierra** · Should · R4 · S — T-24h y T-2h del cierre.
**H-47 · Avisos de sorteo** · Should · R6 · S
**H-48 · Resumen en audio** · Could · R7 · S — 2 min con Gemini TTS, reproducible en la PWA.

### Épica E6 · Ejecutar (siempre el propietario)

**H-50 · Enlace correcto por fecha** · Must · R1 · S — enlace a la ficha oficial del evento
(nunca enlaces con `queueittoken` ni de terceros de reventa).

**H-51 · Hilo de foro por gira** · Must · R2 · M — foro "giras" con etiquetas (región, estado);
el primer mensaje es la ficha y se **edita** al cambiar; los cambios se publican como respuesta.

**H-52 · Modo Drop** · Should · R3 · M
- Se activa solo desde T-15 min o a mano: cuenta atrás, relojes, enlaces por fecha/ticketera,
  código guardado por el propietario, checklist propio, consejos oficiales. Sin ninguna acción
  automática sobre la ticketera.

**H-53 · Atajo de Siri** · Could · R7 · S — endpoint JSON con token personal; "Oye Siri, ¿qué sale
hoy en GIRA?".

### Épica E7 · Plan B

**H-60 · Probabilidad de fecha extra** · Should · R5 · M — baja/media/alta con motivos.
**H-61 · Mercado secundario (solo lectura)** · Could · R5 · L
- Viagogo/StubHub vía Apify con baja frecuencia (máx. 2 lecturas/semana por evento caliente).
- Por sección: mediana, P25–P75, descartar > 3×IQR y anuncios que no se mueven en días.
**H-62 · Estimación de reventa** · Should · R5 · M — oficial · mercado · modelo · confianza.
**H-63 · Reventa oficial** · Could · R7 · S — avisar cuando la ficha oficial muestre reventa
oficial disponible (lectura moderada, cada 15–30 min, solo eventos agotados seguidos).

### Épica E8 · Aprender

**H-70 · "Esto está mal"** · Should · R3 · S — corrige y baja la confianza de la fuente.
**H-71 · Diario de drops** · Should · R4 · S — resultado por ventana: detectada a tiempo / tarde
/ perdida; conseguí / no / no lo intenté; minutos hasta agotar.
**H-72 · Calibrar modelos** · Could · R5 · M
**H-73 · Aprender de 👍/👎** · Could · R7 · S — ajusta el peso de artistas y tipos de aviso.

### Épica E9 · Operar

**H-80 · Montar el servidor de Discord** · Must · R1 · M — idempotente: crea lo que falte, no
duplica, no borra lo que el propietario haya creado.
**H-81 · Deduplicación** · Must · R1 · S — clave natural por fuente + huella del contenido.
**H-82 · Horas de silencio** · Must · R1 · S — reglas en una función pura con tests.
**H-83 · Salud mínima** · Must · R1 · S — cada trabajo registra inicio, fin, resultado y cuota.
**H-84 · Presupuesto de cuotas** · Must · R2 · S — contador diario por servicio con freno al 80 %.
**H-85 · Passkey + sesión 1 año** · Must · R3 · M — registro solo una vez (después se cierra),
cookie `HttpOnly; Secure; SameSite=Strict`, `noindex`.
**H-86 · Panel de salud** · Should · R3 · S
**H-87 · Lectura moderada** · Must · R4 · M — cada 15–30 min, solo fichas de evento, respeta
`robots.txt` y 403/429 (retroceso exponencial y apagado automático).
**H-88 · Gasto Apify/IA** · Must · R5 · S — alarma al 60 %, corte al 70 % del presupuesto.
