-- ====================================
-- TABLAS DE ARCHIVO DE TALLERES
-- ====================================
-- Ejecutar en Supabase SQL Editor

-- Tabla principal: snapshot del taller en el momento de archivar
CREATE TABLE IF NOT EXISTS talleres_archivados (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    taller_id       UUID NOT NULL,              -- ID original (ya no existe en talleres)
    titulo          TEXT NOT NULL,
    descripcion     TEXT,
    fecha           TIMESTAMPTZ NOT NULL,        -- fecha del taller (usada para filtrar por año/mes)
    anio            INTEGER NOT NULL,            -- año del taller (calculado al archivar)
    mes             INTEGER NOT NULL,            -- mes del taller (calculado al archivar)
    duracion        NUMERIC,
    aforo           INTEGER,
    modalidad       TEXT,
    tipo_pago       TEXT,
    total_inscritos  INTEGER NOT NULL DEFAULT 0,
    total_asistentes INTEGER NOT NULL DEFAULT 0,
    cancelado        BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE si fue cancelado manualmente por un admin
    motivo_cancelacion VARCHAR(500),               -- razón de la cancelación (opcional, máx. 500 chars)
    datos_originales JSONB,                     -- copia completa del registro original
    archivado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archivado_por   UUID REFERENCES "appUsers"(id) ON DELETE SET NULL -- NULL = tarea automática
);

-- Tabla de inscripciones archivadas (quién estaba apuntado + si asistió)
CREATE TABLE IF NOT EXISTS taller_archivado_inscripciones (
    id                  BIGSERIAL PRIMARY KEY,
    taller_archivado_id UUID NOT NULL REFERENCES talleres_archivados(id) ON DELETE CASCADE,
    usuario_id          UUID NOT NULL REFERENCES "appUsers"(id) ON DELETE CASCADE,
    nombre_usuario      TEXT,       -- snapshot para no perder el nombre si el usuario se borra
    email_usuario       TEXT,
    inscrito_por        UUID,       -- quién inscribió (monitor, admin o null=auto)
    fecha_inscripcion   TIMESTAMPTZ,
    asistio             BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_asistencia    TIMESTAMPTZ,
    UNIQUE (taller_archivado_id, usuario_id)
);

-- Índices para las consultas más habituales
-- Filtrar por año y mes
CREATE INDEX IF NOT EXISTS idx_talleres_archivados_anio_mes  ON talleres_archivados (anio, mes);
CREATE INDEX IF NOT EXISTS idx_talleres_archivados_fecha     ON talleres_archivados (fecha DESC);
-- Buscar todos los talleres en que participó un usuario
CREATE INDEX IF NOT EXISTS idx_tai_usuario                   ON taller_archivado_inscripciones (usuario_id);
-- Buscar inscripciones de un taller archivado concreto
CREATE INDEX IF NOT EXISTS idx_tai_taller                    ON taller_archivado_inscripciones (taller_archivado_id);
