SELECT a.id, a.kind, a.created_at, json_extract(a.payload_json, '$.alert.artistName') AS artist, json_extract(a.payload_json, '$.show.venue.country') AS cc, json_extract(a.payload_json, '$.show.localDate') AS fecha, substr(json_extract(a.payload_json, '$.alert.detail'), 1, 160) AS detalle, d.status FROM alert a JOIN delivery d ON d.alert_id = a.id ORDER BY a.id DESC LIMIT 30;
SELECT status, COUNT(*) AS n FROM delivery GROUP BY status;
SELECT kind, COUNT(*) AS n FROM alert GROUP BY kind;
