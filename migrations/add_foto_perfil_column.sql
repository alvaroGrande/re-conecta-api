-- Script para añadir la columna foto_perfil a la tabla appUsers
-- Esta columna almacenará la URL de la foto de perfil desde Supabase Storage

-- Añadir columna foto_perfil (URL de la imagen)
ALTER TABLE "appUsers" 
ADD COLUMN IF NOT EXISTS foto_perfil TEXT DEFAULT NULL;

-- Añadir comentario descriptivo a la columna
COMMENT ON COLUMN "appUsers".foto_perfil IS 'URL pública de la foto de perfil almacenada en Supabase Storage (bucket: avatars)';

-- Opcional: Crear índice si se va a filtrar/buscar por fotos existentes
-- CREATE INDEX IF NOT EXISTS idx_appusers_foto_perfil ON "appUsers"(foto_perfil) WHERE foto_perfil IS NOT NULL;
