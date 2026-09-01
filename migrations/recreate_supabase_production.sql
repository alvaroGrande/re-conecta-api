-- ============================================================
-- reConecta - Supabase production bootstrap
-- Objetivo: recrear la base de datos de forma segura, profesional y
-- con permisos / RLS coherentes con la app actual.
--
-- INSTRUCCIONES:
-- 1) Copia este archivo completo en el SQL editor de Supabase.
-- 2) Ejecuta en este orden.
-- 3) Revisa los mensajes de resultado. Si hay errores por existencia
--    previa, ajústalos a tu proyecto real antes de seguir.
-- ============================================================

BEGIN;

-- ============================================================
-- 0) LIMPIEZA INICIAL (DROP)
--    Elimina todos los objetos que crea este script para partir
--    de una base de datos vacía. ADVERTENCIA: esto borra
--    permanentemente cualquier dato existente en estas tablas.
--    El orden importa: primero triggers/vistas, luego tablas
--    (con CASCADE para arrastrar FKs, índices y funciones que
--    dependan de sus tipos compuestos, como "Apellidos"),
--    y por último las funciones que ya quedaron sin uso.
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP VIEW IF EXISTS public.ultimas_ejecuciones_tareas;

DROP TABLE IF EXISTS public.actividad_sistema_archivo CASCADE;
DROP TABLE IF EXISTS public.logs_tareas_programadas CASCADE;
DROP TABLE IF EXISTS public.taller_documentos CASCADE;
DROP TABLE IF EXISTS public.actividad_sistema CASCADE;
DROP TABLE IF EXISTS public.recordatorios CASCADE;
DROP TABLE IF EXISTS public.videollamadas_participantes CASCADE;
DROP TABLE IF EXISTS public.videollamadas CASCADE;
DROP TABLE IF EXISTS public.chat_mensajes CASCADE;
DROP TABLE IF EXISTS public.chat_miembros CASCADE;
DROP TABLE IF EXISTS public.chats CASCADE;
DROP TABLE IF EXISTS public.encuestas_respuestas_detalle CASCADE;
DROP TABLE IF EXISTS public.encuestas_respuestas CASCADE;
DROP TABLE IF EXISTS public.encuestas_opciones CASCADE;
DROP TABLE IF EXISTS public.encuestas_preguntas CASCADE;
DROP TABLE IF EXISTS public.encuestas CASCADE;
DROP TABLE IF EXISTS public.notificaciones_cola CASCADE;
DROP TABLE IF EXISTS public.notificaciones_config CASCADE;
DROP TABLE IF EXISTS public.notificaciones_plantillas CASCADE;
DROP TABLE IF EXISTS public.notificaciones CASCADE;
DROP TABLE IF EXISTS public.contactos CASCADE;
DROP TABLE IF EXISTS public.usuarios_instructores CASCADE;
DROP TABLE IF EXISTS public.taller_inscripciones CASCADE;
DROP TABLE IF EXISTS public.talleres CASCADE;
DROP TABLE IF EXISTS public.roles_permisos CASCADE;
DROP TABLE IF EXISTS public.permisos_catalogo CASCADE;
-- appUsers al final: su DROP ... CASCADE arrastra también la función
-- calculada "Apellidos", que depende de su tipo compuesto.
DROP TABLE IF EXISTS public."appUsers" CASCADE;

DROP FUNCTION IF EXISTS public.obtener_estadisticas_tareas();
DROP FUNCTION IF EXISTS public.limpiar_archivo_antiguo(INTEGER);
DROP FUNCTION IF EXISTS public.archivar_actividades_antiguas(INTEGER);
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.set_appusers_apellidos();
DROP FUNCTION IF EXISTS public.set_updated_at();

-- ============================================================
-- 1) EXTENSIONES BASE
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 2) TABLA PRINCIPAL DE USUARIOS
--    Esta tabla se usa como ‘profile’ del usuario autenticado.
-- ============================================================
CREATE TABLE IF NOT EXISTS public."appUsers" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  apellido1 TEXT NOT NULL,
  apellido2 TEXT DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  telefono TEXT,
  foto_perfil TEXT,
  fecha_nacimiento DATE,
  genero TEXT CHECK (genero IN ('hombre', 'mujer', 'otro', 'prefiero_no_decirlo')),
  pais TEXT DEFAULT 'España',
  ciudad TEXT,
  DNI TEXT,
  acepta_terminos BOOLEAN NOT NULL DEFAULT FALSE,
  rol SMALLINT NOT NULL DEFAULT 3 CHECK (rol IN (1, 2, 3)),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_inicio TIMESTAMPTZ,
  ultima_actividad TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_appusers_dni
