-- Listados de paquetes con guion guardados como fechas normales pasan a accesorios
UPDATE show SET is_package = 1 WHERE is_package = 0 AND (json_extract(snapshot_json, '$.name') LIKE '% - %Package%' OR json_extract(snapshot_json, '$.name') LIKE '% - %VIP%');
