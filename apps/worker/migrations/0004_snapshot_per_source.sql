-- Instantánea por fuente: la API y el Discovery Feed describen el mismo evento de forma distinta
-- (estado, preventas). Cada fuente se compara solo con su propia lectura anterior.
ALTER TABLE show ADD COLUMN api_hash TEXT;
ALTER TABLE show ADD COLUMN api_snapshot TEXT;
ALTER TABLE show ADD COLUMN feed_hash TEXT;
ALTER TABLE show ADD COLUMN feed_snapshot TEXT;
