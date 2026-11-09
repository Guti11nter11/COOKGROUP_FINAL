-- Canales creados por error por promociones de eventos ya a la venta ("Holiday Gift Guide", "Day of
-- Show", "Holiday Offer"): tracked_sale = 0 → el Worker los borra (no los archiva) al ver que no tienen
-- ventas por llegar. Se marcan pendientes para que el próximo repaso lo haga.
UPDATE sheet SET tracked_sale = 0 WHERE artist_id IN (SELECT id FROM artist WHERE name IN ('Hunxho', 'Scott Bradlee''s Postmodern Jukebox', 'Harlem Globetrotters'));
INSERT OR IGNORE INTO sheet_dirty (artist_id, since) SELECT artist_id, '2026-11-09T09:00:00Z' FROM sheet WHERE status = 'active';
SELECT a.name, h.tracked_sale FROM sheet h JOIN artist a ON a.id = h.artist_id WHERE h.status = 'active' ORDER BY a.name;
