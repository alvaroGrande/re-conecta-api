-- ============================================
-- Añadir columna creado_por a la tabla talleres
-- Permite rastrear qué usuario (admin o coordinador) creó el taller
-- ============================================

ALTER TABLE talleres
  ADD COLUMN IF NOT EXISTS creado_por UUID REFERENCES "appUsers"(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_talleres_creado_por ON talleres(creado_por);

COMMENT ON COLUMN talleres.creado_por IS 'UUID del usuario que creo el taller (admin o coordinador)';

-- ============================================
-- Añadir permiso talleres:crear al Coordinador en la tabla de roles
-- ============================================

INSERT INTO roles_permisos (rol, permiso)
VALUES (2, 'talleres:crear')
ON CONFLICT (rol, permiso) DO NOTHING;
