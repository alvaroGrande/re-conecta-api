-- Script para añadir columna telefono a la tabla appUsers
-- Ejecutar este script en el editor SQL de Supabase

-- Añadir columna telefono
ALTER TABLE "appUsers" 
ADD COLUMN IF NOT EXISTS telefono VARCHAR(20);

-- Opcional: Añadir comentario a la columna
COMMENT ON COLUMN "appUsers".telefono IS 'Número de teléfono del usuario';

-- Verificar que la columna se añadió correctamente
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'appUsers' AND column_name = 'telefono';
