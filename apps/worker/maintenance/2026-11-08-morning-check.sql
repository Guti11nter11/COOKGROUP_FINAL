-- Comprobación de la mañana: solo claves y recuentos (nada privado).
SELECT key FROM setting WHERE key LIKE 'digest|%';
SELECT a.name, s.status FROM sheet s JOIN artist a ON a.id = s.artist_id ORDER BY s.status, a.name;
SELECT COUNT(*) AS recordatorios_enviados FROM reminder_sent;
SELECT category, COUNT(*) AS n FROM news GROUP BY category;
SELECT COUNT(*) AS dispositivos FROM push_sub;
SELECT COUNT(*) AS passkeys FROM passkey;
