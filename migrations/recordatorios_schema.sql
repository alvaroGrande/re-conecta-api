-- ============================================
-- SCRIPT DE CREACIÓN DE TABLA PARA RECORDATORIOS DE CALENDARIO
-- Sistema de recordatorios personales y de administrador para reConecta
-- ============================================

CREATE TABLE IF NOT EXISTS recordatorios (
  id BIGSERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES "appUsers"(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  -- 'admin' = creado por admin/supervisor (visible para supervisores)
  -- 'user'  = recordatorio personal del usuario
  tipo VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (tipo IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_recordatorios_usuario ON recordatorios(usuario_id);
CREATE INDEX IF NOT EXISTS idx_recordatorios_fecha ON recordatorios(fecha);
CREATE INDEX IF NOT EXISTS idx_recordatorios_tipo ON recordatorios(tipo);

-- RLS: deshabilitado — el control de acceso se gestiona en la capa de API
ALTER TABLE recordatorios DISABLE ROW LEVEL SECURITY;
