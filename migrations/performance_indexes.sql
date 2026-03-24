-- Índices adicionales para optimizar queries frecuentes
-- Ejecutar en la base de datos de Supabase

-- Mejorar queries de instructores y usuarios coordinados
CREATE INDEX IF NOT EXISTS idx_usuarios_instructores_instructor 
  ON usuarios_instructores(instructor_id);

CREATE INDEX IF NOT EXISTS idx_usuarios_instructores_usuario 
  ON usuarios_instructores(usuario_id);

-- Mejorar queries de usuarios activos por rol
CREATE INDEX IF NOT EXISTS idx_appusers_rol 
  ON "appUsers"(rol);

-- Optimizar queries de actividad reciente por usuario
CREATE INDEX IF NOT EXISTS idx_actividad_usuario_fecha 
  ON actividad_sistema(usuario_id, created_at DESC);

-- Mejorar queries de notificaciones
CREATE INDEX IF NOT EXISTS idx_notificaciones_receptor_leida 
  ON notificaciones(receptor_id, leida, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notificaciones_receptor_noleida 
  ON notificaciones(receptor_id) WHERE leida = false;

-- Optimizar queries de talleres activos
CREATE INDEX IF NOT EXISTS idx_talleres_activo_fecha 
  ON talleres(activo, fecha DESC);

-- Analizar tablas para actualizar estadísticas
ANALYZE actividad_sistema;
ANALYZE "appUsers";
ANALYZE usuarios_instructores;
ANALYZE notificaciones;
ANALYZE talleres;

-- ============================================================
-- Índice en ultimoInicio (usado intensivamente en el dashboard)
-- Cubre: WHERE ultimoInicio >= fecha AND ultimoInicio IS NOT NULL
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_appusers_ultimo_inicio
  ON "appUsers"(ultimoInicio DESC)
  WHERE ultimoInicio IS NOT NULL;

-- Índice en ultima_actividad (usuarios conectados últimos 5 min)
CREATE INDEX IF NOT EXISTS idx_appusers_ultima_actividad
  ON "appUsers"(ultima_actividad DESC)
  WHERE ultima_actividad IS NOT NULL;

-- ============================================================
-- Índices para tablas de encuestas
-- ============================================================

-- Listado de encuestas filtrado por estado (fecha_fin) y rol_objetivo
-- Cubre la consulta: WHERE fecha_fin > hoy AND (rol_objetivo IS NULL OR rol_objetivo = ?)
CREATE INDEX IF NOT EXISTS idx_encuestas_fecha_fin
  ON encuestas(fecha_fin);

CREATE INDEX IF NOT EXISTS idx_encuestas_rol_objetivo_fecha_fin
  ON encuestas(rol_objetivo, fecha_fin);

-- Verificar si un usuario ya respondió una encuesta (query muy frecuente)
CREATE INDEX IF NOT EXISTS idx_encuestas_respuestas_encuesta_usuario
  ON encuestas_respuestas(encuesta_id, usuario_id);

-- Conteo de respuestas por encuesta (relación anidada en obtenerEncuestas)
CREATE INDEX IF NOT EXISTS idx_encuestas_respuestas_encuesta_id
  ON encuestas_respuestas(encuesta_id);

-- Agregación de resultados: GROUP BY pregunta_id, opcion_id
CREATE INDEX IF NOT EXISTS idx_encuestas_respuestas_detalle_pregunta_opcion
  ON encuestas_respuestas_detalle(pregunta_id, opcion_id);

-- JOIN frecuente: respuesta_id → encuesta_id
CREATE INDEX IF NOT EXISTS idx_encuestas_respuestas_detalle_respuesta_id
  ON encuestas_respuestas_detalle(respuesta_id, pregunta_id);

-- Preguntas por encuesta (carga de estructura)
CREATE INDEX IF NOT EXISTS idx_encuestas_preguntas_encuesta_id
  ON encuestas_preguntas(encuesta_id, orden);

-- Opciones por pregunta
CREATE INDEX IF NOT EXISTS idx_encuestas_opciones_pregunta_id
  ON encuestas_opciones(pregunta_id, orden);

ANALYZE encuestas;
ANALYZE encuestas_preguntas;
ANALYZE encuestas_opciones;
ANALYZE encuestas_respuestas;
ANALYZE encuestas_respuestas_detalle;

-- ============================================================
-- Función RPC para agregar resultados en la base de datos
-- Evita traer miles de filas a Node.js para contarlas en JS
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- CREATE OR REPLACE FUNCTION contar_respuestas_encuesta(p_encuesta_id INT)
-- RETURNS TABLE(pregunta_id INT, opcion_id INT, texto_respuesta TEXT, votos BIGINT)
-- LANGUAGE sql STABLE AS $$
--   SELECT
--     erd.pregunta_id,
--     erd.opcion_id,
--     erd.texto_respuesta,
--     COUNT(*) AS votos
--   FROM encuestas_respuestas_detalle erd
--   JOIN encuestas_respuestas er ON er.id = erd.respuesta_id
--   WHERE er.encuesta_id = p_encuesta_id
--   GROUP BY erd.pregunta_id, erd.opcion_id, erd.texto_respuesta;
-- $$;

-- Verificar índices existentes (consulta informativa)
-- SELECT tablename, indexname, indexdef 
-- FROM pg_indexes 
-- WHERE schemaname = 'public' 
-- ORDER BY tablename, indexname;
