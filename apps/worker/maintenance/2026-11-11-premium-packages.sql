-- Entradas premium, palcos (Suite/Logen) y paquetes de viaje guardados como fechas normales: pasan a accesorias
UPDATE show SET is_package = 1 WHERE is_package = 0 AND (lower(json_extract(snapshot_json, '$.name')) LIKE '%premium%' OR lower(json_extract(snapshot_json, '$.name')) LIKE '%suite%' OR lower(json_extract(snapshot_json, '$.name')) LIKE '%logen%' OR lower(json_extract(snapshot_json, '$.name')) LIKE '%meet & greet%' OR json_extract(snapshot_json, '$.url') LIKE '%queue-it%');
INSERT OR IGNORE INTO sheet_dirty (artist_id, since) SELECT artist_id, '2026-11-11T19:30:00Z' FROM sheet WHERE status = 'active';
SELECT COUNT(*) AS accesorias FROM show WHERE is_package = 1;
