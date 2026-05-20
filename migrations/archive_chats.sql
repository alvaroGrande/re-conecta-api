-- ============================================================
-- Archivado automático de chats inactivos
-- Añade columnas archivado / archivado_en a la tabla chats
-- y una función para consultar el último mensaje de cada chat
-- ============================================================

-- 1. Columnas de archivado en chats
ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS archivado     BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archivado_en  TIMESTAMPTZ;

-- 2. Índice para consultar chats archivados de un usuario rápidamente
CREATE INDEX IF NOT EXISTS idx_chats_archivado ON chats (archivado);

-- 3. Vista/función auxiliar: último mensaje de un chat
--    (usada por el scheduler para detectar inactividad)
CREATE OR REPLACE FUNCTION ultimo_mensaje_chat(p_chat_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE sql STABLE AS $$
  SELECT MAX(creado_en) FROM chat_mensajes WHERE chat_id = p_chat_id;
$$;

-- 4. Función: archivar chats inactivos pasado N días
--    - Nunca archiva el chat general (tipo = 'general')
--    - Devuelve el número de chats archivados
CREATE OR REPLACE FUNCTION archivar_chats_inactivos(p_dias_inactividad INT DEFAULT 30)
RETURNS TABLE (archivados INT)
LANGUAGE plpgsql AS $$
DECLARE
  v_fecha_corte TIMESTAMPTZ := NOW() - (p_dias_inactividad || ' days')::INTERVAL;
  v_archivados  INT := 0;
BEGIN
  -- Archivar chats cuyo último mensaje es anterior a la fecha de corte
  -- O que no tienen ningún mensaje y fueron creados antes de la fecha de corte
  UPDATE chats
  SET
    archivado    = TRUE,
    archivado_en = NOW()
  WHERE
    activo    = TRUE
    AND archivado = FALSE
    AND tipo  != 'general'
    AND (
      ultimo_mensaje_chat(id) < v_fecha_corte
      OR (ultimo_mensaje_chat(id) IS NULL AND creado_en < v_fecha_corte)
    );

  GET DIAGNOSTICS v_archivados = ROW_COUNT;

  RETURN QUERY SELECT v_archivados;
END;
$$;
