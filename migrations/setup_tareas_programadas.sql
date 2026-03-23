-- ====================================
-- SISTEMA DE TAREAS PROGRAMADAS
-- ====================================

-- Eliminar objetos existentes para permitir re-ejecución
DROP VIEW IF EXISTS ultimas_ejecuciones_tareas;
DROP FUNCTION IF EXISTS archivar_actividades_antiguas(INTEGER);
DROP FUNCTION IF EXISTS limpiar_archivo_antiguo(INTEGER);
DROP FUNCTION IF EXISTS obtener_estadisticas_tareas();

-- Tabla para registrar logs de tareas programadas
CREATE TABLE IF NOT EXISTS logs_tareas_programadas (
    id SERIAL PRIMARY KEY,
    nombre_tarea VARCHAR(100) NOT NULL,
    estado VARCHAR(20) NOT NULL, -- 'iniciada', 'completada', 'error'
    fecha_inicio TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_fin TIMESTAMP,
    duracion_ms INTEGER,
    registros_procesados INTEGER DEFAULT 0,
    registros_archivados INTEGER DEFAULT 0,
    registros_eliminados INTEGER DEFAULT 0,
    mensaje TEXT,
    error TEXT,
    detalles JSONB
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_logs_tareas_nombre ON logs_tareas_programadas(nombre_tarea);
CREATE INDEX IF NOT EXISTS idx_logs_tareas_fecha ON logs_tareas_programadas(fecha_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_logs_tareas_estado ON logs_tareas_programadas(estado);

-- Vista para últimas ejecuciones
CREATE OR REPLACE VIEW ultimas_ejecuciones_tareas AS
SELECT DISTINCT ON (nombre_tarea)
    nombre_tarea,
    estado,
    fecha_inicio,
    fecha_fin,
    duracion_ms,
    registros_procesados,
    registros_archivados,
    mensaje
FROM logs_tareas_programadas
ORDER BY nombre_tarea, fecha_inicio DESC;

-- Tabla de archivo para actividades (de optimizar_actividades.sql)
CREATE TABLE IF NOT EXISTS actividad_sistema_archivo (
    id SERIAL PRIMARY KEY,
    usuario_id UUID REFERENCES "appUsers"(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    archivado_en TIMESTAMP DEFAULT NOW()
);

-- Verificar y corregir estructura de actividad_sistema_archivo
DO $$ 
BEGIN
    -- Agregar columna created_at si no existe
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'actividad_sistema_archivo' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE actividad_sistema_archivo ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
    END IF;
    
    -- Si existe columna 'fecha' y no 'created_at', copiar datos
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'actividad_sistema_archivo' AND column_name = 'fecha'
    ) AND NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'actividad_sistema_archivo' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE actividad_sistema_archivo ADD COLUMN created_at TIMESTAMP;
        UPDATE actividad_sistema_archivo SET created_at = fecha;
    END IF;
    
    -- Verificar y corregir tipo de usuario_id (debe ser UUID)
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'actividad_sistema_archivo' 
        AND column_name = 'usuario_id' 
        AND data_type = 'integer'
    ) THEN
        -- Eliminar restricción de clave foránea si existe
        ALTER TABLE actividad_sistema_archivo DROP CONSTRAINT IF EXISTS actividad_sistema_archivo_usuario_id_fkey;
        -- Cambiar tipo a UUID
        ALTER TABLE actividad_sistema_archivo ALTER COLUMN usuario_id TYPE UUID USING usuario_id::text::uuid;
        -- Recrear la clave foránea
        ALTER TABLE actividad_sistema_archivo ADD CONSTRAINT actividad_sistema_archivo_usuario_id_fkey 
            FOREIGN KEY (usuario_id) REFERENCES "appUsers"(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_archivo_usuario_fecha 
ON actividad_sistema_archivo(usuario_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_archivo_fecha 
ON actividad_sistema_archivo(created_at DESC);

-- Verificar y corregir estructura de actividad_sistema
-- Primero, asegurar que la tabla existe con la estructura correcta
DO $$ 
BEGIN
    -- Verificar si la tabla existe
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'actividad_sistema') THEN
        -- Crear tabla si no existe
        CREATE TABLE actividad_sistema (
            id SERIAL PRIMARY KEY,
            usuario_id UUID REFERENCES "appUsers"(id) ON DELETE CASCADE,
            tipo VARCHAR(50) NOT NULL,
            titulo VARCHAR(255) NOT NULL,
            descripcion TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
    END IF;
    
    -- Agregar columna created_at si no existe
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'actividad_sistema' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE actividad_sistema ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
        -- Actualizar valores NULL
        UPDATE actividad_sistema SET created_at = NOW() WHERE created_at IS NULL;
    END IF;
END $$;

-- Crear índice en created_at si no existe
CREATE INDEX IF NOT EXISTS idx_actividad_sistema_created_at 
ON actividad_sistema(created_at DESC);

-- Función para archivar actividades (mejorada)
CREATE OR REPLACE FUNCTION archivar_actividades_antiguas(dias_retencion INTEGER DEFAULT 90)
RETURNS JSONB AS $$
DECLARE
    registros_archivados INTEGER;
    fecha_antigua TIMESTAMP;
    fecha_reciente TIMESTAMP;
BEGIN
    -- Obtener rango de fechas a archivar
    SELECT MIN(created_at), MAX(created_at)
    INTO fecha_antigua, fecha_reciente
    FROM actividad_sistema
    WHERE created_at < NOW() - INTERVAL '1 day' * dias_retencion;
    
    -- Copiar actividades antiguas a la tabla de archivo
    INSERT INTO actividad_sistema_archivo (usuario_id, tipo, titulo, descripcion, created_at)
    SELECT usuario_id, tipo, titulo, descripcion, created_at
    FROM actividad_sistema
    WHERE created_at < NOW() - INTERVAL '1 day' * dias_retencion;
    
    GET DIAGNOSTICS registros_archivados = ROW_COUNT;
    
    -- Eliminar de la tabla activa
    DELETE FROM actividad_sistema
    WHERE created_at < NOW() - INTERVAL '1 day' * dias_retencion;
    
    RETURN jsonb_build_object(
        'archivados', registros_archivados,
        'fecha_mas_antigua', fecha_antigua,
        'fecha_mas_reciente', fecha_reciente
    );
END;
$$ LANGUAGE plpgsql;

-- Función para limpiar archivo antiguo
CREATE OR REPLACE FUNCTION limpiar_archivo_antiguo(dias_total INTEGER DEFAULT 365)
RETURNS JSONB AS $$
DECLARE
    registros_eliminados INTEGER;
BEGIN
    DELETE FROM actividad_sistema_archivo
    WHERE created_at < NOW() - INTERVAL '1 day' * dias_total;
    
    GET DIAGNOSTICS registros_eliminados = ROW_COUNT;
    
    RETURN jsonb_build_object('eliminados', registros_eliminados);
END;
$$ LANGUAGE plpgsql;

-- Función para obtener estadísticas de tareas
CREATE OR REPLACE FUNCTION obtener_estadisticas_tareas()
RETURNS JSONB AS $$
DECLARE
    resultado JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_ejecuciones', COUNT(*),
        'exitosas', COUNT(*) FILTER (WHERE estado = 'completada'),
        'con_errores', COUNT(*) FILTER (WHERE estado = 'error'),
        'duracion_promedio_ms', COALESCE(AVG(duracion_ms), 0)
    )
    INTO resultado
    FROM logs_tareas_programadas
    WHERE fecha_inicio > NOW() - INTERVAL '30 days';
    
    RETURN resultado;
END;
$$ LANGUAGE plpgsql;
