# Workers Implementation Guide

## 🔧 Implementación de Workers en reConecta API

### Tipos de Workers Implementados

#### 1. **Cluster Mode** (Multi-proceso)
Aprovecha múltiples cores de CPU ejecutando varias instancias de la aplicación.

**Archivo:** `src/cluster.js`

**Características:**
- Crea N workers (CPUs - 1 por defecto)
- Auto-restart si un worker muere
- Load balancing automático por el SO
- Graceful shutdown

**Uso:**
```bash
# En lugar de:
npm start

# Usar:
node src/cluster.js
```

**Configuración:**
```bash
# .env
WORKERS=4  # Número de workers (opcional)
```

---

#### 2. **Worker Threads Pool** (Tareas pesadas)
Para procesamiento CPU-intensive sin bloquear el event loop.

**Archivos:**
- `src/workers/WorkerPool.js` - Pool manager
- `src/workers/notificationWorker.js` - Worker de ejemplo
- `src/services/workerService.js` - API del servicio

**Casos de uso:**
- Envío masivo de notificaciones
- Procesamiento de analíticas complejas
- Generación de reportes
- Procesamiento de imágenes
- Cálculos pesados

**Ejemplo de uso:**

```javascript
// En cualquier controller
import { processBulkNotificationsAsync } from '../services/workerService.js';

export const enviarNotificacionMasiva = async (req, res) => {
  const { receptores_ids, titulo, contenido } = req.body;
  
  // Esto no bloquea el thread principal
  processBulkNotificationsAsync(receptores_ids, titulo, contenido)
    .then(result => {
      logger.info('Notificaciones procesadas:', result);
    })
    .catch(error => {
      logger.error('Error:', error);
    });
  
  // Respuesta inmediata
  res.json({ 
    message: 'Notificaciones en proceso',
    total: receptores_ids.length 
  });
};
```

---

### 🚀 Configuración en package.json

Actualizar scripts:

```json
{
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js",
    "start:cluster": "node src/cluster.js",
    "start:prod": "NODE_ENV=production node src/cluster.js",
    "seed:users": "node src/scripts/seedUsers.js"
  }
}
```

---

### 📊 Endpoint de Monitoreo

Agregar a `src/app.js`:

```javascript
import { getWorkerPoolStatus } from './services/workerService.js';

app.get('/api/health/workers', (req, res) => {
  res.json({
    cluster: {
      isPrimary: require('cluster').isPrimary,
      workerId: require('cluster').worker?.id,
      pid: process.pid
    },
    workerPool: getWorkerPoolStatus(),
    memory: process.memoryUsage(),
    uptime: process.uptime()
  });
});
```

---

### 🎯 Cuándo usar cada tipo

#### Cluster Mode (Multi-proceso)
✅ **Usar para:**
- Producción
- Aprovechar múltiples cores
- Alta disponibilidad (auto-restart)
- Load balancing de requests HTTP

❌ **No usar para:**
- Desarrollo local (dificulta debugging)
- Servidores con 1 solo core

#### Worker Threads (Tareas pesadas)
✅ **Usar para:**
- Procesamiento CPU-intensive
- Tareas que toman >100ms
- Operaciones que pueden ser asíncronas
- Generación de reportes
- Procesamiento de archivos grandes

❌ **No usar para:**
- I/O operations (ya son async en Node.js)
- Queries simples a BD
- Tasks que requieren acceso a memoria compartida compleja

---

### 🔄 Integración con Notificaciones Existentes

Actualizar `src/Controllers/notificacionesController.js`:

