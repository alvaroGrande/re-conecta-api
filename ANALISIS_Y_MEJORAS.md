# 📊 Análisis del Proyecto API - Errores y Mejoras

## 🔴 PROBLEMAS CRÍTICOS (Prioridad Alta)

### 1. **SEGURIDAD: Contraseña hardcodeada**
**Ubicación:** `src/Controllers/authController.js` línea 19
```javascript
if (password !== "Admin") {
```
**Problema:** La contraseña está hardcodeada en el código. NUNCA se debe hacer esto.

**Solución:**
```javascript
import bcrypt from 'bcryptjs';

// En login:
const match = await bcrypt.compare(password, user.password_hash);
if (!match) {
    return res.status(401).json({ ok: false, message: 'Credenciales inválidas.' });
}
```

**Agregar al package.json:**
```json
"bcryptjs": "^2.4.3"
```

### 2. **SEGURIDAD: CORS muy permisivo**
**Ubicación:** `src/app.js` línea 44
```javascript
app.use(cors({
  origin: true, // Permite cualquier origen ❌
```

**Problema:** Permite peticiones desde cualquier origen, lo cual es un riesgo de seguridad.

**Solución:**
```javascript
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: function(origin, callback) {
    // Permitir peticiones sin origin (mobile apps, Postman, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('No permitido por CORS'), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### 3. **SEGURIDAD: Falta validación de variables de entorno**
**Ubicación:** `src/config.js`

**Problema:** No se valida que las variables de entorno críticas existan.

**Solución:**
```javascript
import 'dotenv/config';

// Validar variables críticas
const requiredEnvVars = [
  'JWT_SECRET',
  'SUPABASE_KEY',
  'SUPABASE_URL',
  'ZOOM_SDK_KEY',
  'ZOOM_SDK_SECRET'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`❌ Variable de entorno requerida no encontrada: ${varName}`);
  }
});

export const JWT = {
  SECRET: process.env.JWT_SECRET
};
```

### 4. **SEGURIDAD: URL de Supabase hardcodeada**
**Ubicación:** `src/config.js` línea 8
```javascript
URL : 'https://uyzqigelvhjkopoyrcft.supabase.co'
```

**Problema:** La URL está hardcodeada. Debería estar en .env

**Solución:**
```javascript
export const SUPABASE = {
  KEY: process.env.SUPABASE_KEY,
  URL: process.env.SUPABASE_URL || 'https://uyzqigelvhjkopoyrcft.supabase.co'
}
```

## 🟡 PROBLEMAS IMPORTANTES (Prioridad Media)

### 5. **LOGGING: Uso inconsistente de console.log vs logger**
**Ubicación:** Múltiples archivos

**Problema:** Se usa `console.log/error` en lugar del logger configurado (Pino).

**Archivos afectados:**
- `src/Controllers/authController.js` (líneas 38, 65, 102, 118)
- `src/Controllers/notificacionesController.js` (líneas 77, 79, 155, 157)
- `src/middlewares/errorHandler.js` (línea 2)
- `src/middlewares/auth.js` (línea 29)
- Y más...

**Solución:** Reemplazar todos los `console.log/error` con el logger:
```javascript
// ❌ Mal
console.log('Mensaje');
console.error('Error:', err);

// ✅ Bien
logger.info('Mensaje');
logger.error('Error:', err);
```

### 6. **MANEJO DE ERRORES: Error handler muy básico**
**Ubicación:** `src/middlewares/errorHandler.js`

**Problema:** No distingue entre errores de producción y desarrollo, no sanitiza información sensible.

**Solución:**
```javascript
import logger from '../logger.js';

export const errorHandler = (err, req, res, next) => {
  // Loggear el error
  logger.error({
    err,
    req: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body
    }
  }, 'Error en request');

  // Status code
  const status = err.statusCode || err.status || 500;
  
  // Mensaje de error
  const message = err.isOperational 
    ? err.message 
    : 'Error interno del servidor';

  // Error code
  const errorCode = err.errorCode || 'SERVER_ERROR';

  // Respuesta diferente según ambiente
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(status).json({
    error: errorCode,
    message,
    ...(isDevelopment && { stack: err.stack, details: err })
  });
};
```

### 7. **VALIDACIÓN: Falta validación de entrada**
**Problema:** No se validan los datos de entrada en los controladores.

**Solución:** Implementar un middleware de validación con express-validator:

```bash
npm install express-validator
```

**Ejemplo de uso:**
```javascript
// src/middlewares/validators.js
import { body, validationResult } from 'express-validator';

