-- ====================================
-- OPTIMIZACIÓN DE ACTIVIDADES
-- Manejo de crecimiento de actividad_sistema
-- ====================================

-- 1. CREAR TABLA DE ARCHIVO (para actividades antiguas)
CREATE TABLE IF NOT EXISTS actividad_sistema_archivo (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    fecha TIMESTAMP NOT NULL DEFAULT NOW(),
    archivado_en TIMESTAMP DEFAULT NOW()
);

-- Índices para la tabla de archivo
CREATE INDEX IF NOT EXISTS idx_archivo_usuario_fecha 
ON actividad_sistema_archivo(usuario_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_archivo_fecha 
ON actividad_sistema_archivo(fecha DESC);

-- 2. FUNCIÓN PARA ARCHIVAR ACTIVIDADES ANTIGUAS
CREATE OR REPLACE FUNCTION archivar_actividades_antiguas(dias_retencion INTEGER DEFAULT 90)
RETURNS TABLE(archivados INTEGER) AS $$
DECLARE
    registros_archivados INTEGER;
BEGIN
    -- Copiar actividades antiguas a la tabla de archivo
    INSERT INTO actividad_sistema_archivo (usuario_id, tipo, titulo, descripcion, fecha)
    SELECT usuario_id, tipo, titulo, descripcion, fecha
    FROM actividad_sistema
    WHERE fecha < NOW() - INTERVAL '1 day' * dias_retencion;
    
    GET DIAGNOSTICS registros_archivados = ROW_COUNT;
    
    -- Eliminar de la tabla activa
    DELETE FROM actividad_sistema
    WHERE fecha < NOW() - INTERVAL '1 day' * dias_retencion;
    
    RETURN QUERY SELECT registros_archivados;
END;
$$ LANGUAGE plpgsql;

-- 3. FUNCIÓN PARA LIMPIAR ARCHIVO MUY ANTIGUO (opcional)
CREATE OR REPLACE FUNCTION limpiar_archivo_antiguo(dias_total INTEGER DEFAULT 365)
RETURNS TABLE(eliminados INTEGER) AS $$
DECLARE
    registros_eliminados INTEGER;
BEGIN
    DELETE FROM actividad_sistema_archivo
    WHERE fecha < NOW() - INTERVAL '1 day' * dias_total;
    
    GET DIAGNOSTICS registros_eliminados = ROW_COUNT;
    
    RETURN QUERY SELECT registros_eliminados;
END;
$$ LANGUAGE plpgsql;

-- 4. OPTIMIZAR ÍNDICES EXISTENTES
-- Asegurar que existen los índices necesarios
CREATE INDEX IF NOT EXISTS idx_actividad_usuario_fecha 
ON actividad_sistema(usuario_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_actividad_tipo 
ON actividad_sistema(tipo);

CREATE INDEX IF NOT EXISTS idx_actividad_fecha_desc 
ON actividad_sistema(fecha DESC);

-- 5. POLÍTICA DE RETENCIÓN AUTOMÁTICA (PostgreSQL con extensión pg_cron si está disponible)
-- Comentado porque requiere configuración específica del servidor
/*
SELECT cron.schedule(
    'archivar-actividades-mensuales',
    '0 2 1 * *', -- Primer día de cada mes a las 2 AM
    $$SELECT archivar_actividades_antiguas(90)$$
);

SELECT cron.schedule(
    'limpiar-archivo-trimestral',
    '0 3 1 */3 *', -- Cada 3 meses a las 3 AM
    $$SELECT limpiar_archivo_antiguo(365)$$
);
*/

-- 6. VISTA UNIFICADA (opcional - para consultar ambas tablas)
CREATE OR REPLACE VIEW actividad_sistema_completa AS
SELECT id, usuario_id, tipo, titulo, descripcion, fecha, 'activa' as origen
FROM actividad_sistema
UNION ALL
SELECT id, usuario_id, tipo, titulo, descripcion, fecha, 'archivo' as origen
FROM actividad_sistema_archivo
ORDER BY fecha DESC;

-- ====================================
-- INSTRUCCIONES DE USO
-- ====================================
/*
-- MANUAL: Archivar actividades de más de 90 días
SELECT * FROM archivar_actividades_antiguas(90);

-- MANUAL: Limpiar archivo de más de 1 año
SELECT * FROM limpiar_archivo_antiguo(365);

-- VER ESTADÍSTICAS
SELECT 
    'Activa' as tabla,
    COUNT(*) as registros,
    MIN(fecha) as mas_antigua,
    MAX(fecha) as mas_reciente,
    pg_size_pretty(pg_total_relation_size('actividad_sistema')) as tamaño
FROM actividad_sistema
UNION ALL
SELECT 
    'Archivo',
    COUNT(*),
    MIN(fecha),
    MAX(fecha),
    pg_size_pretty(pg_total_relation_size('actividad_sistema_archivo'))
FROM actividad_sistema_archivo;

-- CONSULTAR ACTIVIDAD COMPLETA DE UN USUARIO (últimos 6 meses)
SELECT * FROM actividad_sistema_completa
WHERE usuario_id = 1 
AND fecha > NOW() - INTERVAL '6 months'
ORDER BY fecha DESC
LIMIT 100;
*/
