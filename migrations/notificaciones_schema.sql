-- ============================================
-- SCRIPT DE CREACIÓN DE TABLA PARA NOTIFICACIONES
-- Sistema de notificaciones en tiempo real para reConecta
-- ============================================

-- ============================================
-- ELIMINAR TABLA EXISTENTE (SI EXISTE)
-- ============================================
DROP TABLE IF EXISTS notificaciones CASCADE;

-- ============================================
-- CREAR TABLA
-- ============================================

CREATE TABLE IF NOT EXISTS notificaciones (
  id BIGSERIAL PRIMARY KEY,
  emisor_id UUID NOT NULL REFERENCES "appUsers"(id) ON DELETE CASCADE,
  receptor_id UUID NOT NULL REFERENCES "appUsers"(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL, -- 'mensaje', 'anuncio', 'recordatorio', 'alerta'
  titulo VARCHAR(255) NOT NULL,
  contenido TEXT NOT NULL,
  url VARCHAR(500), -- URL opcional para redirigir al hacer clic
  leida BOOLEAN DEFAULT FALSE,
  fecha_lectura TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_notificaciones_receptor ON notificaciones(receptor_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_emisor ON notificaciones(emisor_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_leida ON notificaciones(receptor_id, leida);
CREATE INDEX IF NOT EXISTS idx_notificaciones_fecha ON notificaciones(created_at DESC);

-- Comentarios para documentación
COMMENT ON TABLE notificaciones IS 'Notificaciones entre usuarios, instructores y estudiantes';
COMMENT ON COLUMN notificaciones.tipo IS 'Tipo de notificación: mensaje, anuncio, recordatorio, alerta';
COMMENT ON COLUMN notificaciones.leida IS 'Indica si la notificación ha sido leída';
COMMENT ON COLUMN notificaciones.url IS 'URL opcional para redirigir cuando se hace clic en la notificación';

-- ============================================
-- DATOS DE EJEMPLO (OPCIONAL)
-- ============================================

-- Notificación de instructor a usuario
INSERT INTO notificaciones (emisor_id, receptor_id, tipo, titulo, contenido) VALUES
('e3a64eef-5e7f-465a-8580-61bbb99f910e', '00579568-4a4c-4c6e-986f-17640a89a570', 'anuncio', 'Nuevo taller disponible', 'Se ha programado un nuevo taller de mindfulness para el próximo lunes. ¡No te lo pierdas!')
ON CONFLICT DO NOTHING;

-- Notificación entre contactos
INSERT INTO notificaciones (emisor_id, receptor_id, tipo, titulo, contenido) VALUES
('010635c6-2757-4b9d-a3e2-37b11386f858', '00579568-4a4c-4c6e-986f-17640a89a570', 'mensaje', '¡Hola!', 'Me gustaría saber cómo te fue en la última sesión.')
ON CONFLICT DO NOTHING;

-- ============================================
-- FUNCIÓN PARA ACTUALIZAR updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at automáticamente
DROP TRIGGER IF EXISTS update_notificaciones_updated_at ON notificaciones;
CREATE TRIGGER update_notificaciones_updated_at
BEFORE UPDATE ON notificaciones
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
