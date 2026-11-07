-- Web oficial del artista y enlaces de registro/preventa encontrados en ella (Bandsintown, Laylo, Live Nation…).
ALTER TABLE artist ADD COLUMN homepage TEXT;
CREATE TABLE artist_signup (
  artist_id TEXT NOT NULL,
  url TEXT NOT NULL,
  label TEXT NOT NULL,
  city TEXT,
  local_date TEXT,
  found_at TEXT NOT NULL,
  PRIMARY KEY (artist_id, url)
);
