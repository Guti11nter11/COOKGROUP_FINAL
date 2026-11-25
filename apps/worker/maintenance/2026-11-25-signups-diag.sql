-- Diagnóstico de registros (25-11): por qué no salieron Steve Lacy, Charli XCX y Chase Atlantic (solo metadatos)
SELECT a.name, a.id, a.tm_attraction_id, a.homepage, f.tier, (SELECT status FROM sheet WHERE artist_id = a.id) AS ficha FROM artist a LEFT JOIN follow f ON f.artist_id = a.id WHERE a.name IN ('Steve Lacy', 'Charli XCX', 'Chase Atlantic');
SELECT a.name, s.country, s.local_date, json_extract(s.snapshot_json, '$.venue.name') AS recinto, s.first_seen_at, json_extract(j.value, '$.label') AS venta, json_extract(j.value, '$.startsAt') AS sale FROM show s JOIN artist a ON a.id = s.artist_id, json_each(s.snapshot_json, '$.sales') j WHERE a.name IN ('Steve Lacy', 'Charli XCX', 'Chase Atlantic') AND s.local_date >= '2026-11-25' ORDER BY a.name, s.local_date LIMIT 60;
SELECT a.name, s.label, s.url, s.found_at FROM artist_signup s JOIN artist a ON a.id = s.artist_id WHERE a.name IN ('Steve Lacy', 'Charli XCX', 'Chase Atlantic');
SELECT n.artist_name, n.category, substr(n.created_at, 1, 16) AS cuando, n.source FROM news n WHERE n.artist_name IN ('Steve Lacy', 'Charli XCX', 'Chase Atlantic') AND n.created_at >= '2026-11-10' ORDER BY n.created_at DESC LIMIT 20;
SELECT s.label, COUNT(*) AS n FROM artist_signup s GROUP BY s.label ORDER BY n DESC LIMIT 30;
SELECT COUNT(DISTINCT artist_id) AS artistas_con_registro FROM artist_signup;
