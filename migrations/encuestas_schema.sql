-- ============================================
-- SCRIPT DE CREACIÓN DE TABLAS PARA ENCUESTAS
-- Sistema de encuestas para reConecta
-- ============================================

-- Tabla principal de encuestas
CREATE TABLE IF NOT EXISTS encuestas (
  id BIGSERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  fecha_fin DATE NOT NULL,
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de preguntas
CREATE TABLE IF NOT EXISTS encuestas_preguntas (
  id BIGSERIAL PRIMARY KEY,
  encuesta_id BIGINT NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('multiple', 'abierta')),
  orden INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de opciones (solo para preguntas tipo 'multiple')
CREATE TABLE IF NOT EXISTS encuestas_opciones (
  id BIGSERIAL PRIMARY KEY,
  pregunta_id BIGINT NOT NULL REFERENCES encuestas_preguntas(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de respuestas (una por usuario y encuesta)
CREATE TABLE IF NOT EXISTS encuestas_respuestas (
  id BIGSERIAL PRIMARY KEY,
  encuesta_id BIGINT NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
  usuario_id BIGINT NOT NULL,
  fecha_respuesta TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(encuesta_id, usuario_id) -- Un usuario solo puede responder una vez
);

-- Tabla de detalles de respuestas (múltiples entradas por respuesta)
CREATE TABLE IF NOT EXISTS encuestas_respuestas_detalle (
  id BIGSERIAL PRIMARY KEY,
  respuesta_id BIGINT NOT NULL REFERENCES encuestas_respuestas(id) ON DELETE CASCADE,
  pregunta_id BIGINT NOT NULL REFERENCES encuestas_preguntas(id) ON DELETE CASCADE,
  opcion_id BIGINT REFERENCES encuestas_opciones(id) ON DELETE CASCADE,
  texto_respuesta TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_encuestas_fecha_fin ON encuestas(fecha_fin);
CREATE INDEX IF NOT EXISTS idx_preguntas_encuesta ON encuestas_preguntas(encuesta_id);
CREATE INDEX IF NOT EXISTS idx_opciones_pregunta ON encuestas_opciones(pregunta_id);
CREATE INDEX IF NOT EXISTS idx_respuestas_encuesta ON encuestas_respuestas(encuesta_id);
CREATE INDEX IF NOT EXISTS idx_respuestas_usuario ON encuestas_respuestas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_detalle_respuesta ON encuestas_respuestas_detalle(respuesta_id);
CREATE INDEX IF NOT EXISTS idx_detalle_pregunta ON encuestas_respuestas_detalle(pregunta_id);

-- Comentarios para documentación
COMMENT ON TABLE encuestas IS 'Tabla principal de encuestas del sistema';
COMMENT ON TABLE encuestas_preguntas IS 'Preguntas asociadas a cada encuesta';
COMMENT ON TABLE encuestas_opciones IS 'Opciones de respuesta para preguntas de tipo multiple';
COMMENT ON TABLE encuestas_respuestas IS 'Registro de qué usuarios han respondido qué encuestas';
COMMENT ON TABLE encuestas_respuestas_detalle IS 'Respuestas específicas a cada pregunta';

-- ============================================
-- DATOS DE EJEMPLO (OPCIONAL)
-- ============================================

-- Encuesta de ejemplo 1
INSERT INTO encuestas (titulo, descripcion, fecha_fin) VALUES
('¿Cómo evalúas la calidad de nuestros talleres?', 
 'Queremos conocer tu opinión sobre la experiencia en nuestros talleres educativos.', 
 '2025-12-31');

-- Preguntas para la encuesta 1
INSERT INTO encuestas_preguntas (encuesta_id, texto, tipo, orden) VALUES
(1, '¿Qué calificación le das a los talleres?', 'multiple', 1),
(1, '¿Qué temas te gustaría que tratemos?', 'abierta', 2);

-- Opciones para la primera pregunta
INSERT INTO encuestas_opciones (pregunta_id, texto, orden) VALUES
(1, 'Excelente', 1),
(1, 'Bueno', 2),
(1, 'Regular', 3),
(1, 'Necesita mejora', 4);

-- Encuesta de ejemplo 2
INSERT INTO encuestas (titulo, descripcion, fecha_fin) VALUES
('Satisfacción con plataforma de videoconferencia', 
 'Ayúdanos a mejorar tu experiencia en nuestras sesiones de video llamada.', 
 '2025-12-25');

-- Preguntas para la encuesta 2
INSERT INTO encuestas_preguntas (encuesta_id, texto, tipo, orden) VALUES
(2, '¿La calidad de video y audio es clara?', 'multiple', 1),
(2, '¿Tuviste problemas técnicos?', 'abierta', 2);

-- Opciones para la pregunta de la encuesta 2
INSERT INTO encuestas_opciones (pregunta_id, texto, orden) VALUES
(3, 'Muy clara', 1),
(3, 'Clara', 2),
(3, 'Aceptable', 3),
(3, 'Deficiente', 4);

-- ============================================
-- POLÍTICAS DE SEGURIDAD (Row Level Security)
-- Descomenta si usas RLS en Supabase
-- ============================================

-- ALTER TABLE encuestas ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE encuestas_preguntas ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE encuestas_opciones ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE encuestas_respuestas ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE encuestas_respuestas_detalle ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden leer encuestas
-- CREATE POLICY "Encuestas son visibles para todos" ON encuestas FOR SELECT USING (true);

-- Política: Solo admins pueden crear encuestas
-- CREATE POLICY "Solo admins crean encuestas" ON encuestas FOR INSERT 
--   WITH CHECK (auth.jwt() ->> 'rol' = '1');

-- Política: Todos pueden leer preguntas y opciones
-- CREATE POLICY "Preguntas son visibles para todos" ON encuestas_preguntas FOR SELECT USING (true);
-- CREATE POLICY "Opciones son visibles para todos" ON encuestas_opciones FOR SELECT USING (true);

-- Política: Usuarios pueden crear sus propias respuestas
-- CREATE POLICY "Usuarios pueden responder" ON encuestas_respuestas FOR INSERT 
--   WITH CHECK (auth.uid() = usuario_id);

-- Política: Usuarios pueden ver sus propias respuestas
-- CREATE POLICY "Usuarios ven sus respuestas" ON encuestas_respuestas FOR SELECT 
--   USING (auth.uid() = usuario_id);
