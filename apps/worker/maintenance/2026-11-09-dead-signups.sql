-- Quitar registros de países no cubiertos o caducados (Bruno Mars: signup de Ticketmaster Australia que ya no existe).
DELETE FROM artist_signup WHERE url LIKE '%.com.au/%' OR url LIKE '%.co.nz/%' OR url LIKE '%.jp/%' OR url LIKE '%.com.sg/%';
SELECT a.name, s.url FROM artist_signup s JOIN artist a ON a.id = s.artist_id ORDER BY a.name;
