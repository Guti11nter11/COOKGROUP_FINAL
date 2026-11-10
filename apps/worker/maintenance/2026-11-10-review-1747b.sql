-- Revisión 17:47 (10-11), parte 2. Quita el archivo de calendario de Bryan Adams (no es un registro) y limpia la etiqueta
DELETE FROM artist_signup WHERE url LIKE '%add-to-calendar%' OR url LIKE '%.ics';
UPDATE artist_signup SET label = 'Join the mailing list' WHERE url = 'https://www.bryanadams.com/mailing-list';
INSERT OR IGNORE INTO sheet_dirty (artist_id, since) SELECT id, '2026-11-10T17:00:00Z' FROM artist WHERE name = 'Bryan Adams';
