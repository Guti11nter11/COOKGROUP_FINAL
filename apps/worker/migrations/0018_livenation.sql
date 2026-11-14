-- Páginas públicas de evento de Live Nation que GIRA lee (las añade /livenation y se amplían solas con
-- las otras fechas de la gira) y ventas que solo publica Live Nation (no salen en la API de Ticketmaster).
CREATE TABLE ln_event (
  url TEXT PRIMARY KEY,
  added_at TEXT NOT NULL,
  last_read_at TEXT,
  last_date TEXT
);
CREATE TABLE show_extra_sale (
  source_id TEXT NOT NULL,
  label TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  url TEXT,
  found_at TEXT NOT NULL,
  PRIMARY KEY (source_id, label, starts_at)
);
