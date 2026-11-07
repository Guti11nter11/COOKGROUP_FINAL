UPDATE delivery SET status = 'failed', last_error = 'pausado: rediseño de mensajes' WHERE status IN ('pending', 'sending');
SELECT status, COUNT(*) AS n FROM delivery GROUP BY status;
