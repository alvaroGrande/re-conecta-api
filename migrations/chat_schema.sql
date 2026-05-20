-- ============================================================
-- SCHEMA: Sistema de Chat
-- Tablas: chats, chat_miembros, chat_mensajes
-- ============================================================

-- Chats (general y grupales)
CREATE TABLE IF NOT EXISTS chats (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        VARCHAR(120) NOT NULL,
  descripcion   TEXT,
  tipo          VARCHAR(10) NOT NULL CHECK (tipo IN ('general', 'grupal')),
  es_efimero    BOOLEAN NOT NULL DEFAULT FALSE,
  ttl_horas     INT DEFAULT NULL, -- horas hasta que expiran los mensajes (solo si es_efimero=true)
  creado_por    UUID REFERENCES "appUsers"(id) ON DELETE SET NULL,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activo        BOOLEAN NOT NULL DEFAULT TRUE
);

-- Miembros de cada chat
CREATE TABLE IF NOT EXISTS chat_miembros (
  id          BIGSERIAL PRIMARY KEY,
  chat_id     UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  usuario_id  UUID NOT NULL REFERENCES "appUsers"(id) ON DELETE CASCADE,
  unido_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chat_id, usuario_id)
);

-- Mensajes
CREATE TABLE IF NOT EXISTS chat_mensajes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id     UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  usuario_id  UUID NOT NULL REFERENCES "appUsers"(id) ON DELETE CASCADE,
  contenido   TEXT NOT NULL,
  expira_en   TIMESTAMPTZ DEFAULT NULL, -- rellenado si el chat es efímero
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_chat_miembros_usuario ON chat_miembros(usuario_id);
CREATE INDEX IF NOT EXISTS idx_chat_miembros_chat    ON chat_miembros(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_mensajes_chat    ON chat_mensajes(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_mensajes_expira  ON chat_mensajes(expira_en) WHERE expira_en IS NOT NULL;

-- Chat general (ID fijo para referencia en el frontend)
-- Ejecutar solo si no existe ya
INSERT INTO chats (id, nombre, descripcion, tipo, es_efimero, creado_por)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'General',
  'Chat abierto para todos los usuarios',
  'general',
  FALSE,
  NULL
)
ON CONFLICT (id) DO NOTHING;
