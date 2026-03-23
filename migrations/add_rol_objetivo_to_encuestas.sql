-- Agregar columna rol_objetivo a la tabla encuestas
-- Esta columna permite filtrar encuestas por rol de usuario

ALTER TABLE encuestas 
ADD COLUMN IF NOT EXISTS rol_objetivo INTEGER;

-- Agregar comentario explicativo
COMMENT ON COLUMN encuestas.rol_objetivo IS 'Rol objetivo de la encuesta: 1=Admin, 2=Coordinador, 3=Usuario, NULL=Todos';

-- Crear índice para optimizar consultas por rol
CREATE INDEX IF NOT EXISTS idx_encuestas_rol_objetivo ON encuestas(rol_objetivo);
