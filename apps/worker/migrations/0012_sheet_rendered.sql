-- Texto de la ficha ya renderizado (la app lo lee sin volver a calcularlo: CPU del plan gratuito).
ALTER TABLE sheet ADD COLUMN rendered_json TEXT;
