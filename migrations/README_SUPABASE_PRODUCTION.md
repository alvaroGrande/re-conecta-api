# Recreating Supabase production safely

Este documento te sirve para recrear la base de datos de forma ordenada, profesional y con permisos coherentes con la app.

## 1) Qué incluye el bootstrap

La base de datos se crea con:

- `appUsers` como perfil principal
- permisos por rol (`1`, `2`, `3`)
- `roles_permisos` y `permisos_catalogo`
- tablas clave de negocio: talleres, inscripciones, contactos, encuestas, chat, videollamadas, notificaciones, recordatorios
- políticas RLS básicas
- triggers de `updated_at`
- preparación de storage buckets `avatars` y `taller-docs`

## 2) Cómo ejecutarlo

1. Abre Supabase > SQL Editor.
2. Pega el contenido de `recreate_supabase_production.sql`.
3. Ejecuta el script.
4. Luego entra en Storage y crea los buckets manualmente si el script no lo hace automáticamente.
5. Verifica que hay un usuario admin de prueba.

## 3) Permisos recomendados

- `appUsers`: admin ve todo, usuario ve su propio perfil
- `talleres`: lectura pública para activos; escritura solo admin/coordinador
- `notificaciones`: usuarios leen/suscriben solo propias
- `encuestas`: lectura pública para activas; respuestas por usuario autenticado
- `chat`: cada usuario solo ve sus chats y mensajes

## 4) Recomendación de seguridad

- No uses `public` para escritura crítica.
- Mantén `RLS` activo siempre.
- Usa `auth.uid()` como base para autorización.
- No compartas `SUPABASE_KEY` del rol `service_role` en frontend.
- Guarda secretos de entorno solo en backend.

## 5) Siguiente paso real

Tras el bootstrap, dejamos una segunda fase para:

- crear users reales de prueba,
- comprobar login,
- migrar datos y verificar permisos,
- preparar entorno de producción real.

En el repo ya tienes los scripts de migración parciales en `migrations/`; puedes ejecutarlos luego al lado del bootstrap principal.
