-- Canales creados por error por entradas de día del Graspop (festival ajeno): tracked_sale = 0 → el Worker los borra.
UPDATE sheet SET tracked_sale = 0 WHERE artist_id IN (SELECT id FROM artist WHERE name IN ('Evanescence', 'blink-182', 'Mötley Crüe'));
INSERT OR IGNORE INTO sheet_dirty (artist_id, since) SELECT id, '2026-11-11T09:00:00Z' FROM artist WHERE name IN ('Evanescence', 'blink-182', 'Mötley Crüe');
SELECT a.name, h.status, h.tracked_sale FROM sheet h JOIN artist a ON a.id = h.artist_id WHERE a.name IN ('Evanescence', 'blink-182', 'Mötley Crüe');
