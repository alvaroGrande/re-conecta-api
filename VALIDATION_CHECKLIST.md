# ✅ Checklist de Validación - API de Encuestas

## Pre-requisitos

- [ ] Node.js instalado y servidor corriendo
- [ ] Supabase configurado con credenciales correctas
- [ ] Base de datos accesible
- [ ] Variables de entorno configuradas (JWT_SECRET, SUPABASE_URL, SUPABASE_KEY)

---

## 1. Base de Datos

### Ejecutar Schema
- [ ] Abrir panel de Supabase SQL Editor
- [ ] Copiar contenido de `src/scripts/encuestas_schema.sql`
- [ ] Ejecutar script completo
- [ ] Verificar que se crearon 5 tablas:
  - [ ] `encuestas`
  - [ ] `encuestas_preguntas`
  - [ ] `encuestas_opciones`
  - [ ] `encuestas_respuestas`
  - [ ] `encuestas_respuestas_detalle`

### Verificar Datos de Ejemplo
```sql
SELECT * FROM encuestas;
SELECT * FROM encuestas_preguntas;
SELECT * FROM encuestas_opciones;
```
- [ ] Se crearon 2 encuestas de ejemplo
- [ ] Cada encuesta tiene preguntas asociadas
- [ ] Las preguntas múltiples tienen opciones

---

## 2. Backend

### Archivos Creados
- [ ] `src/DAO/encuestasDAO.js` existe
- [ ] `src/Controllers/encuestasController.js` existe
- [ ] `src/routes/encuestas.js` existe
- [ ] Rutas registradas en `src/app.js`

### Iniciar Servidor
```bash
cd re-ConectaAPI
npm run dev
```
- [ ] Servidor inicia sin errores
- [ ] No hay errores de importación
- [ ] Puerto escuchando (ej: 3000)

### Verificar Endpoint Base
```bash
curl http://localhost:3000/
```
- [ ] Responde: `{"message": "API funcionando y conectada 🚀"}`

---

## 3. Autenticación

### Obtener Token de Admin
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@reconecta.com","password":"tu_password"}'
```
- [ ] Respuesta incluye `token`
- [ ] Respuesta incluye usuario con `rol: 1`
- [ ] Guardar token para siguientes pruebas

### Obtener Token de Usuario Normal
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@reconecta.com","password":"tu_password"}'
```
- [ ] Respuesta incluye `token`
- [ ] Usuario tiene `rol: 2` o `rol: 3`
- [ ] Guardar token para siguientes pruebas

---

## 4. Pruebas de API

### 4.1 Listar Encuestas (GET /api/encuestas)
```bash
curl http://localhost:3000/api/encuestas \
  -H "Authorization: Bearer TU_TOKEN"
```
- [ ] Responde código 200
- [ ] Retorna array de encuestas
- [ ] Cada encuesta tiene: id, titulo, descripcion, fecha_fin, preguntas
- [ ] Preguntas incluyen opciones (si son múltiples)

### 4.2 Filtrar Encuestas Activas
```bash
curl http://localhost:3000/api/encuestas?estado=activa \
  -H "Authorization: Bearer TU_TOKEN"
```
- [ ] Solo retorna encuestas con fecha_fin >= hoy
- [ ] Campo `estado` es "activa"

### 4.3 Obtener Encuesta Específica
```bash
curl http://localhost:3000/api/encuestas/1 \
  -H "Authorization: Bearer TU_TOKEN"
```
- [ ] Responde código 200
- [ ] Retorna encuesta completa con preguntas y opciones
- [ ] Incluye contador de respuestas

### 4.4 Crear Encuesta (Admin)
```bash
curl -X POST http://localhost:3000/api/encuestas \
  -H "Authorization: Bearer TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Test Encuesta",
    "descripcion": "Descripción de prueba",
    "fecha_fin": "2025-12-31",
    "preguntas": [
      {
        "texto": "¿Te gusta?",
        "tipo": "multiple",
        "opciones": [
          {"texto": "Sí"},
          {"texto": "No"}
        ]
      }
    ]
  }'
```
- [ ] Responde código 201
- [ ] Retorna encuesta creada con ID
- [ ] Se crearon registros en BD (verificar en Supabase)

### 4.5 Crear Encuesta (Usuario Normal - Debe Fallar)
```bash
curl -X POST http://localhost:3000/api/encuestas \
  -H "Authorization: Bearer TOKEN_USUARIO" \
  -H "Content-Type: application/json" \
  -d '{...}'
```
- [ ] Responde código 403
- [ ] Mensaje: "No tienes permisos para crear encuestas"

### 4.6 Responder Encuesta
```bash
curl -X POST http://localhost:3000/api/encuestas/1/respuestas \
  -H "Authorization: Bearer TOKEN_USUARIO" \
  -H "Content-Type: application/json" \
  -d '{
    "respuestas": {
      "1": [1],
      "2": "Mi respuesta abierta"
    }
  }'
```
- [ ] Responde código 201
- [ ] Mensaje: "Respuesta registrada correctamente"
- [ ] Se crearon registros en `encuestas_respuestas` y `encuestas_respuestas_detalle`

### 4.7 Responder Nuevamente (Debe Fallar)
```bash
# Mismo comando anterior
```
- [ ] Responde código 409
- [ ] Mensaje: "Ya has respondido esta encuesta"

