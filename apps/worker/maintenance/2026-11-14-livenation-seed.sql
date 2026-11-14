-- Primeras páginas de Live Nation (las que mandó el propietario, gira de U2 en España); el resto llega solo
INSERT OR IGNORE INTO ln_event (url, added_at) VALUES ('https://www.livenation.es/event/u2-the-greatest-show-on-earth-world-tour-barcelona-tickets-edp1708667', '2026-11-14T10:00:00Z');
INSERT OR IGNORE INTO ln_event (url, added_at) VALUES ('https://www.livenation.es/event/u2-the-greatest-show-on-earth-world-tour-sevilla-tickets-edp1708683', '2026-11-14T10:00:00Z');
SELECT COUNT(*) AS paginas FROM ln_event;
