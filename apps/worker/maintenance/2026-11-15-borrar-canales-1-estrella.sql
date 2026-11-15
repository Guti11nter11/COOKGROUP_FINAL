-- Pedido del propietario: borrar los canales de artistas ⭐ (salvo los que tengan conciertos en España, que se quedan)
SELECT a.name, h.status, (SELECT COUNT(*) FROM show s WHERE s.artist_id = a.id AND s.country = 'ES' AND s.local_date >= date('now')) AS fechas_es FROM sheet h JOIN artist a ON a.id = h.artist_id JOIN follow f ON f.artist_id = h.artist_id WHERE COALESCE(f.tier, 1) = 1 ORDER BY h.status, a.name;
UPDATE sheet SET tracked_sale = 0 WHERE artist_id IN (SELECT artist_id FROM follow WHERE COALESCE(tier, 1) = 1) OR artist_id NOT IN (SELECT artist_id FROM follow);
INSERT OR IGNORE INTO sheet_dirty (artist_id, since) SELECT artist_id, '2026-11-15T10:00:00Z' FROM sheet WHERE tracked_sale = 0;
SELECT COUNT(*) AS marcados FROM sheet WHERE tracked_sale = 0;
