-- Calidad del radar de noticias (titulares públicos de prensa).
SELECT artist_name, category, substr(summary, 1, 140) AS resumen, source FROM news ORDER BY created_at DESC LIMIT 40;
