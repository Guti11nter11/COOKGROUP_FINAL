-- Las imágenes de precios pasan a guardarse en binario (sin base64): se borran las de base64 y el
-- trabajo de enriquecer las vuelve a subir. Las fichas afectadas se regeneran.
INSERT OR IGNORE INTO sheet_dirty (artist_id, since) SELECT artist_id, '2026-11-08T20:35:00Z' FROM price_image;
DELETE FROM price_image_chunk;
DELETE FROM price_image;
SELECT COUNT(*) AS imagenes FROM price_image;
SELECT a.name, h.status, length(h.rendered_json) AS largo, h.updated_at FROM sheet h JOIN artist a ON a.id = h.artist_id WHERE h.status = 'active';
