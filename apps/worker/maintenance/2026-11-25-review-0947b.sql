-- Revisión 09:47 del 25-11 (b): concierto de otro artista en la ficha de The Cardigans (solo metadatos)
SELECT s.source_id, json_extract(s.snapshot_json, '$.name') AS evento, json_extract(s.snapshot_json, '$.attractionIds') AS artistas, a.tm_attraction_id AS el_artista FROM show s JOIN artist a ON a.id = s.artist_id WHERE a.name = 'The Cardigans' AND s.local_date = '2027-06-19';
