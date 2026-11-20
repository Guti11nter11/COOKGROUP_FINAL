-- Revisión 17:47 del 20-11 (b): aforo erróneo del casino Talking Stick Resort (tomaba el del pabellón de Phoenix)
UPDATE venue_info SET capacity = NULL, wikidata_id = NULL, checked_at = '2026-11-20T17:30:00Z' WHERE name = 'Talking Stick Resort' AND country = 'US';
-- Noticias de artistas de una estrella en las últimas 12 h: solo valen si mencionan España (solo metadatos)
SELECT n.artist_name, n.category, (lower(n.title || ' ' || n.summary) LIKE '%españa%' OR lower(n.title || ' ' || n.summary) LIKE '%spain%' OR lower(n.title || ' ' || n.summary) LIKE '%madrid%' OR lower(n.title || ' ' || n.summary) LIKE '%barcelona%') AS menciona_espana FROM news n JOIN follow f ON f.artist_id = n.artist_id WHERE f.tier = 1 AND n.created_at >= '2026-11-20T04:45:00Z';
-- Nombre del evento de The Strokes en París (¿festival?)
SELECT json_extract(s.snapshot_json, '$.name') AS evento, s.local_date FROM show s JOIN artist a ON a.id = s.artist_id WHERE a.name = 'The Strokes' AND s.country = 'FR';
