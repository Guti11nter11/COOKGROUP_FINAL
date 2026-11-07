-- La primera lectura del Discovery Feed generó avisos de fechas que no eran nuevas (ya existían,
-- pero la API no las había visto). Se cancelan sus entregas pendientes; los avisos quedan como registro.
UPDATE delivery SET status = 'failed', last_error = 'cancelado: arranque del feed'
WHERE status IN ('pending', 'sending')
  AND alert_id IN (SELECT id FROM alert WHERE created_at >= '2026-11-07T21:45:00Z');