export const validateLogin = [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('Contraseña debe tener al menos 6 caracteres'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// En routes/auth.js
import { validateLogin } from '../middlewares/validators.js';
router.post('/login', validateLogin, login);
```

### 8. **RATE LIMITING: Configuración muy permisiva**
**Ubicación:** `src/app.js` líneas 11-16

**Problema:** 1000 requests por minuto es demasiado permisivo.

**Solución:**
```javascript
// Rate limiters específicos por tipo de endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos por IP
  message: 'Demasiados intentos de login, intenta más tarde'
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 requests por minuto es más razonable
  standardHeaders: true,
  legacyHeaders: false,
});

// Aplicar
app.use('/api/', apiLimiter);
app.use('/api/auth/login', loginLimiter);
```

### 9. **SQL INJECTION: Potencial vulnerabilidad en búsquedas**
**Ubicación:** `src/DAO/contactosDAO.js` y otros DAOs

**Problema:** Aunque Supabase sanitiza queries, es importante validar inputs.

**Ejemplo problemático:**
```javascript
if (search) {
  query = query.or(`nombre.ilike.%${search}%,Apellidos.ilike.%${search}%`);
}
```

**Solución:** Validar y sanitizar el input:
```javascript
if (search) {
  // Sanitizar: remover caracteres especiales peligrosos
  const sanitizedSearch = search.replace(/[%_\\]/g, '\\$&');
  query = query.or(`nombre.ilike.%${sanitizedSearch}%,Apellidos.ilike.%${sanitizedSearch}%`);
}
```

## 🟢 MEJORAS RECOMENDADAS (Prioridad Baja)

### 10. **ARQUITECTURA: Falta capa de servicio**
**Problema:** La lógica de negocio está mezclada en controladores y DAOs.

**Solución:** Crear una capa de servicios:
```
src/
  services/
    authService.js
    contactosService.js
    encuestasService.js
```

**Ejemplo:**
```javascript
// src/services/authService.js
import * as userDAO from '../DAO/userDAO.js';
import bcrypt from 'bcryptjs';
import { createToken } from '../utils/jwt.js';

export const authenticateUser = async (email, password) => {
  const user = await userDAO.getUserByEmail(email);
  if (!user) {
    throw new Error('Usuario no encontrado');
  }
  
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    throw new Error('Contraseña incorrecta');
  }
  
  await userDAO.actualizarUltimoInicio(user.id);
  const token = await createToken(user, '8h');
  
  return { user, token };
};

// Controller queda simple:
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { user, token } = await authService.authenticateUser(email, password);
    
    res.json({
      ok: true,
      accessToken: token,
      usuario: user
    });
  } catch (error) {
    next(error);
  }
};
```

### 11. **TESTING: Falta cobertura de tests**
**Problema:** El proyecto no tiene tests automatizados.

**Solución:** Implementar tests con Jest o Mocha:

```bash
npm install --save-dev jest supertest
```

**Ejemplo:**
```javascript
// tests/unit/auth.test.js
import { authenticateUser } from '../../src/services/authService';

describe('Auth Service', () => {
  test('debe autenticar usuario con credenciales correctas', async () => {
    const result = await authenticateUser('test@test.com', 'password123');
    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('user');
  });

  test('debe rechazar contraseña incorrecta', async () => {
    await expect(
      authenticateUser('test@test.com', 'wrong')
    ).rejects.toThrow('Contraseña incorrecta');
  });
});
```

### 12. **DOCUMENTACIÓN: Falta documentación de API**
**Solución:** Implementar Swagger/OpenAPI:

```bash
npm install swagger-jsdoc swagger-ui-express
```

**Configuración:**
```javascript
// src/config/swagger.js
import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'reConecta API',
      version: '1.0.0',
      description: 'API para la plataforma reConecta'
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor de desarrollo'
      }
    ]
  },
  apis: ['./src/routes/*.js'] // Path a los archivos con anotaciones
};

export const specs = swaggerJsdoc(options);

