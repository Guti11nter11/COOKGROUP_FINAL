-- Deshacer el descubrimiento de 40 entidades de México de la primera pasada con Latinoamérica
-- (lucha libre, recintos, espectáculos de Navidad…): el criterio era demasiado amplio y ya se ha
-- endurecido. Son las que entraron por /enrich/discover entre las 20:00 y las 20:15 UTC.
SELECT COUNT(*) AS a_borrar FROM follow WHERE bootstrapped_at >= '2026-11-08T20:00:00Z' AND bootstrapped_at < '2026-11-08T20:15:00Z' AND bootstrapped_at = feed_bootstrapped_at;
DELETE FROM sheet_dirty WHERE artist_id IN (SELECT artist_id FROM follow WHERE bootstrapped_at >= '2026-11-08T20:00:00Z' AND bootstrapped_at < '2026-11-08T20:15:00Z' AND bootstrapped_at = feed_bootstrapped_at);
DELETE FROM follow WHERE bootstrapped_at >= '2026-11-08T20:00:00Z' AND bootstrapped_at < '2026-11-08T20:15:00Z' AND bootstrapped_at = feed_bootstrapped_at;
SELECT COUNT(*) AS seguidos FROM follow;
SELECT a.name, f.tier, f.bootstrapped_at FROM follow f JOIN artist a ON a.id = f.artist_id WHERE f.bootstrapped_at >= '2026-11-08T18:00:00Z' ORDER BY f.bootstrapped_at;
