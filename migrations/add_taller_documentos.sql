-- ============================================
-- Tabla de documentos PDF adjuntos a talleres
-- ============================================
-- 1. Ejecutar este SQL en Supabase SQL Editor
-- 2. Crear bucket: Supabase Dashboard > Storage > New bucket
--    Name: taller-docs   |   Public: enabled

CREATE TABLE IF NOT EXISTS taller_documentos (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    taller_id   UUID        NOT NULL REFERENCES talleres(id) ON DELETE CASCADE,
    nombre      TEXT        NOT NULL,       -- nombre de archivo para mostrar
    url         TEXT        NOT NULL,       -- URL pública de Supabase Storage
    ruta        TEXT        NOT NULL,       -- ruta interna del bucket (para borrar)
    tamano      INTEGER,                    -- tamaño en bytes
    subido_por  UUID        REFERENCES "appUsers"(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taller_documentos_taller ON taller_documentos(taller_id);
