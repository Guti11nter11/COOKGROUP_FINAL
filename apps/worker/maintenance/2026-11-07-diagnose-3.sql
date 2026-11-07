SELECT a.name, f.tier, f.bootstrapped_at, a.tm_attraction_id FROM artist a JOIN follow f ON f.artist_id = a.id WHERE a.name IN ('blink-182', 'Vasco Rossi', 'Korn', 'WWE', 'Pinkpop', 'David Bowie', 'Celine Dion', 'U2');
SELECT COUNT(*) AS total, SUM(bootstrapped_at IS NULL) AS sin_arrancar, MIN(bootstrapped_at) AS primero, MAX(bootstrapped_at) AS ultimo FROM follow;
SELECT bootstrapped_at, COUNT(*) AS n FROM follow GROUP BY bootstrapped_at ORDER BY n DESC LIMIT 8;
