# API de Encuestas - reConecta

API REST completa para gestión de encuestas con soporte para preguntas de opción múltiple y respuesta abierta.

## 📋 Características

- ✅ CRUD completo de encuestas
- ✅ Preguntas de tipo múltiple y abierta
- ✅ Control de permisos (solo administradores pueden crear)
- ✅ Prevención de respuestas duplicadas
- ✅ Resultados agregados en tiempo real
- ✅ Filtrado por estado (activas/cerradas)
- ✅ Validación completa de datos

## 🗄️ Estructura de Base de Datos

### Tablas

1. **encuestas** - Información principal de cada encuesta
2. **encuestas_preguntas** - Preguntas asociadas a cada encuesta
3. **encuestas_opciones** - Opciones para preguntas de tipo múltiple
4. **encuestas_respuestas** - Registro de respuestas por usuario
5. **encuestas_respuestas_detalle** - Detalles de cada respuesta

### Instalación del Schema

Ejecuta el script SQL en tu panel de Supabase:

```bash
src/scripts/encuestas_schema.sql
```

## 🚀 Endpoints

### Autenticación

Todos los endpoints requieren autenticación mediante JWT:

```
Authorization: Bearer <token>
```

---

### 1. Listar Encuestas

**GET** `/api/encuestas`

Obtiene todas las encuestas con filtros opcionales.

#### Query Parameters

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `estado` | string | Filtrar por estado: `activa` o `cerrada` |

#### Respuesta Exitosa (200)

```json
[
  {
    "id": 1,
    "titulo": "¿Cómo evalúas la calidad de nuestros talleres?",
    "descripcion": "Queremos conocer tu opinión...",
    "fecha_fin": "2025-12-31",
    "fecha_creacion": "2025-12-19T10:00:00Z",
    "respuestas": 45,
    "estado": "activa",
    "preguntas": [
      {
        "id": 1,
        "texto": "¿Qué calificación le das a los talleres?",
        "tipo": "multiple",
        "orden": 1,
        "opciones": [
          { "id": 1, "texto": "Excelente", "orden": 1 },
          { "id": 2, "texto": "Bueno", "orden": 2 }
        ]
      }
    ]
  }
]
```

---

### 2. Obtener Encuesta por ID

**GET** `/api/encuestas/:id`

Obtiene los detalles completos de una encuesta específica.

#### Respuesta Exitosa (200)

```json
{
  "id": 1,
  "titulo": "¿Cómo evalúas la calidad de nuestros talleres?",
  "descripcion": "Queremos conocer tu opinión...",
  "fecha_fin": "2025-12-31",
  "respuestas": 45,
  "estado": "activa",
  "preguntas": [...]
}
```

#### Errores

- **404** - Encuesta no encontrada

---

### 3. Crear Encuesta (Solo Administradores)

**POST** `/api/encuestas`

Crea una nueva encuesta. Solo usuarios con rol `1` (administrador).

#### Body (JSON)

```json
{
  "titulo": "Título de la encuesta",
  "descripcion": "Descripción detallada",
  "fecha_fin": "2025-12-31",
  "preguntas": [
    {
      "texto": "¿Qué te pareció el taller?",
      "tipo": "multiple",
      "opciones": [
        { "texto": "Excelente" },
        { "texto": "Bueno" },
        { "texto": "Regular" }
      ]
    },
    {
      "texto": "Comentarios adicionales",
      "tipo": "abierta"
    }
  ]
}
```

#### Validaciones

- ✅ `titulo`, `descripcion`, `fecha_fin` son obligatorios
- ✅ Debe tener al menos una pregunta
- ✅ `fecha_fin` debe ser igual o posterior a hoy
- ✅ Preguntas `multiple` deben tener al menos una opción
- ✅ Tipo debe ser `multiple` o `abierta`

#### Respuesta Exitosa (201)

```json
{
  "id": 5,
  "titulo": "Título de la encuesta",
  "descripcion": "Descripción detallada",
  "fecha_fin": "2025-12-31",
  "preguntas": [...],
  "respuestas": 0,
  "estado": "activa"
}
```

#### Errores

- **400** - Datos inválidos o incompletos
- **403** - No tienes permisos (no eres administrador)

---

### 4. Responder Encuesta

**POST** `/api/encuestas/:id/respuestas`

Envía las respuestas de un usuario a una encuesta.

#### Body (JSON)

```json
{
  "respuestas": {
    "1": [1, 2],          // Pregunta múltiple: array de IDs de opciones
    "2": "Mi comentario"  // Pregunta abierta: string
  }
}
```

#### Respuesta Exitosa (201)

```json
{
  "success": true,
  "mensaje": "Respuesta registrada correctamente"
}
```

#### Errores

