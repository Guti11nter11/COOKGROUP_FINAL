-- Otras ticketeras de venta oficial de un artista (p. ej. SeatGeek en EE. UU.), para los enlaces de la ficha.
CREATE TABLE artist_ticketer (
  artist_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (artist_id, name)
);
