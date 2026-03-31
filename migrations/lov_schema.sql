-- ============================================================
-- LOV (List of Values) — tablas de configuración de dropdowns
-- ============================================================

CREATE TABLE IF NOT EXISTS lov_categorias (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          TEXT UNIQUE NOT NULL,
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  activo          BOOLEAN DEFAULT true,
  creado_en       TIMESTAMPTZ DEFAULT NOW(),
  creado_por      UUID REFERENCES "appUsers"(id) ON DELETE SET NULL,
  modificado_en   TIMESTAMPTZ,
  modificado_por  UUID REFERENCES "appUsers"(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS lov_valores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id    UUID NOT NULL REFERENCES lov_categorias(id) ON DELETE CASCADE,
  codigo          TEXT NOT NULL,
  nombre          TEXT NOT NULL,
  orden           INTEGER DEFAULT 0,
  activo          BOOLEAN DEFAULT true,
  creado_en       TIMESTAMPTZ DEFAULT NOW(),
  creado_por      UUID REFERENCES "appUsers"(id) ON DELETE SET NULL,
  modificado_en   TIMESTAMPTZ,
  modificado_por  UUID REFERENCES "appUsers"(id) ON DELETE SET NULL,
  UNIQUE(categoria_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_lov_valores_categoria ON lov_valores(categoria_id);

ALTER TABLE lov_categorias DISABLE ROW LEVEL SECURITY;
ALTER TABLE lov_valores    DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- Datos iniciales
-- ============================================================

INSERT INTO lov_categorias (codigo, nombre, descripcion) VALUES
  ('tipo_curso',  'Tipo de curso',  'Modalidad de impartición del taller'),
  ('tipo_pago',   'Tipo de pago',   'Modalidad de pago del taller')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO lov_valores (categoria_id, codigo, nombre, orden) VALUES
  ((SELECT id FROM lov_categorias WHERE codigo = 'tipo_curso'), 'presencial', 'Presencial', 1),
  ((SELECT id FROM lov_categorias WHERE codigo = 'tipo_curso'), 'online',     'Online',     2),
  ((SELECT id FROM lov_categorias WHERE codigo = 'tipo_pago'),  'gratis',     'Gratis',     1),
  ((SELECT id FROM lov_categorias WHERE codigo = 'tipo_pago'),  'pago',       'De pago',    2)
ON CONFLICT (categoria_id, codigo) DO NOTHING;
