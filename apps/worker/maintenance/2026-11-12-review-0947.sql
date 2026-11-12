-- Revisión 09:47 del 12-11 (solo lectura, solo metadatos)
SELECT n.category, n.artist_name, (SELECT status FROM sheet WHERE artist_id = n.artist_id) AS ficha, substr(n.created_at, 6, 11) AS cuando FROM news n WHERE n.created_at >= '2026-11-11T20:45:00Z' AND n.category IN ('tour_announced', 'presale', 'on_sale', 'signup', 'extra_date') ORDER BY n.created_at DESC LIMIT 40;
SELECT a.name, s.label, substr(s.url, 1, 80) AS url, s.city, substr(s.found_at, 6, 11) AS cuando FROM artist_signup s JOIN artist a ON a.id = s.artist_id WHERE s.found_at >= '2026-11-11T16:45:00Z' AND s.url NOT LIKE '%seated.com%' AND s.url NOT LIKE '%bandsintown%' ORDER BY s.found_at DESC LIMIT 40;
SELECT a.name, h.status, substr(h.updated_at, 6, 11) AS actualizada FROM sheet h JOIN artist a ON a.id = h.artist_id WHERE h.updated_at >= '2026-11-11T16:45:00Z' ORDER BY h.updated_at DESC LIMIT 60;
SELECT COUNT(*) AS accesos_correo FROM presale_access;
SELECT COUNT(*) AS fichas_activas FROM sheet WHERE status = 'active';
SELECT COUNT(*) AS pendientes FROM sheet_dirty;
