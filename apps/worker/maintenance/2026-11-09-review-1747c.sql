-- Revisión 17:47, parte 3. La noticia de "After" (fecha extra) ¿es de un artista real? Solo metadatos.
SELECT n.artist_id, a.tm_attraction_id, (SELECT tier FROM follow WHERE artist_id = n.artist_id) AS tier, substr(n.url, 1, 60) AS url, n.category FROM news n LEFT JOIN artist a ON a.id = n.artist_id WHERE n.artist_name = 'After';
