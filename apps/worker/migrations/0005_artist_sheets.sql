-- Fichas por artista: un canal de Discord por artista con gira activa (estilo Akari).
CREATE TABLE sheet (
  artist_id TEXT PRIMARY KEY REFERENCES artist(id),
  channel_id TEXT NOT NULL,
  message_ids TEXT NOT NULL DEFAULT '[]',
  content_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  updated_at TEXT NOT NULL
);
-- Artistas cuya ficha hay que (re)generar.
CREATE TABLE sheet_dirty (
  artist_id TEXT PRIMARY KEY,
  since TEXT NOT NULL
);
ALTER TABLE delivery ADD COLUMN artist_id TEXT;
CREATE INDEX delivery_artist ON delivery(artist_id, status);
