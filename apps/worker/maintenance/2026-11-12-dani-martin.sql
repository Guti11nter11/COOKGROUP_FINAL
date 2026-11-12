-- Dani Martín, ⭐⭐⭐ (pedido del propietario: "muy importante para mí")
UPDATE follow SET tier = 3, muted_until = NULL WHERE artist_id = 'a_K8vZ91745df';
SELECT a.name, f.tier FROM follow f JOIN artist a ON a.id = f.artist_id WHERE a.id = 'a_K8vZ91745df';
