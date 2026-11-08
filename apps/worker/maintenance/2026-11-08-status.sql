-- Estado tras la noche de trabajo: canales, precios, aforos, registros, reventa y noticias.
SELECT a.name, s.status, s.tracked_sale, json_array_length(s.message_ids) AS mensajes FROM sheet s JOIN artist a ON a.id = s.artist_id ORDER BY s.status, a.name;
SELECT COUNT(*) AS fichas_pendientes FROM sheet_dirty;
SELECT source, COUNT(*) AS fechas_con_precio, SUM(zones_json IS NOT NULL) AS con_zonas FROM show_price GROUP BY source;
SELECT COUNT(*) AS recintos, SUM(capacity IS NOT NULL) AS con_aforo FROM venue_info;
SELECT a.name, x.label, x.city, x.local_date, substr(x.url, 1, 80) AS url FROM artist_signup x JOIN artist a ON a.id = x.artist_id LIMIT 30;
SELECT a.name, substr(r.json, 1, 300) AS reventa FROM artist_resale r JOIN artist a ON a.id = r.artist_id;
SELECT category, COUNT(*) AS n FROM news GROUP BY category;
SELECT key, substr(value, 1, 40) AS v FROM setting WHERE key NOT LIKE 'vapid%';
