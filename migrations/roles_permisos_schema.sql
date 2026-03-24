-- ============================================
-- SCRIPT DE CREACIÓN DE TABLA PARA ROLES Y PERMISOS
-- Permite configurar dinámicamente qué puede hacer cada rol
-- ============================================

-- ============================================
-- ELIMINAR TABLA EXISTENTE (SI EXISTE)
-- ============================================
DROP TABLE IF EXISTS roles_permisos CASCADE;

-- ============================================
-- CREAR TABLA
-- ============================================

CREATE TABLE IF NOT EXISTS roles_permisos (
  id        BIGSERIAL PRIMARY KEY,
  rol       SMALLINT    NOT NULL CHECK (rol IN (1, 2, 3)),
  -- 1 = Administrador, 2 = Coordinador, 3 = Usuario
  permiso   VARCHAR(80) NOT NULL,
  -- Formato: 'recurso:accion'  Ej: 'talleres:crear', 'usuarios:ver'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Garantizamos que cada (rol, permiso) es único
  CONSTRAINT uq_roles_permisos UNIQUE (rol, permiso)
);

-- ============================================
-- ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_roles_permisos_rol ON roles_permisos(rol);

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON TABLE  roles_permisos IS 'Permisos activos por rol. Una fila = un permiso activo para ese rol.';
COMMENT ON COLUMN roles_permisos.rol     IS '1 = Administrador (no editable), 2 = Coordinador, 3 = Usuario';
COMMENT ON COLUMN roles_permisos.permiso IS 'Permiso en formato recurso:accion (ej: talleres:crear)';

-- ============================================
-- DATOS INICIALES (valores por defecto del sistema)
-- ============================================

-- Administrador (rol 1) — todos los permisos
INSERT INTO roles_permisos (rol, permiso) VALUES
  (1, 'dashboard:ver'),
  (1, 'talleres:ver'),
  (1, 'talleres:crear'),
  (1, 'talleres:editar'),
  (1, 'talleres:eliminar'),
  (1, 'talleres:archivar'),
  (1, 'talleres:inscribir'),
  (1, 'talleres:ver_inscritos'),
  (1, 'talleres_archivados:ver'),
  (1, 'usuarios:ver'),
  (1, 'usuarios:ver_detalle'),
  (1, 'usuarios:crear'),
  (1, 'usuarios:editar'),
  (1, 'usuarios:eliminar'),
  (1, 'encuestas:ver'),
  (1, 'encuestas:crear'),
  (1, 'encuestas:editar'),
  (1, 'encuestas:eliminar'),
  (1, 'encuestas:responder'),
  (1, 'calendario:ver'),
  (1, 'videollamadas:ver'),
  (1, 'videollamadas:crear'),
  (1, 'videollamadas:gestionar'),
  (1, 'perfil:ver'),
  (1, 'perfil:editar'),
  (1, 'notificaciones:ver'),
  (1, 'notificaciones:crear'),
  (1, 'notificaciones:gestionar'),
  (1, 'reportes:ver'),
  (1, 'contactos:ver'),
  (1, 'contactos:gestionar'),
  (1, 'roles:gestionar')
ON CONFLICT (rol, permiso) DO NOTHING;

-- Coordinador (rol 2)
INSERT INTO roles_permisos (rol, permiso) VALUES
  (2, 'dashboard:ver'),
  (2, 'talleres:ver'),
  (2, 'talleres:editar'),
  (2, 'talleres:inscribir'),
  (2, 'talleres:ver_inscritos'),
  (2, 'usuarios:ver'),
  (2, 'usuarios:ver_detalle'),
  (2, 'encuestas:ver'),
  (2, 'encuestas:crear'),
  (2, 'encuestas:editar'),
  (2, 'encuestas:responder'),
  (2, 'calendario:ver'),
  (2, 'videollamadas:ver'),
  (2, 'videollamadas:crear'),
  (2, 'perfil:ver'),
  (2, 'perfil:editar'),
  (2, 'notificaciones:ver'),
  (2, 'notificaciones:crear'),
  (2, 'reportes:ver'),
  (2, 'contactos:ver'),
  (2, 'contactos:gestionar')
ON CONFLICT (rol, permiso) DO NOTHING;

-- Usuario (rol 3)
INSERT INTO roles_permisos (rol, permiso) VALUES
  (3, 'talleres:ver'),
  (3, 'talleres:inscribir'),
  (3, 'encuestas:ver'),
  (3, 'encuestas:responder'),
  (3, 'calendario:ver'),
  (3, 'videollamadas:ver'),
  (3, 'perfil:ver'),
  (3, 'perfil:editar'),
  (3, 'notificaciones:ver'),
  (3, 'contactos:ver')
ON CONFLICT (rol, permiso) DO NOTHING;
