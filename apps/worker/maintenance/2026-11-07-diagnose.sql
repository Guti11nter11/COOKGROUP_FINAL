UPDATE delivery SET status = 'failed', last_error = 'cancelado: arranque del feed'
WHERE status IN ('pending', 'sending') AND alert_id IN (SELECT id FROM alert WHERE created_at >= '2026-11-07T21:45:00Z');
SELECT a.id, a.kind, a.created_at, json_extract(a.payload_json, '$.alert.artistName') AS artist,
       json_extract(a.payload_json, '$.show.venue.country') AS cc, json_extract(a.payload_json, '$.show.localDate') AS fecha,
       substr(json_extract(a.payload_json, '$.alert.detail'), 1, 140) AS detalle, d.status
FROM alert a JOIN delivery d ON d.alert_id = a.id ORDER BY a.id DESC LIMIT 25;
SELECT status, COUNT(*) AS n FROM delivery GROUP BY status;
SELECT kind, COUNT(*) AS n FROM alert GROUP BY kind;
