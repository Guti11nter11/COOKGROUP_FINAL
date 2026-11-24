-- Revisión 17:47 del 24-11 (e): republicar la ficha de U2 (venta general de relleno y errata I2.com)
INSERT OR IGNORE INTO sheet_dirty (artist_id, since) SELECT id, '2026-11-24T18:00:00Z' FROM artist WHERE name = 'U2';
