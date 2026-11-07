# 08 · Ideas innovadoras (lo que un cook group no hace)

Cada idea con valor (V), esfuerzo (E) y entrega donde encaja. Todas respetan los límites: solo
información, el propietario siempre compra.

## Las 5 que cambian el juego

### 1. Cartera de accesos + "¿Puedo entrar?" — V alto · E bajo · R3
Akari publica *todas* las preventas; GIRA sabe cuáles **puede usar el propietario**. Declara una vez
(sí/no) qué tiene: Amex, VISA, Mastercard Santander, O2/Three/Vodafone, cuentas de Ticketmaster
ES/UK, Live Nation, Eventim, Dice, fan clubs. Cada preventa sale como ✅ / ❌ te falta X /
🛠 "puedes conseguirlo antes del jueves" (unirte al fan club, registrarte). Convierte una lista de
10 preventas en "tus 3 oportunidades reales".

### 2. Reloj de preventas (Durable Object) + Modo Drop — V alto · E medio · R2–R3
Recordatorios con precisión de segundos (no de 5 minutos) y una pantalla de "hora cero" con cuenta
atrás, tres relojes, enlaces correctos por fecha, el código que guardó el propietario y su
checklist. La pantalla no se apaga (Wake Lock).

### 3. Escalera de certeza con procedencia — V alto · E medio · R4
Cada dato dice de dónde sale y cuánto fiarse: `rumor → probable → confirmado → a la venta →
agotado`. Historial de cambios tipo "git de la gira" (*"Amex: 10:00 → 09:00 · fuente Live Nation
ES · hace 2 h"*). Las discrepancias se ven, no se esconden.

### 4. Plan B cuantificado — V alto · E alto · R5
Cuando algo se agota: **probabilidad de fecha extra** (demanda vs. aforo, patrón histórico del
artista, registro masivo, recinto con fechas libres), **reventa oficial** si existe y **precio de
mercado** robusto (mediana, P25–P75, filtro 3×IQR, anuncios congelados fuera). Ayuda a no pagar 3×
el día del agotado si lo probable es una segunda fecha.

### 5. Diario de drops que calibra el sistema — V alto · E bajo · R4–R5
Una pregunta de un toque tras cada preventa ("¿conseguiste?") + la hora de agotado. GIRA mide su
propia cobertura y antelación (la métrica que decide si se pasa de región) y recalibra dificultad y
fecha extra. Es lo que hace que GIRA mejore con el tiempo.

## Más ideas, ordenadas por valor/esfuerzo

| # | Idea | V | E | Entrega |
|---|---|---|---|---|
| 6 | **Discord: foro de giras** (un hilo por gira, etiquetas de región/estado) en vez de canales: esquiva el límite de 500 canales y queda ordenado | Alto | Bajo | R2 |
| 7 | **Eventos programados de Discord** para preventas ⭐⭐⭐: recordatorio nativo de Discord gratis | Medio | Bajo | R2 |
| 8 | **Resumen de la mañana (08:00)** con todo lo que pasó de noche sin despertar | Alto | Bajo | R3 |
| 9 | **Despachador puntual**: el Worker dispara los workflows de Actions a la hora exacta (adiós retrasos de 30 min y apagado a los 60 días) | Alto | Bajo | R2 |
| 10 | **Extractor de prensa española** con citas literales: la prensa española publica "cuándo sale la preventa y dónde registrarse" de cada gira grande | Muy alto | Medio | R4 |
| 11 | **Índice de dificultad 0–100** con sus 3 motivos principales | Alto | Medio | R5 |
| 12 | **Pregunta a GIRA** (PWA y `/pregunta`): respuestas citando la ficha; si no lo sabe, lo dice | Medio | Medio | R7 |
| 13 | **Resumen en audio de 2 min** con Gemini TTS (ya disponible en la cuenta), para escuchar con cascos | Medio | Bajo | R7 |
| 14 | **Atajo de Siri / Atajos de iOS** contra un endpoint JSON privado: "¿qué sale hoy?" | Medio | Bajo | R7 |
| 15 | **Mapa de giras** (globo/mapa) para ver dónde caen las fechas y elegir qué preventa atacar (sin planificar viajes) | Medio | Medio | R5 |
| 16 | **Calendario con mapa de calor** de la semana de drops | Medio | Bajo | R3 |
| 17 | **Descubrimiento por similitud** (Vectorize + Last.fm similar): "si sigues a Olivia Dean, Raye anuncia gira" | Medio | Medio | R5 |
| 18 | **Detector de teasers**: cambios de foto de perfil, posts crípticos, cuentas atrás en webs oficiales, vídeos de anuncio en YouTube RSS | Medio | Medio | R7 |
| 19 | **Buzón de preventas** (Cloudflare Email Routing): el propietario reenvía los emails de registro/códigos y GIRA los adjunta a la preventa correcta | Alto | Medio | Opcional (requiere dominio, ~10 €/año) |
| 20 | **Panel de salud con autodiagnóstico**: si una fuente falla 3 veces, se apaga sola, avisa en #estado y propone el arreglo | Alto | Bajo | R3 |
| 21 | **Modo festival**: cartel por días, abonos vs. entradas de día, fases de precio (early bird → fase 2) con aviso al cambiar de fase | Medio | Medio | R5 |
| 22 | **Huella de cambios de precio oficial** (dynamic pricing) por zona y momento | Medio | Medio | R5 |

## Ideas descartadas a propósito

- Cualquier cosa que toque la cola o la compra (auto-refresh, rellenar formularios, compartir
  enlaces de cola): fuera de los límites.
- Leer redes con las cuentas del propietario: prohibido por el brief.
- Live Activities / widgets nativos: no existen para PWA en iOS; el atajo de Siri cubre parte.
- Reddit: vetado hasta tener acceso oficial.
