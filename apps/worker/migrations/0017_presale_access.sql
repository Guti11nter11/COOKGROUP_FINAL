-- Códigos y enlaces de preventa que llegan al Gmail del propietario (los manda su script de Google).
-- Uno por artista y tipo de preventa: si llegan dos códigos o dos enlaces (o el correo duplicado), se queda el primero.
CREATE TABLE presale_access (
  artist_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  code TEXT,
  url TEXT,
  received_at TEXT NOT NULL,
  PRIMARY KEY (artist_id, kind)
);