### 4.8 Obtener Resultados
```bash
curl http://localhost:3000/api/encuestas/1/resultados \
  -H "Authorization: Bearer TU_TOKEN"
```
- [ ] Responde código 200
- [ ] Incluye `yaRespondida: true/false`
- [ ] Incluye `resultados` con conteos para preguntas múltiples
- [ ] Incluye array de respuestas para preguntas abiertas

---

## 5. Frontend

### Verificar Servicio
- [ ] Abrir `src/services/encuestas.js`
- [ ] Funciones ya no usan datos MOCK
- [ ] Usan `api.get()` y `api.post()` correctamente

### Probar en Navegador
```bash
cd reConecta
npm run dev
```
- [ ] Frontend inicia sin errores
- [ ] Navegar a `/encuestas`

### Como Administrador
- [ ] Login con usuario admin
- [ ] Botón "Crear Encuesta" visible
- [ ] Click en "Crear Encuesta" abre modal
- [ ] Completar formulario y crear
- [ ] Encuesta aparece en la lista
- [ ] Sin errores en consola

### Como Usuario Normal
- [ ] Login con usuario regular
- [ ] Lista de encuestas visible
- [ ] Click en encuesta activa
- [ ] Formulario de respuesta se muestra
- [ ] Completar y enviar respuestas
- [ ] Mensaje de éxito aparece
- [ ] Al volver a abrir, muestra resultados (yaRespondida)

---

## 6. Validaciones de Seguridad

### Sin Token
```bash
curl http://localhost:3000/api/encuestas
```
- [ ] Responde código 401
- [ ] Mensaje: "Token no proporcionado"

### Token Inválido
```bash
curl http://localhost:3000/api/encuestas \
  -H "Authorization: Bearer TOKEN_INVALIDO"
```
- [ ] Responde código 403
- [ ] Mensaje: "Token inválido o expirado"

### Fecha Fin Pasada
```bash
curl -X POST http://localhost:3000/api/encuestas \
  -H "Authorization: Bearer TOKEN_ADMIN" \
  -d '{
    "titulo": "Test",
    "descripcion": "Test",
    "fecha_fin": "2020-01-01",
    "preguntas": [...]
  }'
```
- [ ] Responde código 400
- [ ] Mensaje sobre fecha inválida

### Sin Preguntas
```bash
curl -X POST http://localhost:3000/api/encuestas \
  -H "Authorization: Bearer TOKEN_ADMIN" \
  -d '{
    "titulo": "Test",
    "descripcion": "Test",
    "fecha_fin": "2025-12-31",
    "preguntas": []
  }'
```
- [ ] Responde código 400
- [ ] Mensaje: "La encuesta debe tener al menos una pregunta"

---

## 7. Base de Datos - Integridad

### Cascada en Eliminación
```sql
DELETE FROM encuestas WHERE id = 1;
```
- [ ] Se eliminan automáticamente sus preguntas
- [ ] Se eliminan automáticamente sus opciones
- [ ] Se eliminan automáticamente sus respuestas

### Constraint Único
```sql
INSERT INTO encuestas_respuestas (encuesta_id, usuario_id) 
VALUES (1, 1), (1, 1);
```
- [ ] Segunda inserción falla
- [ ] Error: violación de constraint único

---

## 8. Rendimiento

### Consultas Optimizadas
- [ ] Índices creados en tablas
- [ ] Consultas usan JOINs eficientes
- [ ] No hay N+1 queries

### Tiempos de Respuesta
- [ ] GET /encuestas < 500ms
- [ ] GET /encuestas/:id < 300ms
- [ ] POST /encuestas < 1s
- [ ] POST /respuestas < 800ms
- [ ] GET /resultados < 600ms

---

## 9. Documentación

- [ ] `docs/API_ENCUESTAS.md` completo
- [ ] `ENCUESTAS_SETUP.md` con instrucciones
- [ ] `tests/encuestas.http` con ejemplos
- [ ] Código comentado en DAO
- [ ] Comentarios en Controller

---

## 10. Casos Límite

### Múltiples Opciones Seleccionadas
```json
{
  "respuestas": {
    "1": [1, 2, 3, 4]
  }
}
```
- [ ] Se guardan todas las opciones
- [ ] Se reflejan en resultados

### Pregunta Abierta Vacía
```json
{
  "respuestas": {
    "2": ""
  }
}
```
- [ ] Se acepta (opcional)
- [ ] No causa error

### Encuesta con 10+ Preguntas
- [ ] Crea correctamente todas las preguntas
- [ ] Mantiene el orden correcto
- [ ] Todas las opciones se asocian bien

---

## ✅ Resultado Final

Si todos los checks están marcados:

**🎉 La API está completamente funcional y lista para producción**

### Pasos Siguientes Opcionales:
- [ ] Configurar CI/CD
- [ ] Agregar tests automatizados (Jest/Mocha)
- [ ] Habilitar RLS en Supabase
- [ ] Configurar rate limiting específico
- [ ] Agregar logging detallado
- [ ] Monitoreo con Sentry/LogRocket

---

**Fecha de validación:** _______
**Validado por:** _______
**Versión:** 1.0.0
