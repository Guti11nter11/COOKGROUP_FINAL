-- Comprobación tras activar EE. UU. (solo lectura): avisos de hoy por país y fechas guardadas por país.
SELECT json_extract(payload_json, '$.show.venue.country') AS pais, kind, COUNT(*) AS n FROM alert WHERE created_at >= '2026-11-09T00:00:00Z' GROUP BY 1, 2 ORDER BY n DESC;
SELECT country, COUNT(*) AS fechas FROM show WHERE local_date >= '2026-11-09' GROUP BY country ORDER BY fechas DESC LIMIT 12;
SELECT a.name, h.status FROM sheet h JOIN artist a ON a.id = h.artist_id WHERE h.status = 'active' ORDER BY h.updated_at DESC;
