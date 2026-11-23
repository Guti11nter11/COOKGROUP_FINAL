-- Revisión 09:47 del 23-11 (b): ¿sigue vivo el barrido? (solo lectura, solo metadatos)
SELECT job, MAX(started_at) AS ultimo, SUM(ok = 0) AS fallos, COUNT(*) AS n FROM job_run WHERE started_at >= '2026-11-22T00:00:00Z' GROUP BY job;
SELECT substr(MAX(first_seen_at), 1, 16) AS ultimo_show_nuevo, substr(MAX(updated_at), 1, 16) AS ultimo_cambio, (SELECT COUNT(*) FROM show WHERE first_seen_at >= '2026-11-21T00:00:00Z') AS nuevos_desde_21 FROM show;
SELECT substr(MAX(updated_at), 1, 16) AS ultima_ficha FROM sheet;
