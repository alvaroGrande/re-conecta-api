# Análisis de Mensajes API para Internacionalización

## Resumen

La API devuelve **múltiples mensajes en español** que actualmente están hardcodeados en los controladores. Estos mensajes se pueden internacionalizar para proporcionar una mejor experiencia a usuarios que prefieran otros idiomas.

## Tipos de Mensajes Encontrados

### 1. **Mensajes de Error de Validación** (400)
Campos requeridos faltantes, formatos inválidos, validaciones de negocio

**Ejemplos:**
- `"Email y contraseña son requeridos"`
- `"Nombre y email son requeridos"`
- `"Faltan campos requeridos: titulo, descripcion, fecha_fin"`
- `"La encuesta debe tener al menos una pregunta"`
- `"Formato de imagen inválido"`
- `"No se proporcionó ninguna foto"`

### 2. **Mensajes de Error de Autorización** (403)
Permisos insuficientes, restricciones de rol

**Ejemplos:**
- `"No tienes permisos para ver estadísticas"`
- `"No tienes permisos"`
- `"Solo administradores pueden ejecutar tareas manualmente"`
- `"Solo instructores y administradores pueden enviar notificaciones masivas"`
- `"No tienes permisos para crear encuestas. Solo administradores."`

### 3. **Mensajes de Error de Autenticación** (401)
Credenciales inválidas, tokens expirados

**Ejemplos:**
- `"Credenciales inválidas"`
- `"Refresh token no encontrado"`
- `"Refresh token inválido"`
- `"No autenticado"`

### 4. **Mensajes de Recurso No Encontrado** (404)
Entidades no encontradas en base de datos

**Ejemplos:**
- `"Usuario no encontrado"`
- `"Taller no encontrado"`
- `"Encuesta no encontrada"`
- `"Notificación no encontrada o no tienes permiso"`

### 5. **Mensajes de Conflicto** (409)
Violaciones de unicidad, duplicados

**Ejemplos:**
- `"El email ya está registrado"`

### 6. **Mensajes de Éxito** (200/201)
Operaciones completadas exitosamente

**Ejemplos:**
- `"Autenticación exitosa"`
- `"Sesión cerrada correctamente"`
- `"Foto de perfil actualizada correctamente"`
- `"Sala creada exitosamente"`
- `"Se enviaron X notificaciones"`
- `"Se marcaron X notificaciones como leídas"`
- `"Notificación eliminada"`

### 7. **Mensajes de Advertencia** (200 con warning)
Situaciones no ideales pero no errores

**Ejemplos:**
- `"No tienes un instructor principal asignado"`

### 8. **Mensajes de Error del Servidor** (500)
Errores internos genéricos

**Ejemplos:**
- `"Error del servidor"`
- `"Error interno del servidor"`
- `"Error al crear la sala"`

## Ubicación de Mensajes por Controlador

### authController.js
- ✅ Validación de credenciales
- ✅ Errores de autenticación
- ✅ Mensajes de éxito en login/logout
- ✅ Errores de refresh token

### usersController.js
- ✅ Permisos insuficientes
- ✅ Usuario no encontrado
- ✅ Validación de campos requeridos
- ✅ Email duplicado
- ✅ Validación de foto de perfil

### notificacionesController.js
- ✅ Campos requeridos
- ✅ Permisos de envío
- ✅ Validación de receptores
- ✅ Mensajes de éxito (X notificaciones enviadas)

### encuestasController.js
- ✅ Permisos de creación (solo admins)
- ✅ Validación de campos (titulo, descripcion, fecha_fin)
- ✅ Validación de preguntas (tipo, opciones)
- ✅ Validación de fechas
- ✅ Encuesta no encontrada

### contactosController.js
- ✅ Permisos de asignación (solo admins)
- ✅ Campos requeridos
- ✅ Warning de instructor no asignado

### talleresController.js
- ✅ Taller no encontrado
- ✅ Errores genéricos

### dashboardController.js
- ✅ Permisos insuficientes (múltiples endpoints)

### videoCallsController.js
- ✅ Sala creada exitosamente
- ✅ Error al crear sala

