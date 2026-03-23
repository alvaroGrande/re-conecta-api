-- ============================================
-- SCRIPT DE CREACIÓN DE TABLAS PARA CONTACTOS
-- Sistema de instructores y contactos para reConecta
-- ============================================

-- ============================================
-- ELIMINAR TABLAS EXISTENTES (SI EXISTEN)
-- ============================================
DROP TABLE IF EXISTS contactos CASCADE;
DROP TABLE IF EXISTS usuarios_instructores CASCADE;

-- ============================================
-- CREAR TABLAS
-- ============================================

-- Tabla de asignación de instructores a usuarios
CREATE TABLE IF NOT EXISTS usuarios_instructores (
  id BIGSERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES "appUsers"(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES "appUsers"(id) ON DELETE CASCADE,
  es_principal BOOLEAN DEFAULT FALSE,
  fecha_asignacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(usuario_id, instructor_id)
);

-- Tabla de contactos (usuarios que se agregan mutuamente)
CREATE TABLE IF NOT EXISTS contactos (
  id BIGSERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES "appUsers"(id) ON DELETE CASCADE,
  contacto_id UUID NOT NULL REFERENCES "appUsers"(id) ON DELETE CASCADE,
  fecha_agregado TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(usuario_id, contacto_id)
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_usuarios_instructores_usuario ON usuarios_instructores(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_instructores_instructor ON usuarios_instructores(instructor_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_instructores_principal ON usuarios_instructores(usuario_id, es_principal);
CREATE INDEX IF NOT EXISTS idx_contactos_usuario ON contactos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_contactos_contacto ON contactos(contacto_id);

-- Comentarios para documentación
COMMENT ON TABLE usuarios_instructores IS 'Relación entre usuarios normales e instructores asignados';
COMMENT ON TABLE contactos IS 'Lista de contactos agregados por cada usuario';
COMMENT ON COLUMN usuarios_instructores.es_principal IS 'Indica si este instructor es el principal del usuario';

-- Constraint: Solo un instructor principal por usuario
CREATE UNIQUE INDEX IF NOT EXISTS idx_un_instructor_principal 
  ON usuarios_instructores(usuario_id) 
  WHERE es_principal = TRUE;

-- ============================================
-- DATOS DE EJEMPLO (OPCIONAL)
-- ============================================

-- Usando UUIDs reales de la base de datos:
-- Usuario 1: 00579568-4a4c-4c6e-986f-17640a89a570
-- Usuario 2: 010635c6-2757-4b9d-a3e2-37b11386f858
-- Usuario 3: 02aeae5c-3182-4c2b-9c57-bc1a002165e6
-- Usuario 4: 25c21950-89bb-46dc-9168-f5ce438c2d08
-- Instructor: e3a64eef-5e7f-465a-8580-61bbb99f910e

-- Asignar instructor principal al usuario 1
INSERT INTO usuarios_instructores (usuario_id, instructor_id, es_principal) VALUES
('00579568-4a4c-4c6e-986f-17640a89a570', 'e3a64eef-5e7f-465a-8580-61bbb99f910e', TRUE)
ON CONFLICT (usuario_id, instructor_id) DO NOTHING;

-- Asignar instructor principal al usuario 2
INSERT INTO usuarios_instructores (usuario_id, instructor_id, es_principal) VALUES
('010635c6-2757-4b9d-a3e2-37b11386f858', 'e3a64eef-5e7f-465a-8580-61bbb99f910e', TRUE)
ON CONFLICT (usuario_id, instructor_id) DO NOTHING;

-- Asignar instructor principal al usuario 3
INSERT INTO usuarios_instructores (usuario_id, instructor_id, es_principal) VALUES
('02aeae5c-3182-4c2b-9c57-bc1a002165e6', 'e3a64eef-5e7f-465a-8580-61bbb99f910e', TRUE)
ON CONFLICT (usuario_id, instructor_id) DO NOTHING;

-- Agregar contactos de ejemplo
-- Usuario 1 tiene como contacto al usuario 2
INSERT INTO contactos (usuario_id, contacto_id) VALUES
('00579568-4a4c-4c6e-986f-17640a89a570', '010635c6-2757-4b9d-a3e2-37b11386f858')
ON CONFLICT (usuario_id, contacto_id) DO NOTHING;

-- Contacto bidireccional (usuario 2 también tiene a usuario 1 como contacto)
INSERT INTO contactos (usuario_id, contacto_id) VALUES
('010635c6-2757-4b9d-a3e2-37b11386f858', '00579568-4a4c-4c6e-986f-17640a89a570')
ON CONFLICT (usuario_id, contacto_id) DO NOTHING;

-- ============================================
-- POLÍTICAS DE SEGURIDAD (Row Level Security)
-- Descomenta si usas RLS en Supabase
-- ============================================

-- ALTER TABLE usuarios_instructores ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE contactos ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver sus propios instructores
-- CREATE POLICY "Usuarios ven sus instructores" ON usuarios_instructores FOR SELECT 
--   USING (auth.uid() = usuario_id);

-- Política: Los instructores pueden ver sus asignaciones
-- CREATE POLICY "Instructores ven sus asignaciones" ON usuarios_instructores FOR SELECT 
--   USING (auth.uid() = instructor_id);

-- Política: Los usuarios pueden ver sus propios contactos
-- CREATE POLICY "Usuarios ven sus contactos" ON contactos FOR SELECT 
--   USING (auth.uid() = usuario_id OR auth.uid() = contacto_id);

-- Política: Los usuarios pueden agregar contactos
-- CREATE POLICY "Usuarios agregan contactos" ON contactos FOR INSERT 
--   WITH CHECK (auth.uid() = usuario_id);

-- Política: Los usuarios pueden eliminar sus contactos
-- CREATE POLICY "Usuarios eliminan contactos" ON contactos FOR DELETE 
--   USING (auth.uid() = usuario_id);
