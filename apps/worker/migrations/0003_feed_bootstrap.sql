-- Arranque por fuente: la API y el Discovery Feed no ven lo mismo (la API no tiene Francia, por
-- ejemplo). El feed guarda en silencio las fechas de una entidad hasta su propia lectura completa.
ALTER TABLE follow ADD COLUMN feed_bootstrapped_at TEXT;
