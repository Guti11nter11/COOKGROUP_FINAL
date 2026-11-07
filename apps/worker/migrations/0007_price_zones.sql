-- Precios por zona (pista, gradas, Red Zone…) cuando la fuente los publica.
ALTER TABLE show_price ADD COLUMN zones_json TEXT;
