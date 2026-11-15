-- Revisión 17:47 del 15-11 (solo lectura, solo metadatos)
SELECT n.category, n.artist_name, (SELECT tier FROM follow WHERE artist_id = n.artist_id) AS tier, (SELECT status FROM sheet WHERE artist_id = n.artist_id) AS ficha, substr(n.created_at, 6, 11) AS cuando FROM news n WHERE n.created_at >= '2026-11-15T04:45:00Z' AND n.category IN ('tour_announced', 'presale', 'on_sale', 'signup', 'extra_date') ORDER BY n.created_at DESC LIMIT 40;
SELECT a.name, s.label, substr(s.url, 1, 80) AS url, s.city, substr(s.found_at, 6, 11) AS cuando FROM artist_signup s JOIN artist a ON a.id = s.artist_id WHERE s.found_at >= '2026-11-15T08:30:00Z' AND s.url NOT LIKE '%seated.com%' AND s.url NOT LIKE '%bandsintown%' ORDER BY s.found_at DESC LIMIT 40;
SELECT h.status, COALESCE(f.tier, 1) AS tier, COUNT(*) AS n FROM sheet h LEFT JOIN follow f ON f.artist_id = h.artist_id GROUP BY 1, 2;
SELECT COUNT(*) AS ventas_ln FROM show_extra_sale;
