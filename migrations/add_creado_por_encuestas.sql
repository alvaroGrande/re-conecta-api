-- ============================================================
-- Agregar campo creado_por a encuestas
-- Permite distinguir encuestas de admin (null) vs coordinador (uuid)
-- ============================================================

ALTER TABLE encuestas
  ADD COLUMN IF NOT EXISTS creado_por UUID REFERENCES "appUsers"(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_encuestas_creado_por ON encuestas(creado_por);

COMMENT ON COLUMN encuestas.creado_por IS
  'NULL = creada por administrador. UUID = creada por el coordinador con ese id, visible solo para sus usuarios asignados.';
