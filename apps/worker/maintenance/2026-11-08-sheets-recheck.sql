-- Revisar todos los canales creados: los que no tienen ninguna venta por llegar se borran.
INSERT OR IGNORE INTO sheet_dirty (artist_id, since) SELECT artist_id, '2026-11-07T23:00:00Z' FROM sheet;
SELECT COUNT(*) AS fichas_pendientes FROM sheet_dirty;
SELECT COUNT(*) AS canales FROM sheet;
