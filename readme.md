# re-ConectaAPI

API REST para la gestión de talleres de la plataforma re-Conecta.

## Características

- Gestión de talleres (crear, listar, activar/desactivar, inscripción)
- Gestión de usuarios y autenticación JWT
- Sistema de encuestas y notificaciones en tiempo real (Socket.IO)
- Dashboard de administración con estadísticas
- **Tareas programadas automáticas** para mantenimiento del sistema
- Conexión con Supabase como base de datos PostgreSQL
- Middleware de manejo de errores
- Compresión y CORS habilitados
- Rate limiting para protección

## Instalación

1. Clona el repositorio:
   ```sh
   git clone <URL-del-repo>
   cd re-ConectaAPI
   ```

2. Instala las dependencias:
   ```sh
   npm install
   ```

3. Crea un archivo `.env` basado en `.env.example`:
   ```sh
   cp .env.example .env
   ```
   
   Configura las variables necesarias:
   ```env
   SUPABASE_URL=tu_url_supabase
   SUPABASE_KEY=tu_clave_supabase
   JWT_SECRET=tu_secret_jwt
   ZOOM_SDK_KEY=tu_zoom_sdk_key
   ZOOM_SDK_SECRET=tu_zoom_sdk_secret
   ZOOM_ACCOUNT_ID=tu_zoom_account_id
   ZOOM_CLIENT_ID=tu_zoom_client_id
   ZOOM_CLIENT_SECRET=tu_zoom_client_secret
   
   # Tareas Programadas
   TASKS_TESTING_MODE=true  # false en producción
   DIAS_RETENCION_ACTIVIDADES=90
   DIAS_ARCHIVO_TOTAL=365
   ```

4. Ejecuta el script SQL para crear las tablas de tareas programadas:
   ```sh
   psql -h <host> -U <user> -d <database> -f src/scripts/setup_tareas_programadas.sql
   ```

## Uso

- Inicia el servidor en modo desarrollo:
  ```sh
  npm run dev
  ```

- Inicia el servidor en modo producción:
  ```sh
  npm start
  ```

El servidor estará disponible en `http://localhost:3000`.

## Endpoints principales

### Talleres
- `GET /api/talleres` — Lista todos los talleres
- `GET /api/talleres/:id` — Obtiene un taller por ID
- `POST /api/talleres` — Crea un nuevo taller
- `PATCH /api/talleres/:id/activar` — Activa un taller
- `PATCH /api/talleres/:id/desactivar` — Desactiva un taller
- `POST /api/talleres/inscribir/:id` — Inscribe a un usuario en un taller

### Autenticación
- `POST /api/auth/login` — Inicio de sesión
- `POST /api/auth/logout` — Cierre de sesión

### Dashboard
- `GET /api/dashboard/estadisticas` — Estadísticas generales
- `GET /api/dashboard/actividad-reciente` — Actividad reciente del sistema
- `GET /api/dashboard/usuarios-conectados` — Usuarios activos

### Tareas Programadas
- `GET /api/tasks/ejecuciones` — Últimas ejecuciones de tareas
- `GET /api/tasks/resumen` — Resumen de tareas programadas
- `GET /api/tasks/estadisticas` — Estadísticas de ejecución
- `POST /api/tasks/ejecutar/:nombreTarea` — Ejecutar tarea manualmente (admin)

## Tareas Programadas

El sistema incluye tareas automáticas para mantenimiento:

### Archivado de Actividades

**Objetivo:** Mantener la tabla `actividad_sistema` optimizada archivando registros antiguos.

**Configuración:**
- **Testing:** Cada 3 minutos (`TASKS_TESTING_MODE=true`)
- **Producción:** Diariamente a la 1:00 AM (`TASKS_TESTING_MODE=false`)

**Qué hace:**
1. Archiva actividades anteriores a `DIAS_RETENCION_ACTIVIDADES` días (default: 90)
2. Elimina del archivo registros anteriores a `DIAS_ARCHIVO_TOTAL` días (default: 365)
3. Registra logs detallados en `logs_tareas_programadas`
4. Muestra resumen en el dashboard de administración

**Ver logs:**
```sql
-- Últimas ejecuciones
SELECT * FROM logs_tareas_programadas 
ORDER BY fecha_inicio DESC LIMIT 10;

-- Resumen por tarea
SELECT * FROM ultimas_ejecuciones_tareas;

-- Estadísticas
SELECT * FROM obtener_estadisticas_tareas();
```

**Ejecutar manualmente:**
```sh
# Desde la API (requiere token de admin)
POST /api/tasks/ejecutar/archivado_actividades
```

### Agregar Nuevas Tareas

1. Añade la función en `src/services/tasksScheduler.js`:
```javascript
async function miNuevaTarea() {
  const nombreTarea = 'mi_nueva_tarea';
  let logId;
  
  try {
    logId = await tasksDAO.registrarInicioTarea(nombreTarea);
    
    // Tu lógica aquí
    const resultado = await ejecutarMiTarea();
    
    await tasksDAO.registrarFinTarea(logId, {
      registrosProcesados: resultado.total,
      mensaje: `Procesados ${resultado.total} registros`,
      detalles: resultado
    });
  } catch (error) {
    if (logId) {
      await tasksDAO.registrarErrorTarea(logId, error);
    }
  }
}
```

2. Programa la tarea en `inicializarTareasProgramadas()`:
```javascript
cron.schedule('0 */6 * * *', async () => {
  await miNuevaTarea();
}, { timezone: 'Europe/Madrid' });
```

## Estructura del proyecto

```
.env
.gitignore
package.json
src/
  app.js
  server.js
  config/
    constants.js
  Controllers/
    talleresController.js
  DAO/
    connection.js
    talleresDAO.js
  middlewares/
    errorHandler.js
  routes/
    talleres.js
  utils/
    apiErrors.js
```

## Licencia

ISC