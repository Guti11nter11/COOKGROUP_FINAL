-- Revisión 17:47 del 24-11 (d): republicar la ficha de U2 con las preventas de U2.com agrupadas
INSERT OR IGNORE INTO sheet_dirty (artist_id, since) SELECT id, '2026-11-24T17:45:00Z' FROM artist WHERE name = 'U2';
