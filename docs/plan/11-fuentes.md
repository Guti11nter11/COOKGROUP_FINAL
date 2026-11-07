# 11 · Fuentes de información (quién publica las preventas)

Medido el 2026-11-07 con Google News: ~1.900 artículos de los últimos 30, 180 y 365 días sobre preventas, puestas a la venta, registros y fechas extra, en 8 categorías. Datos completos en `data/news-sources.json`.

## Conclusión

- **Ningún medio basta.** El líder de cada categoría publica como mucho el 15–20 % de los artículos y la lista cambia con el tiempo (Marca, por ejemplo, es fuerte en fútbol pero no en conciertos).
- **Estrategia de GIRA (R4):** buscar **por entidad** (artista, festival, equipo) y **por categoría** en Google News para todos los medios a la vez, y leer directamente los feeds RSS de las fuentes oficiales o muy fiables. Un dato solo se confirma con fuente oficial o con 2+ medios independientes.
- **Fuentes oficiales** (prioridad máxima): blog de Ticketmaster España (RSS), discover.ticketmaster.co.uk / .com.au, Live Nation de cada país, webs oficiales de giras (p. ej. ateezlive.com, rush.com/sphere), Weverse (K-pop), clubes y organizadores (Madring, UEFA, NFL).

## Medios más activos por categoría (últimos 12 meses)

**Música · España:** europafm.com (69), los40.com (45), infobae.com (27), elpais.com (12), abc.es (8), modofestival.es (8), elmundo.es (7), elfinanciero.com.mx (6), blog.ticketmaster.es (6), 20minutos.es (5), heraldo.es (5), lavanguardia.com (4).

**Deporte · España:** goal.com (24), madring.com (15), marca.com (14), dazn.com (9), as.com (7), mundodeportivo.com (6), rccelta.es (6), granadacf.es (6), 20minutos.es (6), realsporting.com (5), udalmeriasad.com (5), infobae.com (5).

**Música · Reino Unido:** timeout.com (31), scotsman.com (23), syracuse.com (18), radiotimes.com (14), virginmedia.com (12), grimygoods.com (9), discover.ticketmaster.com.au (9), nme.com (9), discover.ticketmaster.co.uk (8), capitalfm.com (7), holler.country (6), cleveland.com (5).

**Deporte · Reino Unido:** thesun.co.uk (16), goal.com (16), dartsnews.com (11), mirror.co.uk (8), uefa.com (7), dazn.com (5), radiotimes.com (5), arsenal.com (5), dartsplanet.tv (5), sports.yahoo.com (4), bbc.com (4), standard.co.uk (4).

**Música · Italia:** teamworld.it (30), tg24.sky.it (10), allmusicitalia.it (10), rockol.it (8), virginradio.it (7), rollingstone.it (7), eventiatmilano.it (6), acmonza.com (6), vivoconcerti.com (6), radioitalia.it (6), metalitalia.com (5), ilrestodelcarlino.it (5).

**Música · Francia:** sortiraparis.com (21), infoconcert.com (14), ouest-france.fr (8), leparisien.fr (5), karlobag.eu (5), jds.fr (4), nrj.fr (4), lavoixdunord.fr (3), info-lux.com (3), mesinfos.fr (3), rtl2.fr (2), parismatch.com (2).

**Música · Portugal:** expresso.pt (17), magazine-hd.com (10), sicnoticias.pt (7), rfm.pt (6), nit.pt (6), jn.pt (4), sortiraparis.com (4), cnnportugal.iol.pt (4), radiocomercial.pt (3), noticiasaominuto.com (3), ingresso.com (3), rtp.pt (3).

**Música · EE. UU.:** syracuse.com (39), grimygoods.com (26), cleveland.com (13), weverse.io (10), holler.country (7), blog.ticketmaster.com (6), ticketnews.com (5), brobible.com (5), news.pollstar.com (4), rollingstone.com (3), nypost.com (3), yahoo.com (3).

## Señales tempranas además de la prensa

| Señal | Ejemplo real (2026-11-07) | Cómo se lee |
|---|---|---|
| Páginas de registro de Ticketmaster / Live Nation | `signup.ticketmaster.com/noahkahan`, `signup.livenation.com/gracieabrams` | 403 a servidores → Cloudflare Browser Run en R4 |
| Webs oficiales de gira | `ateezlive.com`, `rush.com/sphere` | Lectura directa (200) |
| Laylo (drops de artistas) | `laylo.com/oliviadeano/...` | Página dinámica → Browser Run |
| Discovery Feed de Ticketmaster | Catálogo completo por país cada hora (FR incluido) | Job `Radar Discovery Feed` |
| Instagram oficial de ticketeras | `@meoblueticket` con "Venda geral: 13 de novembro, às 10h00" | Apify / Meta Business Discovery |
