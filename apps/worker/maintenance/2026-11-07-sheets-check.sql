-- Comprobación de los canales por artista tras reanudar Discord.
SELECT COUNT(*) AS fichas_pendientes FROM sheet_dirty;
SELECT a.name, s.channel_id, s.status, json_array_length(s.message_ids) AS mensajes, s.updated_at FROM sheet s JOIN artist a ON a.id = s.artist_id ORDER BY s.updated_at DESC LIMIT 40;
SELECT status, COUNT(*) AS n FROM delivery GROUP BY status;
