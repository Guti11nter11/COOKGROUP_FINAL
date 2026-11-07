-- La ficha llegó a tener alguna venta por llegar (si no, al quedarse sin ventas el canal se borra en vez de archivarse).
ALTER TABLE sheet ADD COLUMN tracked_sale INTEGER NOT NULL DEFAULT 0;
-- Aforo de cada recinto (Wikidata u otra fuente), por id de recinto de Ticketmaster.
CREATE TABLE venue_info (
  tm_venue_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  country TEXT,
  capacity INTEGER,
  wikidata_id TEXT,
  source TEXT,
  checked_at TEXT NOT NULL
);
-- Precio oficial (face value) por fecha.
CREATE TABLE show_price (
  source_id TEXT PRIMARY KEY,
  min REAL NOT NULL,
  max REAL NOT NULL,
  currency TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- Estimación de reventa por artista (modelo + mercado), en JSON (ResaleInfo).
CREATE TABLE artist_resale (
  artist_id TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
