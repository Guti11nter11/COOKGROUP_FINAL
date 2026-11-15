-- Comprobación (solo lectura): canales de artistas ⭐ que quedan
SELECT h.status, COUNT(*) AS n FROM sheet h LEFT JOIN follow f ON f.artist_id = h.artist_id WHERE COALESCE(f.tier, 1) = 1 GROUP BY h.status;
SELECT COUNT(*) AS pendientes FROM sheet_dirty;
