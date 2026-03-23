# Sistema de Videollamadas con Trazabilidad

## Descripción

Sistema completo de gestión de videollamadas Zoom con registro de eventos, notificaciones automáticas y panel de administración.

## Características Implementadas

### 1. Creación de Reuniones sin Contraseña
- Las reuniones se crean automáticamente sin contraseña requerida
- Configuración `meeting_authentication: false` para facilitar el acceso
- Acceso directo mediante ID de reunión

### 2. Registro de Videollamadas
Cada videollamada creada queda registrada en la base de datos con:
- ID de reunión de Zoom
- Creador de la reunión
- Tema/título
- Duración estimada
- Número de participantes
- URLs de acceso
- Estado (programada, en curso, finalizada, cancelada)
- Timestamps de creación y actualización

### 3. Sistema de Participantes
- Registro de todos los participantes invitados
- Soporte para usuarios internos y externos
- Tracking de notificaciones enviadas
- Seguimiento de asistencia

### 4. Notificaciones Automáticas
- Notificación automática a todos los participantes al crear una reunión
- Mensaje personalizado con enlace directo a la videollamada
- Registro de cuándo se envió cada notificación

### 5. Trazabilidad para Administradores
Los administradores pueden ver:
- Todas las videollamadas creadas en el sistema
- Quién creó cada reunión
- Características de cada reunión (duración, participantes, tema)
- Estado actual de cada reunión
- Historial completo con timestamps

## Base de Datos

### Tabla: `videollamadas`
```sql
- id: Identificador único
- meeting_id: ID de Zoom
- meeting_number: Número de reunión
- topic: Título/tema
- creator_id: Usuario que creó la reunión
- password: Contraseña (vacía por defecto)
- join_url: URL para unirse
- start_url: URL para iniciar (host)
- duration: Duración en minutos
- num_participants: Número de participantes
- status: Estado actual
- meeting_type: Tipo (instant/scheduled)
- start_time: Hora de inicio real
- end_time: Hora de fin real
- created_at: Fecha de creación
```

### Tabla: `videollamadas_participantes`
```sql
- id: Identificador único
- videollamada_id: Referencia a la videollamada
- usuario_id: Usuario interno (puede ser NULL)
- nombre: Nombre del participante
- email: Email del participante
- rol: host/participant
- notificado: Si recibió notificación
- fecha_notificacion: Cuándo se notificó
- unido: Si se unió a la reunión
- fecha_union: Cuándo se unió
```

## API Endpoints

### POST `/api/video-calls/create-room`
Crea una nueva videollamada con participantes y notificaciones.

**Requiere autenticación:** Sí

**Body:**
```json
{
  "topic": "Reunión de Equipo",
  "duration": 40,
  "participantes": [
    {
      "usuario_id": "uuid-del-usuario",
      "nombre": "Juan Pérez",
      "email": "juan@example.com",
      "rol": "participant"
    }
  ]
}
```

**Respuesta:**
```json
{
  "message": "Reunión creada exitosamente",
  "meetingId": "12345678",
  "meetingNumber": "12345678",
  "joinUrl": "https://zoom.us/j/12345678",
  "password": "",
  "videollamadaId": 123,
  "participantesNotificados": 5
}
```

### GET `/api/video-calls/my-videocalls`
Obtiene el historial de videollamadas creadas por el usuario autenticado.

**Requiere autenticación:** Sí

**Query params:**
- `limit`: Número de resultados (default: 50)
- `offset`: Offset para paginación (default: 0)

### GET `/api/video-calls/all-videocalls`
Obtiene todas las videollamadas del sistema (solo administradores).

**Requiere autenticación:** Sí (rol admin)

**Query params:**
- `limit`: Número de resultados (default: 100)
- `offset`: Offset para paginación (default: 0)

## Instalación

### 1. Ejecutar la migración de base de datos:
```sql
psql -U tu_usuario -d tu_database -f migrations/videocalls_schema.sql
```

### 2. Reiniciar el servidor:
```bash
cd re-ConectaAPI
npm start
```

## Uso desde el Frontend

### Crear una reunión con participantes:
```javascript
import { createMeeting } from '@services/videoCall';

const response = await createMeeting({
  topic: 'Reunión de Proyecto',
  duration: 60,
  participantes: [
    { usuario_id: 'uuid-1', nombre: 'Ana García', email: 'ana@example.com' },
    { usuario_id: 'uuid-2', nombre: 'Carlos López', email: 'carlos@example.com' }
  ]
});
```

### Obtener historial de videollamadas:
```javascript
import api from '@services/api';

const { data } = await api.get('/video-calls/my-videocalls?limit=20');
```

## Panel de Administración

Los administradores pueden acceder a un panel especial para ver:
- Estadísticas de uso de videollamadas
- Reuniones más recientes
- Usuarios más activos
- Historial completo con filtros

## Logs

Todos los eventos importantes quedan registrados:
- Creación de reuniones
- Envío de notificaciones
- Errores de Zoom API
- Acciones de usuarios

Los logs incluyen:
- Timestamp
- Usuario que realizó la acción
- Detalles de la operación
- Resultado (éxito/error)

## Seguridad

- Las contraseñas no son requeridas para simplificar el acceso
- Solo usuarios autenticados pueden crear reuniones
- Solo administradores pueden ver todas las reuniones
- Los participantes reciben notificaciones solo si están registrados
