-- Listados de paquetes con guion guardados como fechas normales (RAYE · BST Hyde Park · Ultimate Bar Packages): pasan a accesorios; su canal se creó por error y se borra
UPDATE show SET is_package = 1 WHERE is_package = 0 AND (json_extract(snapshot_json, '$.name') LIKE '% - %Package%' OR json_extract(snapshot_json, '$.name') LIKE '% - %VIP%');
UPDATE sheet SET tracked_sale = 0 WHERE artist_id IN (SELECT id FROM artist WHERE name = 'RAYE') AND status = 'active';
INSERT OR IGNORE INTO sheet_dirty (artist_id, since) SELECT id, '2026-11-18T17:30:00Z' FROM artist WHERE name = 'RAYE';
SELECT a.name, h.status, h.tracked_sale FROM sheet h JOIN artist a ON a.id = h.artist_id WHERE a.name = 'RAYE';
