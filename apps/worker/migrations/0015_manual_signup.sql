-- Enlaces de registro añadidos a mano con /registro (no los borra el lector automático de webs).
CREATE TABLE artist_signup_manual (
  artist_id TEXT NOT NULL,
  url TEXT NOT NULL,
  label TEXT NOT NULL,
  added_at TEXT NOT NULL,
  PRIMARY KEY (artist_id, url)
);
