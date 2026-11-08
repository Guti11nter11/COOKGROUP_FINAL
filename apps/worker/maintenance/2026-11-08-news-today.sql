-- Noticias guardadas hoy (titulares públicos) para revisar la calidad tras el filtro de Europa.
SELECT artist_name, category, substr(summary, 1, 150) AS resumen, source FROM news WHERE created_at >= '2026-11-08T06:00:00Z' ORDER BY created_at DESC LIMIT 30;
