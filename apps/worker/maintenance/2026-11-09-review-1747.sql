-- Revisión 17:47 (solo lectura; sin texto de mensajes, solo artista, tipo y dominio).
SELECT n.category, n.artist_name, (SELECT status FROM sheet WHERE artist_id = n.artist_id) AS ficha, substr(n.created_at, 12, 5) AS hora FROM news n WHERE n.created_at >= datetime('now', '-12 hours') AND n.category NOT IN ('other', 'rumor') ORDER BY n.created_at DESC LIMIT 40;
SELECT n.category, COUNT(*) AS n FROM news n WHERE n.created_at >= datetime('now', '-12 hours') GROUP BY 1 ORDER BY 2 DESC;
SELECT a.name, s.label, substr(s.url, 1, 70) AS url, s.city, s.found_at FROM artist_signup s JOIN artist a ON a.id = s.artist_id WHERE s.found_at >= datetime('now', '-12 hours') ORDER BY s.found_at DESC LIMIT 30;
SELECT a.name, h.status, substr(h.updated_at, 1, 16) AS actualizada FROM sheet h JOIN artist a ON a.id = h.artist_id WHERE h.updated_at >= datetime('now', '-12 hours') OR h.status = 'active' ORDER BY h.updated_at DESC LIMIT 40;
SELECT COUNT(*) AS accesos_correo FROM presale_access;
