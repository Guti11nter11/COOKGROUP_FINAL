# Glosario de GIRA

Términos del dominio. El código usa el nombre en inglés entre paréntesis.

| Término | Significado |
|---|---|
| **Artista** (`artist`) | Persona o grupo. Identificado por MBID de MusicBrainz y `attractionId` de Ticketmaster. |
| **Seguimiento** (`follow`) | Interés del propietario en un artista o competición, con nivel ⭐ (me interesa), ⭐⭐ (voy si puedo), ⭐⭐⭐ (imprescindible: puede despertarme). |
| **Gira** (`tour`) | Conjunto de fechas de un artista bajo un mismo anuncio. |
| **Fecha** / **show** (`show`, `event`) | Una actuación concreta: artista + recinto + día local. Clave natural: `attractionId:venueId:fechaLocal`. |
| **Fecha extra** (`extra_date`) | Fecha nueva de una gira ya conocida en el mismo país. No lo es una variante comercial (paquetes VIP) de una fecha existente. |
| **Variante** (`isPackage`) | Evento duplicado por la ticketera para vender paquetes (VIP, hospitality) de la misma fecha. |
| **Ventana de venta** (`sale_window`) | Intervalo en el que se puede comprar o registrarse: preventa, venta general, registro, sorteo o reventa oficial. Tiene un tipo (`kind`). |
| **Preventa** | Ventana de venta anterior a la general, restringida (fan club, tarjeta, operadora, promotora…). |
| **Registro** (`registration`) | Ventana para apuntarse a una preventa futura; no permite comprar. |
| **Requisito** (`requirement`) | Lo que hace falta para usar una ventana: registro, código, tarjeta, cuenta, email. |
| **Cartera de accesos** (`wallet_item`) | Lo que el propietario declara tener (sí/no): tarjetas, operadora, cuentas, fan clubs. |
| **Señal** (`signal`) | Elemento crudo recibido de una fuente. |
| **Afirmación** (`claim`) | Dato extraído de una señal, con cita literal, fuente y confianza. |
| **Certeza** (`certainty`) | Escalera rumor → probable → confirmado → a la venta → agotado. |
| **Aviso** (`alert`) | Algo que merece comunicarse; tiene urgencia y clave de deduplicación. |
| **Entrega** (`delivery`) | Envío de un aviso por un canal (push, Discord, .ics). |
| **Horas de silencio** | 01:00–08:00 Europe/Madrid: solo avisos urgentes. |
| **Urgente** | Venta/preventa en < 60 min, sala de espera abierta, o fecha extra de un artista seguido. |
| **Reloj** | Durable Object que dispara recordatorios a la hora exacta. |
| **Modo Drop** | Pantalla de la PWA para la hora cero de una ventana. |
| **Diario de drops** (`drop_log`) | Registro de cada ventana real: si GIRA avisó a tiempo y qué pasó. |
| **Dificultad** | Índice 0–100 de lo difícil que será conseguir entrada. |
| **Barrido** (`sweep`) | Consulta periódica a Ticketmaster de un lote de artistas. |
| **Arranque** (`bootstrap`) | Primera vez que se ve un artista: se guarda sin avisar. |
