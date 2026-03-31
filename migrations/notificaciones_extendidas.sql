-- ============================================================
-- EXTENSIÓN DEL SISTEMA DE NOTIFICACIONES
-- Soporte para email, WhatsApp, push y plantillas corporativas
-- ============================================================

-- Extender tabla notificaciones existente
ALTER TABLE notificaciones
  ADD COLUMN IF NOT EXISTS canal VARCHAR(20) DEFAULT 'push', -- 'push', 'email', 'whatsapp'
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'pendiente', -- 'pendiente', 'enviada', 'fallida'
  ADD COLUMN IF NOT EXISTS intentos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS datos_adicionales JSONB, -- Para metadatos específicos del canal
  ADD COLUMN IF NOT EXISTS plantilla_id UUID, -- FK a plantillas
  ADD COLUMN IF NOT EXISTS enviada_en TIMESTAMP WITH TIME ZONE;

-- Crear tabla de plantillas de notificación
CREATE TABLE IF NOT EXISTS notificaciones_plantillas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(100) UNIQUE NOT NULL, -- 'nuevo_taller', 'nueva_encuesta', etc.
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  canal VARCHAR(20) NOT NULL, -- 'email', 'whatsapp'
  asunto VARCHAR(255), -- Solo para email
  contenido TEXT NOT NULL, -- Plantilla con placeholders {{variable}}
  variables JSONB, -- Lista de variables disponibles
  activo BOOLEAN DEFAULT true,
  creado_por UUID REFERENCES "appUsers"(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de configuraciones de notificación por usuario
CREATE TABLE IF NOT EXISTS notificaciones_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES "appUsers"(id) ON DELETE CASCADE,
  tipo_evento VARCHAR(100) NOT NULL, -- 'nuevo_taller', 'nueva_encuesta', etc.
  canal VARCHAR(20) NOT NULL, -- 'push', 'email', 'whatsapp'
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(usuario_id, tipo_evento, canal)
);

-- Crear tabla de cola de notificaciones para procesamiento en background
CREATE TABLE IF NOT EXISTS notificaciones_cola (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notificacion_id BIGINT REFERENCES notificaciones(id) ON DELETE CASCADE,
  prioridad INTEGER DEFAULT 1, -- 1=baja, 2=normal, 3=alta, 4=urgente
  programado_para TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  procesado_en TIMESTAMP WITH TIME ZONE,
  estado VARCHAR(20) DEFAULT 'pendiente', -- 'pendiente', 'procesando', 'completada', 'fallida'
  error_mensaje TEXT,
  intentos INTEGER DEFAULT 0,
  max_intentos INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_notificaciones_canal ON notificaciones(canal);
CREATE INDEX IF NOT EXISTS idx_notificaciones_estado ON notificaciones(estado);
CREATE INDEX IF NOT EXISTS idx_notificaciones_plantilla ON notificaciones(plantilla_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_plantillas_codigo ON notificaciones_plantillas(codigo);
CREATE INDEX IF NOT EXISTS idx_notificaciones_config_usuario ON notificaciones_config(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_cola_estado ON notificaciones_cola(estado);
CREATE INDEX IF NOT EXISTS idx_notificaciones_cola_programado ON notificaciones_cola(programado_para);

-- Deshabilitar RLS para estas tablas (manejo por middleware)
ALTER TABLE notificaciones_plantillas DISABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones_cola DISABLE ROW LEVEL SECURITY;

-- Plantillas corporativas iniciales
INSERT INTO notificaciones_plantillas (codigo, nombre, descripcion, canal, asunto, contenido, variables) VALUES
('nuevo_taller', 'Nuevo taller disponible', 'Notificación cuando se crea un nuevo taller', 'email',
 'Nuevo taller disponible: {{titulo}}',
 '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Nuevo taller disponible</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; }
    .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>¡Nuevo taller disponible!</h1>
    </div>
    <div class="content">
      <h2>{{titulo}}</h2>
      <p><strong>Descripción:</strong> {{descripcion}}</p>
      <p><strong>Fecha:</strong> {{fecha}}</p>
      <p><strong>Duración:</strong> {{duracion}} horas</p>
      <p><strong>Aforo:</strong> {{aforo}} personas</p>
      <p><strong>Modalidad:</strong> {{modalidad}}</p>
      <p><strong>Tipo de pago:</strong> {{tipo_pago}}</p>
      <a href="{{url}}" class="button">Ver detalles e inscribirme</a>
    </div>
    <div class="footer">
      <p>Este es un mensaje automático de reConecta. No respondas a este email.</p>
      <p>© 2024 reConecta - Todos los derechos reservados</p>
    </div>
  </div>
</body>
</html>',
'["titulo", "descripcion", "fecha", "duracion", "aforo", "modalidad", "tipo_pago", "url"]'::jsonb),

('nueva_encuesta', 'Nueva encuesta disponible', 'Notificación cuando se crea una nueva encuesta', 'email',
 'Nueva encuesta disponible: {{titulo}}',
 '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Nueva encuesta disponible</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; }
    .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>¡Nueva encuesta disponible!</h1>
    </div>
    <div class="content">
      <h2>{{titulo}}</h2>
      <p><strong>Descripción:</strong> {{descripcion}}</p>
      <p><strong>Creada por:</strong> {{creador}}</p>
      <a href="{{url}}" class="button">Responder encuesta</a>
    </div>
    <div class="footer">
      <p>Este es un mensaje automático de reConecta. No respondas a este email.</p>
      <p>© 2024 reConecta - Todos los derechos reservados</p>
    </div>
  </div>
</body>
</html>',
'["titulo", "descripcion", "creador", "url"]'::jsonb),

('nuevo_taller_whatsapp', 'Nuevo taller disponible (WhatsApp)', 'Notificación WhatsApp cuando se crea un nuevo taller', 'whatsapp',
 NULL,
 '¡Hola {{nombre}}! 🎉

Se ha publicado un nuevo taller en reConecta:

📌 *{{titulo}}*
📝 {{descripcion}}
📅 Fecha: {{fecha}}
⏱️ Duración: {{duracion}} horas
👥 Aforo: {{aforo}} personas
🏢 Modalidad: {{modalidad}}
💰 Tipo: {{tipo_pago}}

¿Te interesa? Inscríbete aquí: {{url}}

¡No te lo pierdas!',
'["nombre", "titulo", "descripcion", "fecha", "duracion", "aforo", "modalidad", "tipo_pago", "url"]'::jsonb),

('nueva_encuesta_whatsapp', 'Nueva encuesta disponible (WhatsApp)', 'Notificación WhatsApp cuando se crea una nueva encuesta', 'whatsapp',
 NULL,
 '¡Hola {{nombre}}! 📊

Hay una nueva encuesta disponible en reConecta:

📋 *{{titulo}}*
📝 {{descripcion}}
👤 Creada por: {{creador}}

Responde aquí: {{url}}

¡Tu opinión cuenta!',
'["nombre", "titulo", "descripcion", "creador", "url"]'::jsonb)
ON CONFLICT (codigo) DO NOTHING;

-- Configuraciones por defecto para todos los usuarios (solo push inicialmente)
-- Esto se puede expandir con un script de inicialización
-- INSERT INTO notificaciones_config (usuario_id, tipo_evento, canal, activo)
-- SELECT id, 'nuevo_taller', 'push', true FROM "appUsers"
-- UNION ALL
-- SELECT id, 'nueva_encuesta', 'push', true FROM "appUsers"
-- ON CONFLICT DO NOTHING;
