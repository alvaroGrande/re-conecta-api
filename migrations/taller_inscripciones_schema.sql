-- Migración: tabla de inscripciones individuales a talleres
-- Permite rastrear qué usuario está inscrito en qué taller
-- y quién realizó la inscripción (null = se apuntó solo, id = monitor que lo apuntó)

CREATE TABLE IF NOT EXISTS taller_inscripciones (
  id                BIGSERIAL    PRIMARY KEY,
  taller_id         UUID         NOT NULL REFERENCES talleres(id) ON DELETE CASCADE,
  usuario_id        UUID         NOT NULL REFERENCES "appUsers"(id) ON DELETE CASCADE,
  fecha_inscripcion TIMESTAMPTZ  DEFAULT NOW(),
  inscrito_por      UUID         REFERENCES "appUsers"(id),  -- NULL = auto-inscripción
  CONSTRAINT uq_taller_usuario UNIQUE (taller_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_ti_taller_id   ON taller_inscripciones (taller_id);
CREATE INDEX IF NOT EXISTS idx_ti_usuario_id  ON taller_inscripciones (usuario_id);

-- Asegurarse de que la columna inscritos existe en talleres (por si no se creó antes)
ALTER TABLE talleres ADD COLUMN IF NOT EXISTS inscritos INTEGER DEFAULT 0;
