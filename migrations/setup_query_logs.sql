-- ============================================================
-- reConecta - Sistema de logs de queries lentas
-- Objetivo: registrar la duración de las queries de la API y exponer
-- estadísticas/diagnóstico de rendimiento.
-- Usado por: src/utils/queryLogger.js y src/DAO/tasksDAO.js
-- (obtenerQueriesMasLentas, limpiarQueryLogsAntiguos).
--
-- INSTRUCCIONES:
-- 1) Ejecuta este archivo completo en el SQL editor de Supabase,
--    independientemente del bootstrap principal
--    (recreate_supabase_production.sql).
-- 2) Puede volver a ejecutarse sin riesgo: es idempotente.
-- ============================================================

BEGIN;

-- ============================================================
-- 0) LIMPIEZA INICIAL (DROP)
--    Permite reejecutar este script sin errores de "ya existe".
-- ============================================================
DROP VIEW IF EXISTS public.queries_mas_lentas;
DROP TABLE IF EXISTS public.query_logs CASCADE;
DROP FUNCTION IF EXISTS public.limpiar_query_logs_antiguos(INTEGER);
DROP FUNCTION IF EXISTS public.obtener_estadisticas_queries();

-- ============================================================
-- 1) TABLA DE LOGS DE QUERIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.query_logs (
    id SERIAL PRIMARY KEY,
    nombre_query VARCHAR(255) NOT NULL,
    duracion_ms INTEGER NOT NULL,
    fecha_ejecucion TIMESTAMP NOT NULL DEFAULT NOW(),
    es_lenta BOOLEAN DEFAULT FALSE,
    detalles JSONB
);

CREATE INDEX IF NOT EXISTS idx_query_logs_nombre ON public.query_logs(nombre_query);
CREATE INDEX IF NOT EXISTS idx_query_logs_fecha ON public.query_logs(fecha_ejecucion DESC);
CREATE INDEX IF NOT EXISTS idx_query_logs_lenta ON public.query_logs(es_lenta);
CREATE INDEX IF NOT EXISTS idx_query_logs_duracion ON public.query_logs(duracion_ms DESC);

-- ============================================================
-- 2) FUNCIONES DE MANTENIMIENTO Y ESTADÍSTICAS
-- ============================================================
CREATE OR REPLACE FUNCTION public.limpiar_query_logs_antiguos(dias_retencion INTEGER DEFAULT 30)
RETURNS JSONB AS $$
DECLARE
    registros_eliminados INTEGER;
BEGIN
    DELETE FROM public.query_logs
    WHERE fecha_ejecucion < NOW() - INTERVAL '1 day' * dias_retencion;

    GET DIAGNOSTICS registros_eliminados = ROW_COUNT;

    RETURN jsonb_build_object('eliminados', registros_eliminados);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.obtener_estadisticas_queries()
RETURNS JSONB AS $$
DECLARE
    resultado JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_queries', COUNT(*),
        'queries_lentas', COUNT(*) FILTER (WHERE es_lenta = true),
        'duracion_promedio_ms', COALESCE(AVG(duracion_ms), 0),
        'duracion_maxima_ms', COALESCE(MAX(duracion_ms), 0),
        'duracion_minima_ms', COALESCE(MIN(duracion_ms), 0)
    )
    INTO resultado
    FROM public.query_logs
    WHERE fecha_ejecucion > NOW() - INTERVAL '24 hours';

    RETURN resultado;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3) VISTA DE QUERIES MÁS LENTAS
-- ============================================================
CREATE OR REPLACE VIEW public.queries_mas_lentas AS
SELECT
    nombre_query,
    COUNT(*) as ejecuciones,
    AVG(duracion_ms)::INTEGER as duracion_promedio_ms,
    MAX(duracion_ms) as duracion_maxima_ms,
    MIN(duracion_ms) as duracion_minima_ms,
    COUNT(*) FILTER (WHERE es_lenta = true) as ejecuciones_lentas
FROM public.query_logs
WHERE fecha_ejecucion > NOW() - INTERVAL '24 hours'
GROUP BY nombre_query
HAVING COUNT(*) > 0
ORDER BY AVG(duracion_ms) DESC
LIMIT 20;

COMMIT;

-- ============================================================
-- 4) REFRESCAR CACHÉ DE ESQUEMA DE POSTGREST
--    Necesario para que Supabase reconozca la tabla/vista nuevas
--    sin esperar al refresco automático.
-- ============================================================
NOTIFY pgrst, 'reload schema';

