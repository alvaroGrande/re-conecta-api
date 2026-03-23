# 🚀 Implementación de API de Encuestas - Guía Rápida

## ✅ Archivos Creados

### Backend (re-ConectaAPI)

1. **src/DAO/encuestasDAO.js** - Acceso a datos con Supabase
2. **src/Controllers/encuestasController.js** - Lógica de negocio
3. **src/routes/encuestas.js** - Definición de rutas REST
4. **src/scripts/encuestas_schema.sql** - Schema de base de datos
5. **docs/API_ENCUESTAS.md** - Documentación completa
6. **tests/encuestas.http** - Casos de prueba

### Frontend (reConecta)

- **src/services/encuestas.js** - Actualizado para usar API real

### Modificaciones

- **src/app.js** - Registradas las rutas de encuestas

---

## 📦 Pasos de Implementación

### 1. Configurar Base de Datos

Ve a tu panel de Supabase y ejecuta el script SQL:

```bash
re-ConectaAPI/src/scripts/encuestas_schema.sql
```

Esto creará:
- 5 tablas necesarias
- Índices optimizados
- 2 encuestas de ejemplo

### 2. Reiniciar el Servidor Backend

```bash
cd re-ConectaAPI
npm run dev
```

Verifica que las rutas se registraron:
```
✓ /api/encuestas está disponible
```

### 3. Probar la API

Usa Thunder Client, Postman o REST Client con el archivo:
```bash
re-ConectaAPI/tests/encuestas.http
```

**Importante**: Reemplaza `YOUR_JWT_TOKEN_HERE` con un token válido de administrador.

### 4. Verificar Frontend

El servicio ya está actualizado. Solo necesitas:
- Asegurarte de que la API esté corriendo
- Tener un usuario administrador para crear encuestas
- Probar crear, responder y ver resultados

---

## 🔐 Usuarios y Permisos

### Para Crear Encuestas
Necesitas un usuario con `rol = 1` (Administrador).

Verifica tu usuario en Supabase:
```sql
SELECT id, nombre, email, rol FROM usuarios;
```

Si necesitas hacer admin a un usuario:
```sql
UPDATE usuarios SET rol = 1 WHERE email = 'tu@email.com';
```

### Para Responder Encuestas
Cualquier usuario autenticado (rol 1, 2, o 3).

---

## 🎯 Endpoints Disponibles

| Método | Ruta | Descripción | Requiere Admin |
|--------|------|-------------|----------------|
| GET | `/api/encuestas` | Listar encuestas | No |
| GET | `/api/encuestas/:id` | Ver encuesta | No |
| POST | `/api/encuestas` | Crear encuesta | **Sí** |
| POST | `/api/encuestas/:id/respuestas` | Responder | No |
| GET | `/api/encuestas/:id/resultados` | Ver resultados | No |
| PATCH | `/api/encuestas/:id/publicar` | Publicar | **Sí** |

---

## 🧪 Pruebas Recomendadas

1. **Login como administrador**
   ```
   POST /api/auth/login
   ```

2. **Crear una encuesta**
   ```
   POST /api/encuestas
   ```

3. **Login como usuario normal**
   ```
   POST /api/auth/login
   ```

4. **Listar encuestas activas**
   ```
   GET /api/encuestas?estado=activa
   ```

5. **Responder una encuesta**
   ```
   POST /api/encuestas/1/respuestas
   ```

6. **Ver resultados**
   ```
   GET /api/encuestas/1/resultados
   ```

7. **Intentar responder de nuevo (debe fallar con 409)**
   ```
   POST /api/encuestas/1/respuestas
   ```

---

## 📊 Estructura de Datos

### Crear Encuesta (Body)
```json
{
  "titulo": "Título",
  "descripcion": "Descripción",
  "fecha_fin": "2025-12-31",
  "preguntas": [
    {
      "texto": "Pregunta múltiple",
      "tipo": "multiple",
      "opciones": [
        { "texto": "Opción 1" },
        { "texto": "Opción 2" }
      ]
    },
    {
      "texto": "Pregunta abierta",
      "tipo": "abierta"
    }
  ]
}
```

### Responder Encuesta (Body)
```json
{
  "respuestas": {
    "1": [1, 2],          // IDs de opciones (array)
    "2": "Texto libre"    // Respuesta abierta (string)
  }
}
```

---

## ⚠️ Validaciones Implementadas

### Backend
- ✅ Solo admins pueden crear encuestas
- ✅ Fecha fin no puede ser pasada
- ✅ Al menos una pregunta requerida
- ✅ Preguntas múltiples deben tener opciones
- ✅ Un usuario solo puede responder una vez
- ✅ No se puede responder encuestas cerradas

### Base de Datos
- ✅ Constraint único: usuario + encuesta
- ✅ Cascada en eliminaciones
- ✅ Integridad referencial

---

## 🐛 Solución de Problemas

### "Token no proporcionado"
→ Agrega el header `Authorization: Bearer <token>`

### "No tienes permisos para crear encuestas"
→ Tu usuario no tiene rol = 1. Verifica en la base de datos.

### "Ya has respondido esta encuesta"
→ Intenta con otro usuario o desde otra cuenta.

### "La encuesta ya está cerrada"
→ La fecha_fin es anterior a hoy. Verifica las fechas.

### Tablas no existen
→ Ejecuta el script SQL en Supabase primero.

---

## 📝 Próximos Pasos Opcionales

1. **Editar encuestas** - Agregar endpoint PUT/PATCH
2. **Eliminar encuestas** - Agregar endpoint DELETE
3. **Cerrar manualmente** - Endpoint para cerrar antes de fecha_fin
4. **Notificaciones** - Alertar cuando se publique una encuesta
5. **Analytics** - Dashboard de estadísticas
6. **Exportar resultados** - Descargar en CSV/Excel
7. **RLS en Supabase** - Políticas de seguridad a nivel de BD

---

## ✨ Características Destacadas

- 🔒 **Seguridad**: JWT + validación de roles
- 🚫 **Prevención duplicados**: Constraint único en BD
- 📊 **Resultados en tiempo real**: Agregación automática
- ✅ **Validación robusta**: Frontend y backend
- 📱 **Frontend listo**: Ya integrado con Vue
- 🗄️ **Escalable**: Arquitectura DAO + Controller
- 📖 **Documentado**: Docs completa + ejemplos

---

## 📞 Contacto

Si tienes dudas o encuentras problemas, consulta:
- **Documentación**: `docs/API_ENCUESTAS.md`
- **Ejemplos**: `tests/encuestas.http`

---

**¡La API está lista para usarse! 🎉**
