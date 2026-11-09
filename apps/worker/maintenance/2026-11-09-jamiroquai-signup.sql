-- Registro de la Artist Presale de Jamiroquai (tienda oficial tmstor.es: compra/reserva del disco → código).
INSERT OR IGNORE INTO artist_signup (artist_id, url, label, city, local_date, found_at)
SELECT id, 'https://jamiroquai.tmstor.es/11637', 'Tienda oficial (código de preventa)', NULL, NULL, '2026-11-09T08:30:00Z' FROM artist WHERE name = 'Jamiroquai';
INSERT OR IGNORE INTO sheet_dirty (artist_id, since) SELECT id, '2026-11-09T08:30:00Z' FROM artist WHERE name = 'Jamiroquai';
SELECT a.name, s.url, s.label FROM artist_signup s JOIN artist a ON a.id = s.artist_id WHERE a.name = 'Jamiroquai';
