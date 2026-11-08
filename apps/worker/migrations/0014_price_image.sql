-- Imagen de precios oficiales por artista (la genera el trabajo de enriquecer). En trozos de texto
-- base64 para no acercarse a los límites de tamaño de D1.
CREATE TABLE price_image (
  artist_id TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  mime TEXT NOT NULL,
  chunks INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE price_image_chunk (
  artist_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (artist_id, idx)
);
