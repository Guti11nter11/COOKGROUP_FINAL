-- Ascenso (25-11): los ⭐ con fechas futuras en recintos de >= 15.000 suben a ⭐⭐ y se regenera su ficha (misma regla que promoteBigTours)
INSERT OR IGNORE INTO sheet_dirty (artist_id, since) SELECT DISTINCT s.artist_id, '2026-11-25T19:45:00Z' FROM show s JOIN follow f ON f.artist_id = s.artist_id JOIN venue_info v ON v.tm_venue_id = json_extract(s.snapshot_json, '$.venue.tmId') WHERE f.tier = 1 AND s.local_date >= '2026-11-25' AND s.is_package = 0 AND v.capacity >= 15000;
UPDATE follow SET tier = 2 WHERE tier = 1 AND artist_id IN (SELECT DISTINCT s.artist_id FROM show s JOIN venue_info v ON v.tm_venue_id = json_extract(s.snapshot_json, '$.venue.tmId') WHERE s.local_date >= '2026-11-25' AND s.is_package = 0 AND v.capacity >= 15000);
SELECT a.name FROM follow f JOIN artist a ON a.id = f.artist_id WHERE a.name IN ('Steve Lacy', 'Chase Atlantic') AND f.tier = 2;
SELECT COUNT(*) AS pendientes FROM sheet_dirty;
