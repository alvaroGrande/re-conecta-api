-- ============================================================
-- MIGRACIÓN: Añadir tipo 'directo' a la tabla chats
-- ============================================================

-- 1. Eliminar el check constraint existente sobre el tipo
ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_tipo_check;

-- 2. Añadir el nuevo check con 'directo' incluido
ALTER TABLE chats ADD CONSTRAINT chats_tipo_check
  CHECK (tipo IN ('general', 'grupal', 'directo'));

-- 3. Índice para buscar chats directos entre dos usuarios de forma eficiente
CREATE INDEX IF NOT EXISTS idx_chats_tipo ON chats(tipo);
