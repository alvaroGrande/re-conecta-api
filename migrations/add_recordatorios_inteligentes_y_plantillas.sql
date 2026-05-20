-- ============================================================
--  Recordatorios inteligentes + Plantillas de encuestas
--  Roadmap 3.4 (recordatorios) y ampliación encuestas
-- ============================================================

-- ============================================================
-- 1. Tabla de seguimiento de recordatorios automáticos de talleres
--    Registra qué recordatorios (24h / 1h / 10min / post_taller)
--    ya han sido enviados para cada taller, evitando duplicados.
-- ============================================================
CREATE TABLE IF NOT EXISTS recordatorios_talleres (
  id          BIGSERIAL PRIMARY KEY,
  taller_id   UUID NOT NULL REFERENCES talleres(id) ON DELETE CASCADE,
  tipo        VARCHAR(15) NOT NULL
                CHECK (tipo IN ('24h', '1h', '10min', 'post_taller')),
  notificado_en TIMESTAMP WITH TIME ZONE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (taller_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_recordatorios_talleres_taller_id
  ON recordatorios_talleres (taller_id);

CREATE INDEX IF NOT EXISTS idx_recordatorios_talleres_tipo
  ON recordatorios_talleres (tipo);

COMMENT ON TABLE recordatorios_talleres IS
  'Seguimiento de recordatorios automáticos por taller (24h, 1h, 10min antes y post-taller)';

-- ============================================================
-- 2. Plantillas de encuestas
-- ============================================================
CREATE TABLE IF NOT EXISTS encuestas_plantillas (
  id           BIGSERIAL PRIMARY KEY,
  titulo       VARCHAR(255) NOT NULL,
  descripcion  TEXT,
  creado_por   UUID REFERENCES "appUsers"(id) ON DELETE SET NULL,
  rol_objetivo SMALLINT,          -- 1=admin, 2=coordinador, 3=usuario, NULL=todos
  version      INTEGER NOT NULL DEFAULT 1,
  activa       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_encuestas_plantillas_creado_por
  ON encuestas_plantillas (creado_por);

CREATE INDEX IF NOT EXISTS idx_encuestas_plantillas_activa
  ON encuestas_plantillas (activa);

COMMENT ON TABLE encuestas_plantillas IS
  'Plantillas reutilizables para crear encuestas con preguntas predefinidas';

-- ============================================================
-- 3. Preguntas de plantillas
-- ============================================================
CREATE TABLE IF NOT EXISTS encuestas_plantillas_preguntas (
  id           BIGSERIAL PRIMARY KEY,
  plantilla_id BIGINT NOT NULL REFERENCES encuestas_plantillas(id) ON DELETE CASCADE,
  texto        TEXT   NOT NULL,
  tipo         VARCHAR(10) NOT NULL CHECK (tipo IN ('multiple', 'abierta')),
  orden        INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plantillas_preguntas_plantilla_id
  ON encuestas_plantillas_preguntas (plantilla_id);

COMMENT ON TABLE encuestas_plantillas_preguntas IS
  'Preguntas predefinidas dentro de una plantilla de encuesta';

-- ============================================================
-- 4. Opciones de preguntas de plantillas (para tipo 'multiple')
-- ============================================================
CREATE TABLE IF NOT EXISTS encuestas_plantillas_opciones (
  id          BIGSERIAL PRIMARY KEY,
  pregunta_id BIGINT NOT NULL
                REFERENCES encuestas_plantillas_preguntas(id) ON DELETE CASCADE,
  texto       TEXT NOT NULL,
  orden       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_plantillas_opciones_pregunta_id
  ON encuestas_plantillas_opciones (pregunta_id);

COMMENT ON TABLE encuestas_plantillas_opciones IS
  'Opciones de respuesta para preguntas de tipo múltiple en plantillas';

-- ============================================================
-- 5. Trigger updated_at para encuestas_plantillas
-- ============================================================
CREATE OR REPLACE FUNCTION update_plantillas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_plantillas_updated_at ON encuestas_plantillas;
CREATE TRIGGER trg_plantillas_updated_at
  BEFORE UPDATE ON encuestas_plantillas
  FOR EACH ROW EXECUTE FUNCTION update_plantillas_updated_at();
