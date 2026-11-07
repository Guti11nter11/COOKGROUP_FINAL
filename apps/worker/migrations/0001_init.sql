-- GIRA R1: artistas seguidos, fechas de Ticketmaster, avisos y su entrega.
CREATE TABLE artist (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tm_attraction_id TEXT UNIQUE,
  mbid TEXT,
  deezer_id INTEGER,
  deezer_fans INTEGER
);
CREATE TABLE follow (
  artist_id TEXT PRIMARY KEY REFERENCES artist(id),
  tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 3),
  muted_until TEXT,
  bootstrapped_at TEXT
);
CREATE TABLE show (
  source_id TEXT PRIMARY KEY,
  show_key TEXT NOT NULL,
  artist_id TEXT NOT NULL REFERENCES artist(id),
  country TEXT NOT NULL,
  local_date TEXT NOT NULL,
  is_package INTEGER NOT NULL DEFAULT 0,
  hash TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX show_artist ON show(artist_id, country);
CREATE INDEX show_key_idx ON show(show_key);
CREATE TABLE alert (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dedupe_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  source_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE delivery (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_id INTEGER NOT NULL REFERENCES alert(id),
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TEXT,
  UNIQUE (alert_id, channel)
);
CREATE INDEX delivery_pending ON delivery(status, id);
CREATE TABLE quota_usage (
  service TEXT NOT NULL,
  day TEXT NOT NULL,
  calls INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (service, day)
);
CREATE TABLE job_run (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  ok INTEGER,
  result_json TEXT
);
CREATE TABLE discord_channel (
  name TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
