-- ============================================
-- SCRIPT DE CREACIÓN DE TABLA PARA VIDEOLLAMADAS
-- Sistema de registro de videollamadas Zoom para reConecta
-- ============================================

-- ============================================
-- CREAR TABLA
-- ============================================

CREATE TABLE IF NOT EXISTS videollamadas (
  id BIGSERIAL PRIMARY KEY,
  meeting_id VARCHAR(100) NOT NULL UNIQUE, -- ID de la reunión de Zoom
  meeting_number VARCHAR(100) NOT NULL, -- Número de la reunión
  topic VARCHAR(255) NOT NULL, -- Título de la reunión
  creator_id UUID NOT NULL REFERENCES "appUsers"(id) ON DELETE CASCADE, -- Creador de la reunión
  password VARCHAR(50), -- Contraseña de la reunión (puede ser vacía)
  join_url TEXT NOT NULL, -- URL para unirse a la reunión
  start_url TEXT, -- URL para iniciar la reunión (solo para host)
  duration INTEGER DEFAULT 40, -- Duración estimada en minutos
  num_participants INTEGER DEFAULT 0, -- Número de participantes esperados
  status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'in_progress', 'finished', 'cancelled'
  meeting_type VARCHAR(50) DEFAULT 'instant', -- 'instant', 'scheduled'
  start_time TIMESTAMP WITH TIME ZONE, -- Fecha y hora de inicio real
  end_time TIMESTAMP WITH TIME ZONE, -- Fecha y hora de fin real
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CREAR TABLA DE PARTICIPANTES
-- ============================================

CREATE TABLE IF NOT EXISTS videollamadas_participantes (
  id BIGSERIAL PRIMARY KEY,
  videollamada_id BIGINT NOT NULL REFERENCES videollamadas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES "appUsers"(id) ON DELETE SET NULL, -- Puede ser NULL si es invitado externo
  nombre VARCHAR(255), -- Nombre del participante (para externos)
  email VARCHAR(255), -- Email del participante
  rol VARCHAR(50) DEFAULT 'participant', -- 'host', 'participant'
  notificado BOOLEAN DEFAULT FALSE, -- Si se le envió notificación
  fecha_notificacion TIMESTAMP WITH TIME ZONE, -- Cuándo se envió la notificación
  unido BOOLEAN DEFAULT FALSE, -- Si se unió a la reunión
  fecha_union TIMESTAMP WITH TIME ZONE, -- Cuándo se unió
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(videollamada_id, usuario_id)
);

-- ============================================
-- ÍNDICES PARA MEJORAR EL RENDIMIENTO
-- ============================================

CREATE INDEX IF NOT EXISTS idx_videollamadas_creator ON videollamadas(creator_id);
CREATE INDEX IF NOT EXISTS idx_videollamadas_status ON videollamadas(status);
CREATE INDEX IF NOT EXISTS idx_videollamadas_created ON videollamadas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videollamadas_meeting_id ON videollamadas(meeting_id);

CREATE INDEX IF NOT EXISTS idx_participantes_videollamada ON videollamadas_participantes(videollamada_id);
CREATE INDEX IF NOT EXISTS idx_participantes_usuario ON videollamadas_participantes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_participantes_notificado ON videollamadas_participantes(notificado);

-- ============================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================

COMMENT ON TABLE videollamadas IS 'Registro de todas las videollamadas de Zoom creadas en el sistema';
COMMENT ON COLUMN videollamadas.meeting_id IS 'ID único de la reunión en Zoom';
COMMENT ON COLUMN videollamadas.status IS 'Estado de la reunión: scheduled, in_progress, finished, cancelled';
COMMENT ON COLUMN videollamadas.num_participants IS 'Número de participantes invitados/esperados';

COMMENT ON TABLE videollamadas_participantes IS 'Participantes de cada videollamada';
COMMENT ON COLUMN videollamadas_participantes.notificado IS 'Indica si se envió notificación al participante';
COMMENT ON COLUMN videollamadas_participantes.unido IS 'Indica si el participante se unió a la reunión';

-- ============================================
-- FUNCIÓN PARA ACTUALIZAR updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_videollamadas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para videollamadas
DROP TRIGGER IF EXISTS trigger_update_videollamadas_updated_at ON videollamadas;
CREATE TRIGGER trigger_update_videollamadas_updated_at
  BEFORE UPDATE ON videollamadas
  FOR EACH ROW
  EXECUTE FUNCTION update_videollamadas_updated_at();

-- Trigger para participantes
DROP TRIGGER IF EXISTS trigger_update_participantes_updated_at ON videollamadas_participantes;
CREATE TRIGGER trigger_update_participantes_updated_at
  BEFORE UPDATE ON videollamadas_participantes
  FOR EACH ROW
  EXECUTE FUNCTION update_videollamadas_updated_at();