```javascript
import { processBulkNotificationsAsync } from '../services/workerService.js';

export const enviarNotificacionMasiva = async (req, res, next) => {
  try {
    const { receptores_ids, tipo, titulo, contenido, url } = req.body;
    const emisorId = req.user.id;

    // Validaciones...
    if (!receptores_ids || receptores_ids.length === 0) {
      return res.status(400).json({ message: "Debes seleccionar al menos un destinatario" });
    }

    // Para pocos usuarios, procesar directamente
    if (receptores_ids.length <= 50) {
      const notificaciones = await notificacionesDAO.crearNotificacionMasiva(
        emisorId, receptores_ids, tipo, titulo, contenido, url
      );

      // Emitir via Socket.IO
      if (req.io) {
        notificaciones.forEach(notif => {
          req.io.to(`user_${notif.receptor_id}`).emit('nueva_notificacion', notif);
        });
      }

      await dashboardDAO.registrarActividad(
        emisorId, 'notificacion', 'Notificación masiva enviada',
        `Envió ${notificaciones.length} notificaciones: ${titulo}`
      );

      return res.status(201).json({ 
        success: true, 
        message: `Se enviaron ${notificaciones.length} notificaciones`,
        notificaciones 
      });
    }

    // Para muchos usuarios, procesar en background con worker
    processBulkNotificationsAsync(receptores_ids, titulo, contenido)
      .then(async () => {
        // Procesar notificaciones en lotes
        const batchSize = 50;
        for (let i = 0; i < receptores_ids.length; i += batchSize) {
          const batch = receptores_ids.slice(i, i + batchSize);
          const notifs = await notificacionesDAO.crearNotificacionMasiva(
            emisorId, batch, tipo, titulo, contenido, url
          );

          if (req.io) {
            notifs.forEach(notif => {
              req.io.to(`user_${notif.receptor_id}`).emit('nueva_notificacion', notif);
            });
          }

          // Delay entre lotes para no saturar
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        await dashboardDAO.registrarActividad(
          emisorId, 'notificacion', 'Notificación masiva enviada',
          `Envió ${receptores_ids.length} notificaciones: ${titulo}`
        );
      })
      .catch(error => {
        logger.error('Error procesando notificaciones masivas:', error);
      });

    // Respuesta inmediata
    res.status(202).json({ 
      success: true, 
      message: `Procesando envío de ${receptores_ids.length} notificaciones en segundo plano`,
      status: 'processing'
    });

  } catch (error) {
    next(error);
  }
};
```

---

### 📈 Beneficios

1. **Cluster Mode:**
   - 🚀 Aprovecha todos los cores del servidor
   - 🔄 Auto-restart en caso de crash
   - ⚡ Mayor throughput de requests
   - 📊 ~300-400% mejora en requests/segundo (4 cores)

2. **Worker Threads:**
   - 🎯 No bloquea el event loop
   - ⚡ Procesa tareas pesadas en paralelo
   - 🔧 Queue automático de tareas
   - 📉 Reduce tiempo de respuesta de API

---

### 🧪 Testing

```javascript
// Test del worker pool
import { processBulkNotificationsAsync, getWorkerPoolStatus } from './services/workerService.js';

async function testWorkers() {
  console.log('Estado inicial:', getWorkerPoolStatus());
  
  const tasks = [];
  for (let i = 0; i < 10; i++) {
    tasks.push(
      processBulkNotificationsAsync([1,2,3,4,5], 'Test', 'Contenido de prueba')
    );
  }
  
  const results = await Promise.all(tasks);
  console.log('Resultados:', results);
  console.log('Estado final:', getWorkerPoolStatus());
}

testWorkers();
```

---

### 🛠️ Monitoreo en Producción

```bash
# Ver workers activos
ps aux | grep node

# Logs de cluster
pm2 start src/cluster.js -i max --name reconecta-api

# Monitoreo
pm2 monit
```

---

### 🚧 Próximos Pasos

1. **Implementar Bull/BullMQ** para colas persistentes con Redis
2. **Agregar métricas** con Prometheus
3. **Implementar circuit breaker** para workers
4. **Rate limiting por worker**
5. **Health checks avanzados**

---

### 📚 Referencias

- [Node.js Cluster](https://nodejs.org/api/cluster.html)
- [Worker Threads](https://nodejs.org/api/worker_threads.html)
- [Bull Queue](https://github.com/OptimalBits/bull)
