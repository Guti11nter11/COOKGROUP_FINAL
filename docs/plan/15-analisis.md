# 15 · Análisis de necesidades y correcciones (8 de noviembre de 2026)

Revisión de lo que hay frente a lo que pide el propietario: conseguir entradas, saber qué sale,
cuándo, dónde registrarse y cómo entrar, con coste mínimo (≤ 1 $/día).

## Lo que pide y cómo está

| Necesidad | Estado | Notas |
|---|---|---|
| Saber qué gira sale (Europa) | ✅ | Ticketmaster (API ⭐⭐⭐ + catálogo de 20 países 11 veces/día), descubrimiento por alta demanda, prensa 6 veces/día, AXS, Blueticket, Instagram de los ⭐⭐⭐ |
| Cuándo es cada preventa (hora España y UK) | ✅ | Ficha por artista con bloques por preventa y hora, y hasta cuándo dura |
| Dónde registrarse / cómo entrar | ✅ | Programas conocidos (Mastercard, O2, MOJO, Live Nation…) y enlaces de la web oficial por fecha |
| Precios, aforo, reventa, dificultad | ✅ / 🟡 | Precios dependen de prensa; reventa con mercado real solo si hay precio oficial del mismo país |
| No perderse una preventa | ✅ | Recordatorios 24 h / 1 h / 10 min (agrupados por artista), resúmenes 21:00 y 08:00, calendario `.ics`, push |
| Nada del pasado | ✅ | Canal solo con ventas por llegar; la ficha se revisa cada 15 min en franja |
| Coste ≤ 1 $/día | ✅ | Apify con freno diario; lo demás en planes gratuitos |
| Horario por franjas | ✅ | Nada 00–08; cada 10 min 08:30–14:30 y 16:00–21:30 |

## Correcciones hechas hoy

- Recordatorios agrupados (RAYE tenía 4 preventas a la misma hora → 4 mensajes; ahora 1).
- Reventa: RAYE salía ×6–×9,5 al comparar con un precio suelto de prensa; ahora solo se compara con
  un precio oficial del mismo país con rango o zonas, y se descartan multiplicadores imposibles.
- Trabajos lanzados por el Worker a horas fijas (GitHub se saltaba la mayoría).
- Eventim Alemania y TicketOne Italia añadidas al lector de ticketeras.
- Instagram oficial de los artistas ⭐⭐⭐ (fase R7) dentro del presupuesto: 28 cuentas localizadas en
  MusicBrainz; primera pasada, 8 publicaciones de las últimas 24 h y 1 accionable.

### Por la tarde (tras revisar la vista previa de las fichas y las noticias del día)

- Instagram: la IA a veces cruzaba publicaciones (una de Blueticket sobre Amon Amarth salió como
  "Metallica"). Ahora lo que devuelve tiene que encajar con la cuenta: en la de un artista, solo
  avisos del propio artista; en una ticketera, el artista tiene que aparecer en el texto.
- Noticias y redes: fuera ofertas de hotel, paquetes y hospitality (Wimbledon, dardos…). Las ya
  guardadas se han borrado.
- Historial de reventa: solo datos que nombran al artista (salía una ley de Massachusetts en Noah
  Kahan) y sin frases cortadas a media palabra.
- Mercado de reventa de otro país (U2 en São Paulo): ahora se marca "otro país, para comparar".
- Revisado: The Game tiene canal porque está en la lista semilla (⭐) y vende el lunes 9.

## Gasto real de hoy

Apify, a las 13:30: **0,08 $** (dos pasadas de redes con 29 cuentas incluidas). Ayer 1,43 $ por las
pruebas del primer día. Todo lo demás, 0 €.

## Lo que falta o conviene vigilar

| Tema | Prioridad | Qué haría |
|---|---|---|
| Alta de la app en el iPhone | Alta (tuya) | Enlace en #estado; sin ella no hay notificaciones push |
| Browser Run sin cupo hoy | Media | Las pruebas de anoche agotaron el cupo; el límite parece una ventana de 24 h. Si se repite, bajar a 3 artistas por pasada |
| Cachés de Actions por rama | Baja | Los estados guardados en la rama de trabajo no los ve la rama principal: la primera pasada de cada trabajo en la principal vuelve a ser línea base (sin avisos falsos, solo sin novedades esa vez) |
| Sala de espera / stock (formato Akari) | Media | No se puede leer la cola sin tocarla (prohibido). Alternativa: noticias e Instagram cuando una venta "se agota" o "abre la cola" |
| El Corte Inglés, DICE | Baja | Bloquean o lo piden en robots.txt: se respeta; llegan por prensa |
| Fnac, Ticketportal, Vivaticket | Baja | Menos grandes giras; valorar si aparece un caso real |
| Fase 2 (EE. UU.) | Cuando lo digas | El horario 16:00–21:30 ya está; faltaría añadir EE. UU. al barrido y al catálogo |
