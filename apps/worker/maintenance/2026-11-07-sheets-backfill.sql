-- Arranque de los canales por artista (migración 0005).
-- 1) Los avisos acumulados durante la pausa no se envían (serían antiguos).
UPDATE delivery SET status = 'failed', last_error = 'acumulado en pausa' WHERE status IN ('pending', 'sending');
-- 2) Todos los artistas con fechas futuras pasan a "ficha pendiente": publishSheets crea su canal
--    solo si tienen ventas por llegar.
INSERT OR IGNORE INTO sheet_dirty (artist_id, since)
  SELECT DISTINCT artist_id, '2026-11-07T23:00:00Z' FROM show WHERE local_date >= '2026-11-08' AND is_package = 0;
-- 3) Diagnóstico.
SELECT COUNT(*) AS fichas_pendientes FROM sheet_dirty;
SELECT a.name, COUNT(*) AS fechas FROM show s JOIN artist a ON a.id = s.artist_id
  WHERE s.local_date >= '2026-11-08' AND s.is_package = 0 GROUP BY a.name ORDER BY fechas DESC LIMIT 40;
SELECT a.name, COUNT(*) AS fechas FROM show s JOIN artist a ON a.id = s.artist_id
  WHERE s.local_date >= '2026-11-08' AND a.name LIKE 'U2%' GROUP BY a.name;