### tasksController.js
- ✅ Permisos de ejecución manual
- ✅ Confirmación de tarea iniciada

### errorHandler.js (middleware)
- ✅ Mensaje genérico: "Error interno del servidor"

## Recomendaciones de Implementación

### Opción 1: Códigos de Error (Recomendado)
En lugar de enviar mensajes traducidos desde la API, enviar **códigos de error** que el frontend traduzca.

**Ventajas:**
- ✅ API sin lógica de idioma
- ✅ Frontend controla completamente la traducción
- ✅ Más fácil de mantener
- ✅ Consistente con i18n actual del frontend

**Ejemplo:**
```javascript
// Backend
return res.status(400).json({ 
  errorCode: 'AUTH.CREDENTIALS_REQUIRED',
  message: 'Email y contraseña son requeridos.' // fallback para debugging
});

// Frontend en.json
{
  "errors": {
    "AUTH": {
      "CREDENTIALS_REQUIRED": "Email and password are required",
      "INVALID_CREDENTIALS": "Invalid credentials"
    }
  }
}
```

### Opción 2: i18n en Backend
Implementar i18next en Node.js y usar header `Accept-Language`.

**Ventajas:**
- ✅ Mensajes traducidos directamente desde API
- ✅ Útil si hay múltiples frontends

**Desventajas:**
- ❌ Más complejidad en backend
- ❌ Duplicación de traducciones (backend + frontend)
- ❌ Necesita header Accept-Language en cada petición

### Opción 3: Híbrido
Códigos de error para validaciones + mensajes traducidos en backend para logs.

## Implementación Recomendada: Códigos de Error

### 1. Crear archivo de códigos de error
```javascript
// re-ConectaAPI/src/utils/errorCodes.js
export const ERROR_CODES = {
  // Authentication
  AUTH_CREDENTIALS_REQUIRED: 'AUTH.CREDENTIALS_REQUIRED',
  AUTH_INVALID_CREDENTIALS: 'AUTH.INVALID_CREDENTIALS',
  AUTH_TOKEN_INVALID: 'AUTH.TOKEN_INVALID',
  AUTH_TOKEN_MISSING: 'AUTH.TOKEN_MISSING',
  AUTH_NOT_AUTHENTICATED: 'AUTH.NOT_AUTHENTICATED',
  
  // Authorization
  AUTHZ_INSUFFICIENT_PERMISSIONS: 'AUTHZ.INSUFFICIENT_PERMISSIONS',
  AUTHZ_ADMIN_ONLY: 'AUTHZ.ADMIN_ONLY',
  AUTHZ_INSTRUCTOR_ONLY: 'AUTHZ.INSTRUCTOR_ONLY',
  
  // Validation
  VALIDATION_REQUIRED_FIELDS: 'VALIDATION.REQUIRED_FIELDS',
  VALIDATION_INVALID_FORMAT: 'VALIDATION.INVALID_FORMAT',
  VALIDATION_INVALID_DATE: 'VALIDATION.INVALID_DATE',
  
  // Not Found
  NOT_FOUND_USER: 'NOT_FOUND.USER',
  NOT_FOUND_SURVEY: 'NOT_FOUND.SURVEY',
  NOT_FOUND_WORKSHOP: 'NOT_FOUND.WORKSHOP',
  NOT_FOUND_NOTIFICATION: 'NOT_FOUND.NOTIFICATION',
  
  // Conflict
  CONFLICT_EMAIL_EXISTS: 'CONFLICT.EMAIL_EXISTS',
  
  // Server
  SERVER_ERROR: 'SERVER.ERROR',
};
```

### 2. Actualizar controladores
```javascript
// Antes
return res.status(400).json({ 
  message: "Email y contraseña son requeridos" 
});

// Después
return res.status(400).json({ 
  errorCode: ERROR_CODES.AUTH_CREDENTIALS_REQUIRED,
  message: "Email y contraseña son requeridos", // fallback
  details: { required: ['email', 'password'] }
});
```