ON public."appUsers"(DNI)
WHERE DNI IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appusers_email ON public."appUsers"(email);
CREATE INDEX IF NOT EXISTS idx_appusers_rol ON public."appUsers"(rol);
CREATE INDEX IF NOT EXISTS idx_appusers_activo ON public."appUsers"(activo);
CREATE INDEX IF NOT EXISTS idx_appusers_ultimo_inicio ON public."appUsers"(ultimo_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_appusers_ultima_actividad ON public."appUsers"(ultima_actividad DESC);

ALTER TABLE public."appUsers" ENABLE ROW LEVEL SECURITY;

-- Si la tabla venía de una versión anterior sin DEFAULT en id (necesario
-- para crear usuarios directamente desde la API sin pasar por Supabase Auth):
ALTER TABLE public."appUsers" ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public."appUsers"
  ADD COLUMN IF NOT EXISTS apellido1 TEXT,
  ADD COLUMN IF NOT EXISTS apellido2 TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS telefono TEXT,
  ADD COLUMN IF NOT EXISTS foto_perfil TEXT,
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
  ADD COLUMN IF NOT EXISTS genero TEXT,
  ADD COLUMN IF NOT EXISTS pais TEXT DEFAULT 'España',
  ADD COLUMN IF NOT EXISTS ciudad TEXT,
  ADD COLUMN IF NOT EXISTS DNI TEXT,
  ADD COLUMN IF NOT EXISTS acepta_terminos BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rol SMALLINT DEFAULT 3,
  ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS ultimo_inicio TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ultima_actividad TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Si la tabla venía de una versión anterior con la columna física Apellidos, se elimina:
-- ya no se guarda, se calcula al vuelo con la función "Apellidos" de más abajo.
DROP TRIGGER IF EXISTS trg_appusers_apellidos ON public."appUsers";
DROP FUNCTION IF EXISTS public.set_appusers_apellidos();
ALTER TABLE public."appUsers" DROP COLUMN IF EXISTS "Apellidos";

-- Columna calculada (PostgREST computed column): se expone como "Apellidos"
-- en cualquier .select('...Apellidos...') sin persistir el dato en disco.
CREATE OR REPLACE FUNCTION public."Apellidos"(u public."appUsers")
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(concat_ws(' ', u.apellido1, u.apellido2));
$$;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_appusers_updated_at ON public."appUsers";
CREATE TRIGGER trg_appusers_updated_at
BEFORE UPDATE ON public."appUsers"
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3) SINCRONIZACIÓN AUTOMÁTICA CON AUTH.USERS
--    Cuando se cree un usuario en Auth, se crea también su perfil.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public."appUsers" (id, nombre, apellido1, apellido2, email, activo, rol, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data->>'apellido1', COALESCE(NEW.raw_user_meta_data->>'Apellidos', 'Apellido')),
    COALESCE(NEW.raw_user_meta_data->>'apellido2', ''),
    NEW.email,
    TRUE,
    3,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 4) PERMISOS CATALOGADOS Y ROL-BASED ACCESS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.permisos_catalogo (
  permiso VARCHAR(80) PRIMARY KEY,
  descripcion TEXT NOT NULL,
  grupo VARCHAR(80) NOT NULL,
  grupo_icono VARCHAR(80) NOT NULL DEFAULT 'pi pi-circle',
  orden_grupo SMALLINT NOT NULL DEFAULT 0,
  orden SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.roles_permisos (
  id BIGSERIAL PRIMARY KEY,
  rol SMALLINT NOT NULL CHECK (rol IN (1, 2, 3)),
  permiso VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_roles_permisos UNIQUE (rol, permiso),
  CONSTRAINT fk_roles_permisos_permiso FOREIGN KEY (permiso) REFERENCES public.permisos_catalogo(permiso) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_roles_permisos_rol ON public.roles_permisos(rol);

INSERT INTO public.permisos_catalogo (permiso, descripcion, grupo, grupo_icono, orden_grupo, orden) VALUES
  ('dashboard:ver', 'Ver dashboard analítico', 'Dashboard', 'pi pi-chart-bar', 1, 1),
  ('talleres:ver', 'Ver lista de talleres', 'Talleres', 'pi pi-calendar', 2, 1),
  ('talleres:crear', 'Crear talleres', 'Talleres', 'pi pi-calendar', 2, 2),
  ('talleres:editar', 'Editar talleres', 'Talleres', 'pi pi-calendar', 2, 3),
  ('talleres:eliminar', 'Eliminar talleres', 'Talleres', 'pi pi-calendar', 2, 4),
  ('talleres:archivar', 'Archivar talleres', 'Talleres', 'pi pi-calendar', 2, 5),
  ('talleres:inscribir', 'Inscribirse en talleres', 'Talleres', 'pi pi-calendar', 2, 6),
  ('talleres:ver_inscritos', 'Ver inscritos de un taller', 'Talleres', 'pi pi-calendar', 2, 7),
  ('talleres_archivados:ver', 'Ver talleres archivados', 'Talleres', 'pi pi-calendar', 2, 8),
  ('usuarios:ver', 'Ver lista de usuarios', 'Usuarios', 'pi pi-users', 3, 1),
  ('usuarios:ver_detalle', 'Ver detalle de un usuario', 'Usuarios', 'pi pi-users', 3, 2),
  ('usuarios:crear', 'Crear usuarios', 'Usuarios', 'pi pi-users', 3, 3),
  ('usuarios:editar', 'Editar usuarios', 'Usuarios', 'pi pi-users', 3, 4),
  ('usuarios:eliminar', 'Eliminar usuarios', 'Usuarios', 'pi pi-users', 3, 5),
  ('encuestas:ver', 'Ver encuestas', 'Encuestas', 'pi pi-chart-line', 4, 1),
  ('encuestas:crear', 'Crear encuestas', 'Encuestas', 'pi pi-chart-line', 4, 2),
  ('encuestas:editar', 'Editar encuestas', 'Encuestas', 'pi pi-chart-line', 4, 3),
  ('encuestas:eliminar', 'Eliminar encuestas', 'Encuestas', 'pi pi-chart-line', 4, 4),
  ('encuestas:responder', 'Responder encuestas', 'Encuestas', 'pi pi-chart-line', 4, 5),
  ('calendario:ver', 'Ver calendario', 'Calendario', 'pi pi-calendar-times', 5, 1),
  ('videollamadas:ver', 'Ver videollamadas', 'Videollamadas', 'pi pi-video', 6, 1),
  ('videollamadas:crear', 'Crear videollamadas', 'Videollamadas', 'pi pi-video', 6, 2),
  ('videollamadas:gestionar', 'Gestionar videollamadas', 'Videollamadas', 'pi pi-video', 6, 3),
  ('perfil:ver', 'Ver propio perfil', 'Perfil', 'pi pi-id-card', 7, 1),
  ('perfil:editar', 'Editar propio perfil', 'Perfil', 'pi pi-id-card', 7, 2),
  ('notificaciones:ver', 'Recibir notificaciones', 'Notificaciones', 'pi pi-bell', 8, 1),
  ('notificaciones:crear', 'Crear notificaciones', 'Notificaciones', 'pi pi-bell', 8, 2),
  ('notificaciones:gestionar', 'Gestionar todas las notificaciones', 'Notificaciones', 'pi pi-bell', 8, 3),
  ('reportes:ver', 'Ver reportes y analíticas', 'Reportes', 'pi pi-file-pdf', 9, 1),
  ('contactos:ver', 'Ver contactos', 'Contactos', 'pi pi-address-book', 10, 1),
  ('contactos:gestionar', 'Gestionar contactos', 'Contactos', 'pi pi-address-book', 10, 2),
  ('roles:gestionar', 'Gestionar roles y permisos', 'Administración', 'pi pi-cog', 11, 1)
ON CONFLICT (permiso) DO NOTHING;

INSERT INTO public.roles_permisos (rol, permiso) VALUES
  (1, 'dashboard:ver'), (1, 'talleres:ver'), (1, 'talleres:crear'), (1, 'talleres:editar'), (1, 'talleres:eliminar'), (1, 'talleres:archivar'), (1, 'talleres:inscribir'), (1, 'talleres:ver_inscritos'), (1, 'talleres_archivados:ver'),
  (1, 'usuarios:ver'), (1, 'usuarios:ver_detalle'), (1, 'usuarios:crear'), (1, 'usuarios:editar'), (1, 'usuarios:eliminar'),
  (1, 'encuestas:ver'), (1, 'encuestas:crear'), (1, 'encuestas:editar'), (1, 'encuestas:eliminar'), (1, 'encuestas:responder'),
  (1, 'calendario:ver'), (1, 'videollamadas:ver'), (1, 'videollamadas:crear'), (1, 'videollamadas:gestionar'),
  (1, 'perfil:ver'), (1, 'perfil:editar'), (1, 'notificaciones:ver'), (1, 'notificaciones:crear'), (1, 'notificaciones:gestionar'), (1, 'reportes:ver'),
  (1, 'contactos:ver'), (1, 'contactos:gestionar'), (1, 'roles:gestionar')
ON CONFLICT (rol, permiso) DO NOTHING;

INSERT INTO public.roles_permisos (rol, permiso) VALUES
  (2, 'dashboard:ver'), (2, 'talleres:ver'), (2, 'talleres:editar'), (2, 'talleres:inscribir'), (2, 'talleres:ver_inscritos'),
  (2, 'usuarios:ver'), (2, 'usuarios:ver_detalle'), (2, 'encuestas:ver'), (2, 'encuestas:crear'), (2, 'encuestas:editar'), (2, 'encuestas:responder'),
  (2, 'calendario:ver'), (2, 'videollamadas:ver'), (2, 'videollamadas:crear'), (2, 'perfil:ver'), (2, 'perfil:editar'),
  (2, 'notificaciones:ver'), (2, 'notificaciones:crear'), (2, 'reportes:ver'), (2, 'contactos:ver'), (2, 'contactos:gestionar')
ON CONFLICT (rol, permiso) DO NOTHING;

INSERT INTO public.roles_permisos (rol, permiso) VALUES
  (3, 'talleres:ver'), (3, 'talleres:inscribir'), (3, 'encuestas:ver'), (3, 'encuestas:responder'), (3, 'calendario:ver'),
  (3, 'videollamadas:ver'), (3, 'perfil:ver'), (3, 'perfil:editar'), (3, 'notificaciones:ver'), (3, 'contactos:ver')
ON CONFLICT (rol, permiso) DO NOTHING;

-- ============================================================
-- 5) TABLAS DE DOMINIO DEL PRODUCTO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.talleres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  fecha TIMESTAMPTZ,
  duracion INTEGER DEFAULT 1,
  aforo INTEGER DEFAULT 0,
  activo SMALLINT NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  modalidad VARCHAR(50) DEFAULT 'online',
  tipo_pago VARCHAR(50) DEFAULT 'gratis',
  creado_por UUID REFERENCES public."appUsers"(id) ON DELETE SET NULL,
  inscritos INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.taller_inscripciones (
  id BIGSERIAL PRIMARY KEY,
  taller_id UUID NOT NULL REFERENCES public.talleres(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public."appUsers"(id) ON DELETE CASCADE,
  fecha_inscripcion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  inscrito_por UUID REFERENCES public."appUsers"(id) ON DELETE SET NULL,
  CONSTRAINT uq_taller_usuario UNIQUE (taller_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS public.usuarios_instructores (
  id BIGSERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES public."appUsers"(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES public."appUsers"(id) ON DELETE CASCADE,
  es_principal BOOLEAN DEFAULT FALSE,
  fecha_asignacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, instructor_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_un_instructor_principal
ON public.usuarios_instructores(usuario_id)
WHERE es_principal = TRUE;

CREATE TABLE IF NOT EXISTS public.contactos (
  id BIGSERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES public."appUsers"(id) ON DELETE CASCADE,
  contacto_id UUID NOT NULL REFERENCES public."appUsers"(id) ON DELETE CASCADE,
  fecha_agregado TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, contacto_id)
);

CREATE TABLE IF NOT EXISTS public.notificaciones (
  id BIGSERIAL PRIMARY KEY,
  emisor_id UUID NOT NULL REFERENCES public."appUsers"(id) ON DELETE CASCADE,
  receptor_id UUID NOT NULL REFERENCES public."appUsers"(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  contenido TEXT NOT NULL,
  url VARCHAR(500),
  leida BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_lectura TIMESTAMPTZ,
  canal VARCHAR(20) NOT NULL DEFAULT 'push',
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  intentos INTEGER NOT NULL DEFAULT 0,
  datos_adicionales JSONB,
  plantilla_id UUID,
  enviada_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notificaciones_plantillas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(100) UNIQUE NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  canal VARCHAR(20) NOT NULL,
  asunto VARCHAR(255),
  contenido TEXT NOT NULL,
  variables JSONB,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por UUID REFERENCES public."appUsers"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notificaciones_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public."appUsers"(id) ON DELETE CASCADE,
  tipo_evento VARCHAR(100) NOT NULL,
  canal VARCHAR(20) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, tipo_evento, canal)
);

CREATE TABLE IF NOT EXISTS public.notificaciones_cola (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notificacion_id BIGINT REFERENCES public.notificaciones(id) ON DELETE CASCADE,
  prioridad INTEGER NOT NULL DEFAULT 1,
  programado_para TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  procesado_en TIMESTAMPTZ,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  error_mensaje TEXT,
  intentos INTEGER NOT NULL DEFAULT 0,
  max_intentos INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.encuestas (
  id BIGSERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  fecha_fin DATE NOT NULL,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  rol_objetivo SMALLINT,
  creado_por UUID REFERENCES public."appUsers"(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.encuestas_preguntas (
  id BIGSERIAL PRIMARY KEY,
  encuesta_id BIGINT NOT NULL REFERENCES public.encuestas(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('multiple', 'abierta')),
  orden INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.encuestas_opciones (
  id BIGSERIAL PRIMARY KEY,
  pregunta_id BIGINT NOT NULL REFERENCES public.encuestas_preguntas(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.encuestas_respuestas (
  id BIGSERIAL PRIMARY KEY,
  encuesta_id BIGINT NOT NULL REFERENCES public.encuestas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public."appUsers"(id) ON DELETE CASCADE,
  fecha_respuesta TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (encuesta_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS public.encuestas_respuestas_detalle (
  id BIGSERIAL PRIMARY KEY,
  respuesta_id BIGINT NOT NULL REFERENCES public.encuestas_respuestas(id) ON DELETE CASCADE,
  pregunta_id BIGINT NOT NULL REFERENCES public.encuestas_preguntas(id) ON DELETE CASCADE,
  opcion_id BIGINT REFERENCES public.encuestas_opciones(id) ON DELETE CASCADE,
  texto_respuesta TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('general', 'grupal', 'directo')),
  es_efimero BOOLEAN NOT NULL DEFAULT FALSE,
  ttl_horas INTEGER,
  creado_por UUID REFERENCES public."appUsers"(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.chat_miembros (
  id BIGSERIAL PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public."appUsers"(id) ON DELETE CASCADE,
  unido_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chat_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS public.chat_mensajes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public."appUsers"(id) ON DELETE CASCADE,
  contenido TEXT NOT NULL,
  expira_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.videollamadas (
  id BIGSERIAL PRIMARY KEY,
  meeting_id VARCHAR(100) NOT NULL UNIQUE,
  meeting_number VARCHAR(100) NOT NULL,
  topic VARCHAR(255) NOT NULL,
  creator_id UUID NOT NULL REFERENCES public."appUsers"(id) ON DELETE CASCADE,
  password VARCHAR(50),
  join_url TEXT NOT NULL,
  start_url TEXT,
  duration INTEGER DEFAULT 40,
  num_participants INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'scheduled',
  meeting_type VARCHAR(50) DEFAULT 'instant',
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.videollamadas_participantes (
  id BIGSERIAL PRIMARY KEY,
  videollamada_id BIGINT NOT NULL REFERENCES public.videollamadas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES public."appUsers"(id) ON DELETE SET NULL,
  nombre VARCHAR(255),
  email VARCHAR(255),
  rol VARCHAR(50) DEFAULT 'participant',
  notificado BOOLEAN DEFAULT FALSE,
  fecha_notificacion TIMESTAMPTZ,
  unido BOOLEAN DEFAULT FALSE,
  fecha_union TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (videollamada_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS public.recordatorios (
  id BIGSERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES public."appUsers"(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  tipo VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (tipo IN ('admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.actividad_sistema (
  id BIGSERIAL PRIMARY KEY,
  usuario_id UUID REFERENCES public."appUsers"(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.taller_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taller_id UUID NOT NULL REFERENCES public.talleres(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  url TEXT NOT NULL,
  ruta TEXT NOT NULL,
  tamano INTEGER,
  subido_por UUID REFERENCES public."appUsers"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5.1) SEMILLA MÍNIMA: AL MENOS 1 USUARIO POR PERFIL
-- ============================================================
INSERT INTO public."appUsers" (id, nombre, apellido1, apellido2, email, telefono, foto_perfil, rol, activo, ultimo_inicio, ultima_actividad, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'Admin', 'Principal', '', 'admin@reconecta.local', '000000000', NULL, 1, TRUE, NOW(), NOW(), NOW(), NOW()),
  (gen_random_uuid(), 'Coordinador', 'Principal', '', 'coordinador@reconecta.local', '000000000', NULL, 2, TRUE, NOW(), NOW(), NOW(), NOW()),
  (gen_random_uuid(), 'Usuario', 'Demo', '', 'usuario@reconecta.local', '000000000', NULL, 3, TRUE, NOW(), NOW(), NOW(), NOW())
ON CONFLICT (email) DO UPDATE
SET nombre = EXCLUDED.nombre,
    apellido1 = EXCLUDED.apellido1,
    apellido2 = EXCLUDED.apellido2,
    telefono = EXCLUDED.telefono,
    rol = EXCLUDED.rol,
    activo = TRUE,
    ultimo_inicio = NOW(),
    ultima_actividad = NOW(),
    updated_at = NOW();

-- ============================================================
-- 6) ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_talleres_activo ON public.talleres(activo);
CREATE INDEX IF NOT EXISTS idx_talleres_fecha ON public.talleres(fecha);
CREATE INDEX IF NOT EXISTS idx_usuarios_instructores_usuario ON public.usuarios_instructores(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_instructores_instructor ON public.usuarios_instructores(instructor_id);
CREATE INDEX IF NOT EXISTS idx_contactos_usuario ON public.contactos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_contactos_contacto ON public.contactos(contacto_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_receptor ON public.notificaciones(receptor_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_estado ON public.notificaciones(estado);
CREATE INDEX IF NOT EXISTS idx_notificaciones_canal ON public.notificaciones(canal);
CREATE INDEX IF NOT EXISTS idx_encuestas_fecha_fin ON public.encuestas(fecha_fin);
CREATE INDEX IF NOT EXISTS idx_chat_miembros_usuario ON public.chat_miembros(usuario_id);
CREATE INDEX IF NOT EXISTS idx_chat_mensajes_chat ON public.chat_mensajes(chat_id);
CREATE INDEX IF NOT EXISTS idx_videollamadas_creator ON public.videollamadas(creator_id);
CREATE INDEX IF NOT EXISTS idx_recordatorios_usuario ON public.recordatorios(usuario_id);
CREATE INDEX IF NOT EXISTS idx_actividad_sistema_usuario ON public.actividad_sistema(usuario_id);

-- ============================================================
-- 7) RLS POLICIES 
--    Importante: se deja el control de acceso centralizado desde la API
--    pero se configuran políticas de seguridad básicas para evitar fugas.
-- ============================================================

-- appUsers: cada usuario ve su propio perfil; admins ven todo.
DROP POLICY IF EXISTS "appUsers_select_own" ON public."appUsers";
CREATE POLICY "appUsers_select_own" ON public."appUsers"
FOR SELECT
USING (auth.uid() = id OR EXISTS (
  SELECT 1 FROM public."appUsers" u
  WHERE u.id = auth.uid() AND u.rol = 1
));

DROP POLICY IF EXISTS "appUsers_update_own" ON public."appUsers";
CREATE POLICY "appUsers_update_own" ON public."appUsers"
FOR UPDATE
USING (auth.uid() = id OR EXISTS (
  SELECT 1 FROM public."appUsers" u
  WHERE u.id = auth.uid() AND u.rol = 1
))
WITH CHECK (auth.uid() = id OR EXISTS (
  SELECT 1 FROM public."appUsers" u
  WHERE u.id = auth.uid() AND u.rol = 1
));

DROP POLICY IF EXISTS "appUsers_insert_own" ON public."appUsers";
CREATE POLICY "appUsers_insert_own" ON public."appUsers"
FOR INSERT
WITH CHECK (auth.uid() = id);

-- talleres: lectura pública para activos, escritura admin/coordinador
DROP POLICY IF EXISTS "talleres_select_public_active" ON public.talleres;
CREATE POLICY "talleres_select_public_active" ON public.talleres
FOR SELECT
USING (activo = 1 OR EXISTS (
  SELECT 1 FROM public."appUsers" u WHERE u.id = auth.uid() AND u.rol IN (1, 2)
));

DROP POLICY IF EXISTS "talleres_write_admin" ON public.talleres;
CREATE POLICY "talleres_write_admin" ON public.talleres
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public."appUsers" u WHERE u.id = auth.uid() AND u.rol IN (1, 2))
);

CREATE POLICY "talleres_update_admin" ON public.talleres
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public."appUsers" u WHERE u.id = auth.uid() AND u.rol IN (1, 2))
);

-- tallers_inscripciones: usuario ve sus propias inscripciones; admins/coordinadores ver todo
DROP POLICY IF EXISTS "taller_inscripciones_select_own" ON public.taller_inscripciones;
CREATE POLICY "taller_inscripciones_select_own" ON public.taller_inscripciones
FOR SELECT USING (
  usuario_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public."appUsers" u WHERE u.id = auth.uid() AND u.rol IN (1, 2)
  )
);

-- notificaciones: usuarios ven solo las suyas
DROP POLICY IF EXISTS "notificaciones_select_own" ON public.notificaciones;
CREATE POLICY "notificaciones_select_own" ON public.notificaciones
FOR SELECT USING (
  receptor_id = auth.uid() OR emisor_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public."appUsers" u WHERE u.id = auth.uid() AND u.rol = 1
  )
);

DROP POLICY IF EXISTS "notificaciones_insert_own" ON public.notificaciones;
CREATE POLICY "notificaciones_insert_own" ON public.notificaciones
FOR INSERT WITH CHECK (
  emisor_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public."appUsers" u WHERE u.id = auth.uid() AND u.rol IN (1, 2)
  )
);

DROP POLICY IF EXISTS "notificaciones_update_own" ON public.notificaciones;
CREATE POLICY "notificaciones_update_own" ON public.notificaciones
FOR UPDATE USING (
  receptor_id = auth.uid() OR emisor_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public."appUsers" u WHERE u.id = auth.uid() AND u.rol IN (1, 2)
  )
);

-- encuestas: lectura pública, respuestas solo por usuario autenticado
DROP POLICY IF EXISTS "encuestas_select_public" ON public.encuestas;
CREATE POLICY "encuestas_select_public" ON public.encuestas
FOR SELECT USING (activo = TRUE OR EXISTS (
  SELECT 1 FROM public."appUsers" u WHERE u.id = auth.uid() AND u.rol IN (1, 2)
));

DROP POLICY IF EXISTS "encuestas_write_admin" ON public.encuestas;
CREATE POLICY "encuestas_write_admin" ON public.encuestas
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public."appUsers" u WHERE u.id = auth.uid() AND u.rol IN (1, 2))
);

DROP POLICY IF EXISTS "encuestas_respuestas_select_own" ON public.encuestas_respuestas;
CREATE POLICY "encuestas_respuestas_select_own" ON public.encuestas_respuestas
FOR SELECT USING (
  usuario_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public."appUsers" u WHERE u.id = auth.uid() AND u.rol IN (1, 2)
  )
);

DROP POLICY IF EXISTS "encuestas_respuestas_insert_own" ON public.encuestas_respuestas;
CREATE POLICY "encuestas_respuestas_insert_own" ON public.encuestas_respuestas
FOR INSERT WITH CHECK (usuario_id = auth.uid());

-- chats: cada usuario ve sus chats
DROP POLICY IF EXISTS "chat_miembros_select_own" ON public.chat_miembros;
CREATE POLICY "chat_miembros_select_own" ON public.chat_miembros
FOR SELECT USING (
  usuario_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public."appUsers" u WHERE u.id = auth.uid() AND u.rol = 1
  )
);

DROP POLICY IF EXISTS "chat_mensajes_select_own" ON public.chat_mensajes;
CREATE POLICY "chat_mensajes_select_own" ON public.chat_mensajes
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.chat_miembros cm
    WHERE cm.chat_id = chat_mensajes.chat_id AND cm.usuario_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public."appUsers" u WHERE u.id = auth.uid() AND u.rol = 1
  )
);

-- ============================================================
-- 8) STORAGE (buckets para avatars y documentos)
--    En Supabase, la creación de buckets suele hacerse desde el dashboard
--    o usando la SQL function storage.create_bucket() si tu proyecto lo soporta.
--    Este bloque es la forma profesional de dejarlo preparado.
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'supabase_storage'
  ) THEN
    -- si la extensión está disponible, intenta crear los buckets
    PERFORM storage.create_bucket('avatars', true);
    PERFORM storage.create_bucket('taller-docs', true);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'No se pudieron crear los buckets automáticamente; crea manualmente avatars y taller-docs desde Supabase Storage.';
END $$;

-- ============================================================
-- 9) POLÍTICAS DE STORAGE
--    Ajusta el acceso según estándares de producción.
-- ============================================================
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_users_upload" ON storage.objects;
CREATE POLICY "avatars_users_upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "avatars_users_update_own" ON storage.objects;
CREATE POLICY "avatars_users_update_own" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars' AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "taller_docs_public_read" ON storage.objects;
CREATE POLICY "taller_docs_public_read" ON storage.objects
FOR SELECT USING (bucket_id = 'taller-docs');

DROP POLICY IF EXISTS "taller_docs_admin_upload" ON storage.objects;
CREATE POLICY "taller_docs_admin_upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'taller-docs' AND EXISTS (
    SELECT 1 FROM public."appUsers" u WHERE u.id = auth.uid() AND u.rol IN (1, 2)
  )
);

-- ============================================================
-- 10) TRIGGERS DE FECHA / ACTUALIZACIÓN
-- ============================================================
DROP TRIGGER IF EXISTS trg_talleres_updated_at ON public.talleres;
CREATE TRIGGER trg_talleres_updated_at
BEFORE UPDATE ON public.talleres
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_notificaciones_updated_at ON public.notificaciones;
CREATE TRIGGER trg_notificaciones_updated_at
BEFORE UPDATE ON public.notificaciones
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_recordatorios_updated_at ON public.recordatorios;
CREATE TRIGGER trg_recordatorios_updated_at
BEFORE UPDATE ON public.recordatorios
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_videollamadas_updated_at ON public.videollamadas;
CREATE TRIGGER trg_videollamadas_updated_at
BEFORE UPDATE ON public.videollamadas
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_videollamadas_participantes_updated_at ON public.videollamadas_participantes;
CREATE TRIGGER trg_videollamadas_participantes_updated_at
BEFORE UPDATE ON public.videollamadas_participantes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 11) SISTEMA DE TAREAS PROGRAMADAS (workers/cron)
--     Usado por tasksDAO.js y los scripts de mantenimiento.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.logs_tareas_programadas (
  id SERIAL PRIMARY KEY,
  nombre_tarea VARCHAR(100) NOT NULL,
  estado VARCHAR(20) NOT NULL, -- 'iniciada', 'completada', 'error'
  fecha_inicio TIMESTAMP NOT NULL DEFAULT NOW(),
  fecha_fin TIMESTAMP,
  duracion_ms INTEGER,
  registros_procesados INTEGER DEFAULT 0,
  registros_archivados INTEGER DEFAULT 0,
  registros_eliminados INTEGER DEFAULT 0,
  mensaje TEXT,
  error TEXT,
  detalles JSONB
);

CREATE INDEX IF NOT EXISTS idx_logs_tareas_nombre ON public.logs_tareas_programadas(nombre_tarea);
CREATE INDEX IF NOT EXISTS idx_logs_tareas_fecha ON public.logs_tareas_programadas(fecha_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_logs_tareas_estado ON public.logs_tareas_programadas(estado);

CREATE OR REPLACE VIEW public.ultimas_ejecuciones_tareas AS
SELECT DISTINCT ON (nombre_tarea)
    nombre_tarea,
    estado,
    fecha_inicio,
    fecha_fin,
    duracion_ms,
    registros_procesados,
    registros_archivados,
    mensaje
FROM public.logs_tareas_programadas
ORDER BY nombre_tarea, fecha_inicio DESC;

CREATE TABLE IF NOT EXISTS public.actividad_sistema_archivo (
  id SERIAL PRIMARY KEY,
  usuario_id UUID REFERENCES public."appUsers"(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  archivado_en TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_archivo_usuario_fecha
ON public.actividad_sistema_archivo(usuario_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_archivo_fecha
ON public.actividad_sistema_archivo(created_at DESC);

CREATE OR REPLACE FUNCTION public.archivar_actividades_antiguas(dias_retencion INTEGER DEFAULT 90)
RETURNS JSONB AS $$
DECLARE
    registros_archivados INTEGER;
    fecha_antigua TIMESTAMP;
    fecha_reciente TIMESTAMP;
BEGIN
    SELECT MIN(created_at), MAX(created_at)
    INTO fecha_antigua, fecha_reciente
    FROM public.actividad_sistema
    WHERE created_at < NOW() - INTERVAL '1 day' * dias_retencion;

    INSERT INTO public.actividad_sistema_archivo (usuario_id, tipo, titulo, descripcion, created_at)
    SELECT usuario_id, tipo, titulo, descripcion, created_at
    FROM public.actividad_sistema
    WHERE created_at < NOW() - INTERVAL '1 day' * dias_retencion;

    GET DIAGNOSTICS registros_archivados = ROW_COUNT;

    DELETE FROM public.actividad_sistema
    WHERE created_at < NOW() - INTERVAL '1 day' * dias_retencion;

    RETURN jsonb_build_object(
        'archivados', registros_archivados,
        'fecha_mas_antigua', fecha_antigua,
        'fecha_mas_reciente', fecha_reciente
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.limpiar_archivo_antiguo(dias_total INTEGER DEFAULT 365)
RETURNS JSONB AS $$
DECLARE
    registros_eliminados INTEGER;
BEGIN
    DELETE FROM public.actividad_sistema_archivo
    WHERE created_at < NOW() - INTERVAL '1 day' * dias_total;

    GET DIAGNOSTICS registros_eliminados = ROW_COUNT;

    RETURN jsonb_build_object('eliminados', registros_eliminados);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.obtener_estadisticas_tareas()
RETURNS JSONB AS $$
DECLARE
    resultado JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_ejecuciones', COUNT(*),
        'exitosas', COUNT(*) FILTER (WHERE estado = 'completada'),
        'con_errores', COUNT(*) FILTER (WHERE estado = 'error'),
        'duracion_promedio_ms', COALESCE(AVG(duracion_ms), 0)
    )
    INTO resultado
    FROM public.logs_tareas_programadas
    WHERE fecha_inicio > NOW() - INTERVAL '30 days';

    RETURN resultado;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ============================================================
-- 12) REFRESCAR CACHÉ DE ESQUEMA DE POSTGREST
--     Necesario tras cambios DDL (nuevas columnas/tablas) para que
--     PostgREST (usado por Supabase) las reconozca sin esperar al
--     refresco automático. Si tras esto la API sigue sin ver una
--     columna nueva, entra en Supabase > Settings > API > "Reload schema".
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- FIN DEL BOOTSTRAP
--
-- Siguientes pasos recomendados:
-- 1) Crear los buckets 'avatars' y 'taller-docs' en Supabase Storage.
-- 2) Ajustar políticas y permisos exactos por entorno real.
-- 3) Crear un usuario administrador real y comprobar login.
-- 4) Ejecutar también migrations/setup_query_logs.sql (sistema de
--    logs de queries lentas, separado de este bootstrap).
-- ============================================================
