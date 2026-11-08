-- Quitar noticias fuera de alcance o mal atribuidas (ya corregido en el código de social y news-radar).
DELETE FROM news WHERE source = 'Metallica (Instagram)' AND (summary LIKE '%Amon Amarth%' OR title LIKE '%Amon Amarth%');
DELETE FROM news WHERE lower(title || ' ' || summary) LIKE '%hotel%' OR lower(title || ' ' || summary) LIKE '%hospitality%' OR lower(title || ' ' || summary) LIKE '%package%' OR lower(title || ' ' || summary) LIKE '%paquete%';
SELECT count(*) AS noticias_hoy FROM news WHERE created_at >= '2026-11-08T00:00:00Z';
