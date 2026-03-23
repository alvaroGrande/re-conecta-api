-- ============================================================
-- Tabla catálogo: motivos_cancelacion
-- Almacena los motivos predefinidos por los que se puede
-- cancelar un taller (se carga en caché; cambia raramente).
-- ============================================================

CREATE TABLE IF NOT EXISTS motivos_cancelacion (
  id          SERIAL       PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  descripcion VARCHAR(255),
  activo      BOOLEAN      NOT NULL DEFAULT TRUE,
  orden       INTEGER      NOT NULL DEFAULT 0
);

-- Datos iniciales
INSERT INTO motivos_cancelacion (nombre, descripcion, orden) VALUES
  ('Falta de inscritos',                  'El taller no alcanzó el número mínimo de participantes requerido.',                               1),
  ('Adversidad climática',                'Las condiciones meteorológicas impiden la realización del taller de forma segura.',               2),
  ('Baja masiva de inscritos',            'Muchos participantes se dieron de baja, dejando el taller sin el quórum necesario.',             3),
  ('Indisposición del monitor',           'El monitor o instructor no puede asistir por enfermedad u otro motivo justificado.',             4),
  ('Problema con el espacio o instalaciones', 'El espacio donde se iba a realizar no está disponible o hay problemas técnicos.',            5),
  ('Conflicto de calendario',             'Coincidencia con otro evento o actividad que hace inviable la realización.',                     6),
  ('Causa de fuerza mayor',               'Circunstancias imprevistas o extraordinarias que impiden la realización.',                       7),
  ('Decisión institucional',              'Cancelación por decisión de la organización o entidad responsable.',                             8),
  ('Falta de recursos o materiales',      'No se dispone de los recursos o materiales necesarios para el desarrollo del taller.',           9),
  ('Reformulación del programa',          'El taller se cancela para ser reprogramado en otra fecha o con un formato diferente.',          10)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Añadir FK en talleres_archivados
-- El motivo_cancelacion_id referencia al catálogo.
-- El campo motivo_cancelacion (texto libre) se mantiene para
-- añadir notas adicionales sobre la cancelación.
-- ============================================================

ALTER TABLE talleres_archivados
  ADD COLUMN IF NOT EXISTS motivo_cancelacion_id INTEGER
    REFERENCES motivos_cancelacion(id) ON DELETE SET NULL;