- **400** - Encuesta cerrada o datos inválidos
- **409** - Ya has respondido esta encuesta

---

### 5. Obtener Resultados

**GET** `/api/encuestas/:id/resultados`

Obtiene los resultados agregados de una encuesta.

#### Respuesta Exitosa (200)

```json
{
  "yaRespondida": true,
  "resultados": {
    "1": {
      "total": 45,
      "opciones": {
        "1": 32,  // 32 personas seleccionaron la opción 1
        "2": 10,
        "3": 2,
        "4": 1
      }
    },
    "2": {
      "respuestas": [
        "Excelente experiencia",
        "Muy bueno",
        "Podría mejorar"
      ]
    }
  }
}
```

---

### 6. Publicar Encuesta (Solo Administradores)

**PATCH** `/api/encuestas/:id/publicar`

Activa/publica una encuesta. Solo administradores.

#### Respuesta Exitosa (200)

```json
{
  "success": true,
  "mensaje": "Encuesta publicada correctamente",
  "encuesta": {...}
}
```

#### Errores

- **400** - La encuesta tiene fecha_fin pasada
- **403** - No tienes permisos
- **404** - Encuesta no encontrada

---

## 📊 Modelos de Datos

### Encuesta

```typescript
{
  id: number
  titulo: string
  descripcion: string
  fecha_fin: string (YYYY-MM-DD)
  fecha_creacion: string (ISO 8601)
  respuestas: number // Contador
  estado: 'activa' | 'cerrada' // Calculado
  preguntas: Pregunta[]
}
```

### Pregunta

```typescript
{
  id: number
  encuesta_id: number
  texto: string
  tipo: 'multiple' | 'abierta'
  orden: number
  opciones?: Opcion[] // Solo si tipo es 'multiple'
}
```

### Opción

```typescript
{
  id: number
  pregunta_id: number
  texto: string
  orden: number
}
```

---

## 🔐 Permisos

| Acción | Rol Requerido |
|--------|---------------|
| Listar encuestas | Usuario autenticado |
| Ver encuesta | Usuario autenticado |
| Responder encuesta | Usuario autenticado |
| Ver resultados | Usuario autenticado |
| Crear encuesta | Administrador (rol = 1) |
| Publicar encuesta | Administrador (rol = 1) |

---

## 🧪 Ejemplos de Uso

### JavaScript/Fetch

```javascript
// Listar encuestas activas
const response = await fetch('http://localhost:3000/api/encuestas?estado=activa', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
const encuestas = await response.json()

// Crear encuesta (admin)
const nuevaEncuesta = await fetch('http://localhost:3000/api/encuestas', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    titulo: "Mi encuesta",
    descripcion: "Descripción",
    fecha_fin: "2025-12-31",
    preguntas: [...]
  })
})

// Responder encuesta
const respuesta = await fetch('http://localhost:3000/api/encuestas/1/respuestas', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    respuestas: {
      "1": [1, 2],
      "2": "Mi comentario"
    }
  })
})
```

---

## ✅ Validaciones Implementadas

### Backend

- ✅ Verificación de rol para crear encuestas
- ✅ Prevención de respuestas duplicadas (constraint único)
- ✅ Validación de fechas (no permitir fechas pasadas)
- ✅ Validación de estructura de preguntas
- ✅ Validación de opciones en preguntas múltiples
- ✅ Verificación de encuesta activa al responder

### Base de Datos

- ✅ Constraints de integridad referencial (FK)
- ✅ Índices para optimizar consultas
- ✅ Cascada en eliminaciones
- ✅ Valores por defecto

---

## 🐛 Manejo de Errores

Todos los endpoints devuelven errores en formato JSON:

```json
{
  "message": "Descripción del error"
}
```

Códigos de estado HTTP:

- `200` - Éxito
- `201` - Recurso creado
- `400` - Petición inválida
- `401` - No autenticado
- `403` - Sin permisos
- `404` - No encontrado
- `409` - Conflicto (ej: respuesta duplicada)
- `500` - Error del servidor

---

## 📝 Notas

1. **Estado de Encuesta**: Se calcula dinámicamente comparando `fecha_fin` con la fecha actual
2. **Respuestas Múltiples**: Una pregunta múltiple puede recibir múltiples opciones seleccionadas
3. **Límite de Opciones**: El frontend limita a 4 opciones, pero el backend no tiene restricción
4. **Seguridad**: Todos los endpoints requieren token JWT válido

---

## 🔄 Integración con Frontend

El servicio del frontend ya está actualizado para usar estos endpoints. Solo necesitas:

1. Ejecutar el script SQL para crear las tablas
2. Reiniciar el servidor backend
3. El frontend se conectará automáticamente

---

## 📞 Soporte

Para preguntas o problemas, contacta al equipo de desarrollo de reConecta.
