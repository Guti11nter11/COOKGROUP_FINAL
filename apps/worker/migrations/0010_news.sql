-- Noticias accionables de artistas seguidos (radar de prensa). La PWA las guardará todas.
CREATE TABLE news (
  url TEXT PRIMARY KEY,
  artist_id TEXT,
  artist_name TEXT NOT NULL,
  title TEXT NOT NULL,
  source TEXT,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  published_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX news_artist ON news(artist_id, created_at);