### 3. Añadir traducciones al frontend
```json
// reConecta/src/i18n/locales/es.json
{
  "errors": {
    "AUTH": {
      "CREDENTIALS_REQUIRED": "Email y contraseña son requeridos",
      "INVALID_CREDENTIALS": "Credenciales inválidas",
      "TOKEN_INVALID": "Token inválido o expirado",
      "NOT_AUTHENTICATED": "No autenticado"
    },
    "AUTHZ": {
      "INSUFFICIENT_PERMISSIONS": "No tienes permisos suficientes",
      "ADMIN_ONLY": "Solo administradores",
      "INSTRUCTOR_ONLY": "Solo instructores y administradores"
    },
    "VALIDATION": {
      "REQUIRED_FIELDS": "Faltan campos requeridos",
      "INVALID_FORMAT": "Formato inválido",
      "INVALID_DATE": "Fecha inválida"
    },
    "NOT_FOUND": {
      "USER": "Usuario no encontrado",
      "SURVEY": "Encuesta no encontrada",
      "WORKSHOP": "Taller no encontrado",
      "NOTIFICATION": "Notificación no encontrada"
    },
    "CONFLICT": {
      "EMAIL_EXISTS": "El email ya está registrado"
    },
    "SERVER": {
      "ERROR": "Error interno del servidor"
    }
  },
  "success": {
    "AUTH": {
      "LOGIN_SUCCESS": "Autenticación exitosa",
      "LOGOUT_SUCCESS": "Sesión cerrada correctamente"
    },
    "PROFILE": {
      "PHOTO_UPDATED": "Foto de perfil actualizada correctamente"
    },
    "NOTIFICATIONS": {
      "SENT": "Se enviaron {count} notificaciones",
      "MARKED_READ": "Se marcaron {count} notificaciones como leídas",
      "DELETED": "Notificación eliminada"
    },
    "VIDEOCALL": {
      "ROOM_CREATED": "Sala creada exitosamente"
    }
  }
}
```

### 4. Actualizar servicio de manejo de errores en frontend
```javascript
// reConecta/src/services/api.js
import { useI18n } from 'vue-i18n';

api.interceptors.response.use(
  response => response,
  error => {
    const { t } = useI18n();
    
    if (error.response?.data?.errorCode) {
      const translatedMessage = t(`errors.${error.response.data.errorCode.replace('.', '.')}`);
      error.translatedMessage = translatedMessage;
    }
    
    return Promise.reject(error);
  }
);
```

## Impacto Estimado

### Controladores a Modificar
- ✅ authController.js (~10 mensajes)
- ✅ usersController.js (~8 mensajes)
- ✅ notificacionesController.js (~12 mensajes)
- ✅ encuestasController.js (~15 mensajes)
- ✅ contactosController.js (~6 mensajes)
- ✅ talleresController.js (~4 mensajes)
- ✅ dashboardController.js (~8 mensajes)
- ✅ videoCallsController.js (~2 mensajes)
- ✅ tasksController.js (~2 mensajes)
- ✅ errorHandler.js (~1 mensaje)

**Total estimado: ~70 mensajes únicos**

### Archivos de Traducción a Actualizar
- ✅ es.json (ya creado, añadir sección `errors` y `success`)
- ✅ ca.json (traducir a catalán)
- ✅ gl.json (traducir a gallego)
- ✅ en.json (traducir a inglés)

## Próximos Pasos

1. **Decidir enfoque**: ¿Códigos de error o i18n en backend?
2. **Crear archivo errorCodes.js** con todos los códigos
3. **Actualizar controladores** uno por uno
4. **Ampliar traducciones del frontend** con todos los errores
5. **Actualizar interceptor de API** para traducir automáticamente
6. **Probar exhaustivamente** cada tipo de error
7. **Documentar** para futuros desarrolladores

## Conclusión

**Sí, la API devuelve muchos mensajes traducibles.** La mejor solución es usar **códigos de error** que el frontend traduzca usando el sistema i18n ya implementado. Esto mantiene la separación de responsabilidades y evita duplicar lógica de traducción en backend y frontend.
