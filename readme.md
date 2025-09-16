# re-ConectaAPI

API REST para la gestión de talleres de la plataforma re-Conecta.

## Características

- Gestión de talleres (crear, listar, activar/desactivar, inscripción)
- Conexión con Supabase como base de datos
- Middleware de manejo de errores
- Compresión y CORS habilitados

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

3. Crea un archivo `.env` con tu clave de Supabase:
   ```
   SUPABASE_KEY=tu_clave_supabase
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

- `GET /api/talleres` — Lista todos los talleres
- `GET /api/talleres/:id` — Obtiene un taller por ID
- `POST /api/talleres` — Crea un nuevo taller
- `PATCH /api/talleres/:id/activar` — Activa un taller
- `PATCH /api/talleres/:id/desactivar` — Desactiva un taller
- `POST /api/talleres/inscribir/:id` — Inscribe a un usuario en un taller

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