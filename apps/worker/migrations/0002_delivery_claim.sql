-- Reclamo atómico de entregas: estado 'sending' + claimed_at para que dos procesos
-- (cron y cola) nunca publiquen el mismo aviso dos veces.
CREATE TABLE delivery_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_id INTEGER NOT NULL REFERENCES alert(id),
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TEXT,
  claimed_at TEXT,
  UNIQUE (alert_id, channel)
);
INSERT INTO delivery_new (id, alert_id, channel, status, attempts, last_error, sent_at)
  SELECT id, alert_id, channel, status, attempts, last_error, sent_at FROM delivery;
DROP TABLE delivery;
ALTER TABLE delivery_new RENAME TO delivery;
CREATE INDEX delivery_pending ON delivery(status, id);
