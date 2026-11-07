-- Recordatorios ya enviados (clave: artista|venta|hora|24h/1h/10m) y ajustes sueltos (ids de mensajes fijos, resúmenes enviados).
CREATE TABLE reminder_sent (
  key TEXT PRIMARY KEY,
  sent_at TEXT NOT NULL
);
CREATE TABLE setting (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
