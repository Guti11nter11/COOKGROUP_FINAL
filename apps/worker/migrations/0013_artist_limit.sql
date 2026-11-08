-- Límite de entradas por persona encontrado en prensa (por país), cuando la ticketera no lo publica.
CREATE TABLE artist_limit (
  artist_id TEXT NOT NULL,
  country TEXT NOT NULL,
  ticket_limit INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (artist_id, country)
);
