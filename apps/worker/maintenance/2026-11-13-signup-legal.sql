-- Páginas legales de Laylo guardadas como registro (Sam Fender): fuera
DELETE FROM artist_signup WHERE url IN ('https://laylo.com/terms', 'https://laylo.com/cookies', 'https://laylo.com/privacy');
INSERT OR IGNORE INTO sheet_dirty (artist_id, since) SELECT id, '2026-11-13T09:00:00Z' FROM artist WHERE name IN ('Sam Fender', 'Deftones');
