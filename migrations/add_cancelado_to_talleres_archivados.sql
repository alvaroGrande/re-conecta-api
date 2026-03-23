-- ====================================
-- MIGRACIÓN: Añadir campos de cancelación a talleres_archivados
-- ====================================
-- Ejecutar en Supabase SQL Editor si la tabla ya existe

ALTER TABLE talleres_archivados
  ADD COLUMN IF NOT EXISTS cancelado          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS motivo_cancelacion VARCHAR(500);

-- Índice opcional para filtrar rápido por talleres cancelados
CREATE INDEX IF NOT EXISTS idx_talleres_archivados_cancelado
  ON talleres_archivados (cancelado)
  WHERE cancelado = TRUE;
