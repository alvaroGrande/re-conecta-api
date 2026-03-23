# Testing reConecta API

Este directorio contiene las pruebas automatizadas del backend.

## Estructura

```
tests/
├── unit/                    # Tests unitarios
│   ├── controllers/         # Tests de controladores
│   └── dao/                 # Tests de DAOs
├── integration/             # Tests de integración
└── encuestas.http          # Tests manuales HTTP
```

## Configuración

### Instalar dependencias de testing

```bash
npm install --save-dev jest supertest @types/jest
```

### Configurar Jest

Añadir a `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "jest": {
    "testEnvironment": "node",
    "coveragePathIgnorePatterns": ["/node_modules/"]
  }
}
```

## Ejecutar Tests

```bash
# Todos los tests
npm test

# Tests en modo watch
npm run test:watch

# Tests con cobertura
npm run test:coverage

# Tests específicos
npm test userDAO.test.js
```

## Tipos de Tests

### Unit Tests
Tests aislados de funciones específicas sin dependencias externas.

**Ejemplo**: `tests/unit/dao/userDAO.test.js`

### Integration Tests
Tests que verifican el funcionamiento completo de endpoints.

**Ejemplo**: `tests/integration/api.test.js`

### Manual HTTP Tests
Archivo `.http` para probar endpoints manualmente con extensiones como REST Client.

**Ejemplo**: `tests/encuestas.http`

## Best Practices

1. **Mockear dependencias externas** (Supabase, APIs)
2. **Usar beforeEach/afterEach** para limpiar estado
3. **Tests descriptivos** con `describe` e `it`
4. **Arrange-Act-Assert** pattern en cada test
5. **No hacer tests con datos de producción**

## Variables de Entorno

Crear `.env.test` con credenciales de testing:

```env
SUPABASE_URL=https://test.supabase.co
SUPABASE_KEY=test_key
JWT_SECRET=test_secret
```
