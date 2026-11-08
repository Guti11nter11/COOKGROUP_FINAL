-- Quitar noticias guardadas antes del filtro de Europa (fase 1) y conciertos locales pequeños.
DELETE FROM news WHERE summary LIKE '%Ecuador%' OR summary LIKE '%Colombia%' OR summary LIKE '%México%' OR summary LIKE '%Chile%'
  OR summary LIKE '%Bogotá%' OR summary LIKE '%Buenos Aires%' OR summary LIKE '%Guatemala%' OR summary LIKE '%Costa Rica%'
  OR summary LIKE '%Norteamérica%' OR summary LIKE '%Perú%' OR summary LIKE '%Santa Cruz%' OR summary LIKE '%Latinoamérica%'
  OR artist_name LIKE 'OBM%' OR summary LIKE '%Vila Nova de Paiva%';
SELECT COUNT(*) AS noticias FROM news;
