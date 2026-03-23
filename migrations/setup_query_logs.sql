-- ====================================
-- SISTEMA DE LOGS DE QUERIES
-- ====================================

-- Eliminar objetos existentes para permitir re-ejecución
DROP TABLE IF EXISTS query_logs CASCADE;
DROP FUNCTION IF EXISTS limpiar_query_logs_antiguos(INTEGER);
DROP FUNCTION IF EXISTS obtener_estadisticas_queries();

-- Tabla para registrar logs de queries
CREATE TABLE IF NOT EXISTS query_logs (
    id SERIAL PRIMARY KEY,
    nombre_query VARCHAR(255) NOT NULL,
    duracion_ms INTEGER NOT NULL,
    fecha_ejecucion TIMESTAMP NOT NULL DEFAULT NOW(),
    es_lenta BOOLEAN DEFAULT FALSE,
    detalles JSONB
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_query_logs_nombre ON query_logs(nombre_query);
CREATE INDEX IF NOT EXISTS idx_query_logs_fecha ON query_logs(fecha_ejecucion DESC);
CREATE INDEX IF NOT EXISTS idx_query_logs_lenta ON query_logs(es_lenta);
CREATE INDEX IF NOT EXISTS idx_query_logs_duracion ON query_logs(duracion_ms DESC);

-- Función para limpiar logs antiguos
CREATE OR REPLACE FUNCTION limpiar_query_logs_antiguos(dias_retencion INTEGER DEFAULT 30)
RETURNS JSONB AS $$
DECLARE
    registros_eliminados INTEGER;
BEGIN
    DELETE FROM query_logs
    WHERE fecha_ejecucion < NOW() - INTERVAL '1 day' * dias_retencion;
    
    GET DIAGNOSTICS registros_eliminados = ROW_COUNT;
    
    RETURN jsonb_build_object('eliminados', registros_eliminados);
END;
$$ LANGUAGE plpgsql;

-- Función para obtener estadísticas de queries
CREATE OR REPLACE FUNCTION obtener_estadisticas_queries()
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
    FROM query_logs
    WHERE fecha_ejecucion > NOW() - INTERVAL '24 hours';
    
    RETURN resultado;
END;
$$ LANGUAGE plpgsql;

-- Vista para queries más lentas
CREATE OR REPLACE VIEW queries_mas_lentas AS
SELECT 
    nombre_query,
    COUNT(*) as ejecuciones,
    AVG(duracion_ms)::INTEGER as duracion_promedio_ms,
    MAX(duracion_ms) as duracion_maxima_ms,
    MIN(duracion_ms) as duracion_minima_ms,
    COUNT(*) FILTER (WHERE es_lenta = true) as ejecuciones_lentas
FROM query_logs
WHERE fecha_ejecucion > NOW() - INTERVAL '24 hours'
GROUP BY nombre_query
HAVING COUNT(*) > 0
ORDER BY AVG(duracion_ms) DESC
LIMIT 20;