// En app.js:
import swaggerUi from 'swagger-ui-express';
import { specs } from './config/swagger.js';

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
```

### 13. **PERFORMANCE: Falta caché**
**Solución:** Implementar Redis para caché:

```bash
npm install redis
```

**Ejemplo:**
```javascript
// src/config/redis.js
import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

client.on('error', (err) => logger.error('Redis error:', err));
await client.connect();

export default client;

// Middleware de caché:
export const cacheMiddleware = (duration = 300) => async (req, res, next) => {
  const key = `cache:${req.originalUrl}`;
  
  try {
    const cached = await client.get(key);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    // Interceptar res.json para cachear
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      client.setEx(key, duration, JSON.stringify(data));
      return originalJson(data);
    };
    
    next();
  } catch (error) {
    next();
  }
};
```

### 14. **MONITOREO: Falta health checks**
**Solución:**
```javascript
// src/routes/health.js
import express from 'express';
import { supabase } from '../DAO/connection.js';

const router = express.Router();

router.get('/health', async (req, res) => {
  try {
    // Verificar DB
    const { error } = await supabase.from('appUsers').select('id').limit(1);
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: error ? 'down' : 'up',
        api: 'up'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: error.message
    });
  }
});

export default router;

// En app.js:
import healthRoutes from './routes/health.js';
app.use('/api', healthRoutes);
```

### 15. **CONFIGURACIÓN: Mejora de variables de entorno**
**Crear archivo .env.example más completo:**
```env
# JWT
JWT_SECRET=your_jwt_secret_here_min_32_chars

# Supabase
SUPABASE_KEY=your_supabase_key
SUPABASE_URL=https://your-project.supabase.co

# Zoom
ZOOM_SDK_KEY=your_zoom_sdk_key
ZOOM_SDK_SECRET=your_zoom_sdk_secret
ZOOM_ACCOUNT_ID=your_zoom_account_id
ZOOM_CLIENT_ID=your_zoom_client_id
ZOOM_CLIENT_SECRET=your_zoom_client_secret

# Server
PORT=3000
NODE_ENV=development

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Cluster
USE_CLUSTER=false
CLUSTER_WORKERS=auto

# Workers
USE_WORKER_THREADS=true
WORKER_THREADS=4

# Logging
LOG_LEVEL=info

# Tasks
TASKS_TESTING_MODE=false
DIAS_RETENCION_ACTIVIDADES=90

# Redis (opcional)
REDIS_URL=redis://localhost:6379
```

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### Prioridad Inmediata (Esta semana)
- [ ] Implementar hashing de contraseñas con bcrypt
- [ ] Configurar CORS correctamente con origins permitidos
- [ ] Validar todas las variables de entorno al inicio
- [ ] Mover URL de Supabase a .env
- [ ] Reemplazar todos los console.log con logger

### Prioridad Alta (Este mes)
- [ ] Mejorar error handler con información de desarrollo/producción
- [ ] Implementar validación de entrada con express-validator
- [ ] Ajustar rate limiting por tipo de endpoint
- [ ] Sanitizar inputs en búsquedas
- [ ] Implementar health checks

### Prioridad Media (Próximos 2 meses)
- [ ] Crear capa de servicios
- [ ] Implementar tests unitarios básicos
- [ ] Documentar API con Swagger
- [ ] Implementar caché con Redis
- [ ] Añadir monitoreo y métricas

### Mejoras Futuras
- [ ] Implementar CI/CD
- [ ] Configurar análisis de código estático (ESLint strict)
- [ ] Implementar rate limiting distribuido con Redis
- [ ] Añadir integración con Sentry para tracking de errores
- [ ] Implementar audit logging completo

## 🎯 MÉTRICAS DE ÉXITO

Después de implementar las mejoras críticas:
- ✅ 0 contraseñas hardcodeadas en código
- ✅ 0 usos de console.log/error (usar logger)
- ✅ 100% de variables de entorno validadas
- ✅ CORS configurado solo para dominios permitidos
- ✅ Rate limiting apropiado por endpoint
- ✅ Validación de entrada en todos los endpoints públicos

## 📚 RECURSOS ÚTILES

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Supabase Security Guidelines](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)

---

**Generado:** 14 de enero de 2026  
**Versión API:** 1.0.0  
**Próxima revisión:** Después de implementar mejoras críticas
