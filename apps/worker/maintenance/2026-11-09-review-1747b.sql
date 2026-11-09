-- Revisión 17:47, parte 2. Quita la newsletter de Sabrina Carpenter (no es registro de preventa)
DELETE FROM artist_signup WHERE url = 'https://www.sabrinacarpenter.com/sign-up/';
-- Noticias de hoy por tipo y artista, con su ficha (solo metadatos, sin texto de mensajes)
SELECT n.category, n.artist_name, (SELECT status FROM sheet WHERE artist_id = n.artist_id) AS ficha, substr(n.created_at, 12, 5) AS hora FROM news n WHERE n.created_at >= '2026-11-09T05:00:00Z' AND n.category IN ('tour_announced', 'presale', 'on_sale', 'signup', 'extra_date') ORDER BY n.created_at DESC LIMIT 40;
