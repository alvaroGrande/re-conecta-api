-- ============================================
-- MIGRACIÓN: Corregir tipo de usuario_id en encuestas
-- Cambiar de BIGINT a UUID para compatibilidad con appUsers
-- ============================================

-- 1. Eliminar constraint UNIQUE si existe
ALTER TABLE encuestas_respuestas 
DROP CONSTRAINT IF EXISTS encuestas_respuestas_encuesta_id_usuario_id_key;

-- 2. Cambiar tipo de usuario_id de BIGINT a UUID
ALTER TABLE encuestas_respuestas 
ALTER COLUMN usuario_id TYPE UUID USING NULL;

-- 3. Agregar foreign key a appUsers
ALTER TABLE encuestas_respuestas 
ADD CONSTRAINT encuestas_respuestas_usuario_id_fkey 
FOREIGN KEY (usuario_id) REFERENCES "appUsers"(id) ON DELETE CASCADE;

-- 4. Restaurar constraint UNIQUE
ALTER TABLE encuestas_respuestas 
ADD CONSTRAINT encuestas_respuestas_encuesta_id_usuario_id_key 
UNIQUE(encuesta_id, usuario_id);

-- 5. Crear índice para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_encuestas_respuestas_usuario_id 
ON encuestas_respuestas(usuario_id);

CREATE INDEX IF NOT EXISTS idx_encuestas_respuestas_encuesta_id 
ON encuestas_respuestas(encuesta_id);

-- Verificación
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'encuestas_respuestas' 
  AND column_name = 'usuario_id';
