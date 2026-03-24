-- ============================================
-- SCRIPT DE CREACIÓN DE TABLA CATÁLOGO DE PERMISOS
-- Centraliza descripción, grupo e icono de cada permiso
-- ============================================

CREATE TABLE IF NOT EXISTS permisos_catalogo (
  permiso      VARCHAR(80) PRIMARY KEY,
  descripcion  TEXT        NOT NULL,
  grupo        VARCHAR(80) NOT NULL,
  grupo_icono  VARCHAR(80) NOT NULL DEFAULT 'pi pi-circle',
  orden_grupo  SMALLINT    NOT NULL DEFAULT 0,
  orden        SMALLINT    NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_permisos_catalogo_grupo
  ON permisos_catalogo(orden_grupo, orden);

COMMENT ON TABLE  permisos_catalogo IS 'Catálogo maestro de todos los permisos disponibles: descripción legible, agrupación e icono';
COMMENT ON COLUMN permisos_catalogo.permiso     IS 'Clave única del permiso en formato recurso:accion';
COMMENT ON COLUMN permisos_catalogo.descripcion IS 'Texto legible que se muestra en la UI';
COMMENT ON COLUMN permisos_catalogo.grupo       IS 'Grupo al que pertenece para agrupar en la tabla visual';
COMMENT ON COLUMN permisos_catalogo.grupo_icono IS 'Clase CSS de PrimeIcons para el grupo';
COMMENT ON COLUMN permisos_catalogo.orden_grupo IS 'Orden de aparición del grupo';
COMMENT ON COLUMN permisos_catalogo.orden       IS 'Orden del permiso dentro de su grupo';

-- ============================================
-- DATOS INICIALES — ON CONFLICT permite re-ejecutar sin duplicados
-- ============================================

INSERT INTO permisos_catalogo (permiso, descripcion, grupo, grupo_icono, orden_grupo, orden) VALUES
  -- Dashboard
  ('dashboard:ver',              'Ver dashboard analítico',              'Dashboard',      'pi pi-chart-bar',     1,  1),

  -- Talleres
  ('talleres:ver',               'Ver lista de talleres',                'Talleres',       'pi pi-calendar',      2,  1),
  ('talleres:crear',             'Crear talleres',                       'Talleres',       'pi pi-calendar',      2,  2),
  ('talleres:editar',            'Editar talleres',                      'Talleres',       'pi pi-calendar',      2,  3),
  ('talleres:eliminar',          'Eliminar talleres',                    'Talleres',       'pi pi-calendar',      2,  4),
  ('talleres:archivar',          'Archivar talleres',                    'Talleres',       'pi pi-calendar',      2,  5),
  ('talleres:inscribir',         'Inscribirse en talleres',              'Talleres',       'pi pi-calendar',      2,  6),
  ('talleres:ver_inscritos',     'Ver inscritos de un taller',           'Talleres',       'pi pi-calendar',      2,  7),
  ('talleres_archivados:ver',    'Ver talleres archivados',              'Talleres',       'pi pi-calendar',      2,  8),

  -- Usuarios
  ('usuarios:ver',               'Ver lista de usuarios',                'Usuarios',       'pi pi-users',         3,  1),
  ('usuarios:ver_detalle',       'Ver detalle de un usuario',            'Usuarios',       'pi pi-users',         3,  2),
  ('usuarios:crear',             'Crear usuarios',                       'Usuarios',       'pi pi-users',         3,  3),
  ('usuarios:editar',            'Editar usuarios',                      'Usuarios',       'pi pi-users',         3,  4),
  ('usuarios:eliminar',          'Eliminar usuarios',                    'Usuarios',       'pi pi-users',         3,  5),

  -- Encuestas
  ('encuestas:ver',              'Ver encuestas',                        'Encuestas',      'pi pi-chart-line',    4,  1),
  ('encuestas:crear',            'Crear encuestas',                      'Encuestas',      'pi pi-chart-line',    4,  2),
  ('encuestas:editar',           'Editar encuestas',                     'Encuestas',      'pi pi-chart-line',    4,  3),
  ('encuestas:eliminar',         'Eliminar encuestas',                   'Encuestas',      'pi pi-chart-line',    4,  4),
  ('encuestas:responder',        'Responder encuestas',                  'Encuestas',      'pi pi-chart-line',    4,  5),

  -- Calendario
  ('calendario:ver',             'Ver calendario',                       'Calendario',     'pi pi-calendar-times',5,  1),

  -- Videollamadas
  ('videollamadas:ver',          'Ver videollamadas',                    'Videollamadas',  'pi pi-video',         6,  1),
  ('videollamadas:crear',        'Crear videollamadas',                  'Videollamadas',  'pi pi-video',         6,  2),
  ('videollamadas:gestionar',    'Gestionar videollamadas',              'Videollamadas',  'pi pi-video',         6,  3),

  -- Perfil
  ('perfil:ver',                 'Ver propio perfil',                    'Perfil',         'pi pi-id-card',       7,  1),
  ('perfil:editar',              'Editar propio perfil',                 'Perfil',         'pi pi-id-card',       7,  2),

  -- Notificaciones
  ('notificaciones:ver',         'Recibir notificaciones',               'Notificaciones', 'pi pi-bell',          8,  1),
  ('notificaciones:crear',       'Crear notificaciones',                 'Notificaciones', 'pi pi-bell',          8,  2),
  ('notificaciones:gestionar',   'Gestionar todas las notificaciones',   'Notificaciones', 'pi pi-bell',          8,  3),

  -- Reportes
  ('reportes:ver',               'Ver reportes y analíticas',            'Reportes',       'pi pi-file-pdf',      9,  1),

  -- Contactos
  ('contactos:ver',              'Ver contactos',                        'Contactos',      'pi pi-address-book',  10, 1),
  ('contactos:gestionar',        'Gestionar contactos',                  'Contactos',      'pi pi-address-book',  10, 2),

  -- Administración
  ('roles:gestionar',            'Gestionar roles y permisos',           'Administración', 'pi pi-cog',           11, 1)

ON CONFLICT (permiso) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  grupo       = EXCLUDED.grupo,
  grupo_icono = EXCLUDED.grupo_icono,
  orden_grupo = EXCLUDED.orden_grupo,
  orden       = EXCLUDED.orden;
