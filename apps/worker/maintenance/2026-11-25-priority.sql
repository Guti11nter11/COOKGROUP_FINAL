-- Prioridad (25-11): primero las fichas de los ascendidos con preventa más cercana (Steve Lacy mañana, Chase Atlantic el 2-12)
UPDATE sheet_dirty SET since = '2026-11-25T00:00:00Z' WHERE artist_id IN (SELECT id FROM artist WHERE name IN ('Steve Lacy', 'Chase Atlantic'));
SELECT COUNT(*) AS pendientes FROM sheet_dirty;
