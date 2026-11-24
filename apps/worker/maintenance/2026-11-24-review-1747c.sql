-- Revisión 17:47 del 24-11 (c): republicar la ficha de U2 sin las fechas duplicadas
INSERT OR IGNORE INTO sheet_dirty (artist_id, since) SELECT id, '2026-11-24T17:30:00Z' FROM artist WHERE name = 'U2';
