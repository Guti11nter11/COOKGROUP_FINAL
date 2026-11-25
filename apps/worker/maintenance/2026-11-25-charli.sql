-- Diagnóstico (25-11): noticias y registros de Charli xcx (solo metadatos)
SELECT n.category, substr(n.created_at, 1, 16) AS cuando, n.source, substr(n.title, 1, 110) AS titular FROM news n WHERE lower(n.artist_name) = 'charli xcx' AND n.created_at >= '2026-11-15' ORDER BY n.created_at DESC LIMIT 10;
SELECT a.homepage, (SELECT COUNT(*) FROM artist_signup s WHERE s.artist_id = a.id) AS registros FROM artist a WHERE lower(a.name) = 'charli xcx';
