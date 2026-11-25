-- Revisión 09:47 del 25-11 (c): republicar la ficha de The Cardigans sin el concierto de Manic Street Preachers
INSERT OR IGNORE INTO sheet_dirty (artist_id, since) SELECT id, '2026-11-25T09:30:00Z' FROM artist WHERE name = 'The Cardigans';
