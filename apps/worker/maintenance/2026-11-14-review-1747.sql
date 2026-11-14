-- Revisión 17:47 del 14-11 (solo lectura, solo metadatos)
SELECT n.category, n.artist_name, (SELECT status FROM sheet WHERE artist_id = n.artist_id) AS ficha, substr(n.created_at, 6, 11) AS cuando FROM news n WHERE n.created_at >= '2026-11-14T04:45:00Z' AND n.category IN ('tour_announced', 'presale', 'on_sale', 'signup', 'extra_date') ORDER BY n.created_at DESC LIMIT 40;
SELECT a.name, s.label, substr(s.url, 1, 80) AS url, s.city, substr(s.found_at, 6, 11) AS cuando FROM artist_signup s JOIN artist a ON a.id = s.artist_id WHERE s.found_at >= '2026-11-14T08:30:00Z' AND s.url NOT LIKE '%seated.com%' AND s.url NOT LIKE '%bandsintown%' ORDER BY s.found_at DESC LIMIT 40;
SELECT COUNT(*) AS paginas_ln, SUM(last_read_at IS NOT NULL) AS leidas FROM ln_event;
SELECT COUNT(*) AS ventas_ln FROM show_extra_sale;
SELECT COUNT(*) AS accesos_correo FROM presale_access;
SELECT COUNT(*) AS fichas_activas FROM sheet WHERE status = 'active';
