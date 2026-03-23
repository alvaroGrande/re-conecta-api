-- Script para mejorar el seguimiento de actividad en el sistema

-- 1. Añadir campo de actividad en tiempo real a appUsers (si no existe)
-- Este campo se actualizará en cada petición del usuario
ALTER TABLE "appUsers" 
ADD COLUMN IF NOT EXISTS ultima_actividad TIMESTAMP DEFAULT NOW();

COMMENT ON COLUMN "appUsers".ultima_actividad IS 'Timestamp de la última actividad del usuario en el sistema';

-- 2. Crear tabla de log de actividades del sistema
CREATE TABLE IF NOT EXISTS actividad_sistema (
  id SERIAL PRIMARY KEY,
  usuario_id UUID REFERENCES "appUsers"(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_actividad_sistema_created_at ON actividad_sistema(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_actividad_sistema_usuario ON actividad_sistema(usuario_id);
CREATE INDEX IF NOT EXISTS idx_actividad_sistema_tipo ON actividad_sistema(tipo);

COMMENT ON TABLE actividad_sistema IS 'Registro de actividades importantes del sistema para el dashboard de administración';

-- 3. Añadir campos de estadísticas a la tabla de talleres (si no existe)
-- Nota: La columna activo ya existe como SMALLINT (0/1)
ALTER TABLE talleres
ADD COLUMN IF NOT EXISTS fecha_inicio TIMESTAMP;

ALTER TABLE talleres
ADD COLUMN IF NOT EXISTS fecha_fin TIMESTAMP;

-- 4. Índices para mejorar rendimiento de queries del dashboard
CREATE INDEX IF NOT EXISTS idx_appusers_ultimo_inicio ON "appUsers"("ultimoInicio" DESC);
CREATE INDEX IF NOT EXISTS idx_appusers_ultima_actividad ON "appUsers"(ultima_actividad DESC);
CREATE INDEX IF NOT EXISTS idx_appusers_rol ON "appUsers"(rol);

-- Usar 1 en lugar de true porque activo es SMALLINT
CREATE INDEX IF NOT EXISTS idx_talleres_activo ON talleres(activo);
CREATE INDEX IF NOT EXISTS idx_talleres_fecha ON talleres(fecha DESC);

CREATE INDEX IF NOT EXISTS idx_encuestas_fecha_fin ON encuestas(fecha_fin);

-- 5. Función para registrar actividad del sistema (trigger automático)
CREATE OR REPLACE FUNCTION registrar_actividad_usuario()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar ultima_actividad cuando cambia ultimoInicio
  IF NEW."ultimoInicio" IS DISTINCT FROM OLD."ultimoInicio" THEN
    NEW.ultima_actividad = NOW();
    
    -- Registrar en log de actividad
    INSERT INTO actividad_sistema (usuario_id, tipo, titulo, descripcion)
    VALUES (
      NEW.id,
      'login',
      'Usuario conectado',
      CONCAT(NEW.nombre, ' ', NEW."Apellidos", ' inició sesión')
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para registrar logins
DROP TRIGGER IF EXISTS trigger_actividad_login ON "appUsers";
CREATE TRIGGER trigger_actividad_login
  BEFORE UPDATE ON "appUsers"
  FOR EACH ROW
  WHEN (NEW."ultimoInicio" IS DISTINCT FROM OLD."ultimoInicio")
  EXECUTE FUNCTION registrar_actividad_usuario();

-- 6. Vista materializada para estadísticas rápidas (opcional, mejor rendimiento)
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_stats AS
SELECT 
  (SELECT COUNT(*) FROM "appUsers") as total_usuarios,
  (SELECT COUNT(*) FROM "appUsers" WHERE "ultimoInicio" >= NOW() - INTERVAL '24 hours') as usuarios_activos_24h,
  (SELECT COUNT(*) FROM "appUsers" WHERE ultima_actividad >= NOW() - INTERVAL '5 minutes') as usuarios_conectados,
  (SELECT COUNT(*) FROM talleres WHERE activo = 1) as talleres_activos,
  (SELECT COUNT(*) FROM talleres WHERE fecha >= DATE_TRUNC('month', CURRENT_DATE)) as talleres_mes,
  (SELECT COUNT(*) FROM encuestas WHERE fecha_fin >= CURRENT_DATE) as encuestas_activas,
  (SELECT COUNT(*) FROM encuestas_respuestas) as total_respuestas_encuestas,
  NOW() as ultima_actualizacion;

-- Índice único para la vista materializada
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_stats_refresh ON dashboard_stats(ultima_actualizacion);

-- Función para refrescar estadísticas (ejecutar cada 5 minutos con un cron job o manualmente)
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats;
END;
$$ LANGUAGE plpgsql;
