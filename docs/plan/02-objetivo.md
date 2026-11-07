# 02 · Objetivo, principios y cómo sabremos que funciona

## La frase

> **GIRA hace que el propietario nunca se entere tarde de una preventa que le importa, y que llegue
> a cada una sabiendo exactamente qué necesita, a qué hora (Madrid) y por dónde se entra.**

Sustituye la parte de información de Akari (~75 €/mes) por 0 €, y la mejora en tres cosas que un
cook group de pago no puede hacer: está **personalizado** (sabe qué tarjetas, cuentas y fan clubs
tiene el propietario), es **explicable** (cada dato lleva su fuente y su grado de certeza) y
**aprende** de cada preventa.

## Persona única

**El propietario.** Vive en Madrid, iPhone, habla español. Quiere entradas para conciertos y grandes
eventos de cualquier país. Duerme de 01:00 a 08:00. No quiere ruido: prefiere 5 avisos buenos a 50
mediocres. Revisa el móvil en ratos sueltos y quiere decidir en 10 segundos si algo le importa.

No hay segundo usuario. Todo lo que exista "para otros" (servidor de Discord, calendario) es para
el propietario en otro canal.

## Trabajos que GIRA hace por él (Jobs To Be Done)

1. **Enterarme** de que algo sale (gira nueva, fecha extra, festival, final deportiva) en cuanto
   haya una señal fiable, aunque sea un rumor bien fundado.
2. **Entender** la gira de un vistazo: fechas, recintos, aforo, precios, límite de entradas,
   ticketeras, y lo difícil y caro que va a ser.
3. **Prepararme**: qué preventas hay, en qué orden, cuáles puedo usar yo, qué tengo que hacer antes
   (registrarme, conseguir código, tener la tarjeta), con fecha límite.
4. **Estar a la hora**: avisos en el momento justo, también de madrugada si es urgente.
5. **Ejecutar yo mismo** con todo a mano: enlaces correctos por fecha y ticketera, relojes de
   Madrid/Reino Unido/hora local, checklist. *GIRA nunca compra ni toca la cola.*
6. **Plan B**: si se agota, saber si habrá fecha extra, si hay reventa oficial y cuánto cuesta en el
   mercado secundario (solo como referencia).
7. **Aprender**: qué pasó en cada preventa para hacerlo mejor la próxima vez.

## Principios de producto (deciden los empates)

1. **Hora de Madrid primero.** Toda hora se muestra en Europe/Madrid; al lado, Reino Unido y hora
   local del evento. Las horas se guardan en UTC.
2. **Cada dato con procedencia.** Ningún dato sin fuente. Si dos fuentes discrepan, se muestran
   las dos y se avisa.
3. **Certeza explícita.** Escalera: `rumor → probable → confirmado → a la venta → agotado`. Nunca se
   presenta un rumor como confirmado.
4. **Silencio por defecto, urgencia por excepción.** Horas de silencio 01:00–08:00 salvo urgencias
   (preventa o venta en < 1 h, sala de espera abierta, fecha extra de un artista seguido).
5. **Accionable o nada.** Un aviso dice qué hacer y cuándo; si no hay acción, va al resumen diario.
6. **Solo información.** Nada de compra automática, bots, saltar colas, compartir `queueittoken`,
   cookies o cuentas, ni bypass de antibots. Leer webs con moderación y respetando bloqueos.
7. **0 € y dentro de las capas gratuitas**, con presupuesto de cuotas medido (ver arquitectura).
8. **Privado.** La PWA es solo del propietario (passkey), `noindex`, nunca pública.

## No-objetivos

- Viajes, vuelos, hoteles, transporte.
- Compra, reserva o cualquier automatización dentro de una ticketera.
- Reventa: GIRA no compra ni vende; el mercado secundario solo se lee como referencia de precio.
- Reddit (hasta que haya acceso oficial aprobado). Setlist.fm. Spotify.
- Usar cuentas, cookies o sesiones personales del propietario en redes sociales.

## Métricas (cómo sabremos que funciona)

| Métrica | Definición | Objetivo Fase 1 (Europa) |
|---|---|---|
| **Cobertura de preventas** ⭐ | % de ventanas de venta de artistas seguidos que GIRA conocía antes de que empezaran | ≥ 90 % |
| **Antelación** | Mediana de horas entre la primera detección y el inicio de la ventana | ≥ 48 h |
| **Avisos urgentes perdidos** | Ventanas "urgentes" sin aviso a tiempo | 0 por mes |
| **Precisión** | % de avisos que el propietario no marca como erróneos | ≥ 95 % |
| **Ruido** | Notificaciones push por día (media semanal) | ≤ 6 |
| **Despertares** | Push entre 01:00 y 08:00 | Solo urgentes, ≤ 2 por semana |
| **Frescura** | Retraso entre publicación en Ticketmaster y aviso | ≤ 10 min (⭐⭐⭐) / ≤ 25 min (resto) |
| **Coste** | € al mes | 0 € (Apify < 5 $) |
| **Salud** | Fuentes con último éxito < 2× su periodo | 100 % de las críticas |

**Regla de cambio de fase:** se pasa a la siguiente región cuando la anterior cumple las métricas
⭐ durante **4 semanas seguidas**. La medición la hace el propio GIRA con el *Diario de drops*
(cada ventana real se marca como detectada a tiempo / tarde / perdida).

## Fuera de alcance pero vigilado

- Cambios en las condiciones de uso de fuentes (si una fuente prohíbe la lectura, se apaga).
- Coste de Apify y de la IA: alarma al 60 % del presupuesto mensual.
