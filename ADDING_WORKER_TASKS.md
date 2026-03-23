# Guía para Agregar Nuevos Tipos de Tareas al Worker

## 📝 Método Simple (Un solo archivo)

### Paso 1: Agregar handler en `notificationWorker.js`

```javascript
// Nueva función handler
const myNewTask = async (data) => {
  const { param1, param2 } = data;
  
  // Tu lógica aquí
  
  return {
    result: 'success',
    processedAt: new Date().toISOString()
  };
};

// Registrar el handler
registerHandler('MY_NEW_TASK', myNewTask);
```

### Paso 2: Usar en tu servicio

```javascript
// En workerService.js o cualquier controller
import { workerPool } from './workerService.js';

const result = await workerPool.runTask({
  type: 'MY_NEW_TASK',
  data: { param1: 'value1', param2: 'value2' }
});
```

---

## 🗂️ Método Modular (Recomendado para muchos tipos)

### Estructura de archivos:

```
src/workers/
├── notificationWorkerModular.js  (worker principal)
├── handlers/
│   ├── taskHandlers.js          (handlers básicos)
│   ├── notificationHandlers.js  (handlers de notificaciones)
│   ├── reportHandlers.js        (handlers de reportes)
│   └── analyticsHandlers.js     (handlers de analíticas)
```

### Paso 1: Crear handler en archivo separado

```javascript
// src/workers/handlers/myHandlers.js
export const myCustomTaskHandler = async (data) => {
  const { userId, action } = data;
  
  // Tu lógica aquí
  
  return {
    userId,
    action,
    completed: true,
    processedAt: new Date().toISOString()
  };
};

export const anotherTaskHandler = async (data) => {
  // Otra tarea...
  return { /* resultado */ };
};
```

### Paso 2: Registrar en el worker

```javascript
// src/workers/notificationWorkerModular.js
import * as myHandlers from './handlers/myHandlers.js';

const TASK_HANDLERS = {
  // ... handlers existentes
  'MY_CUSTOM_TASK': myHandlers.myCustomTaskHandler,
  'ANOTHER_TASK': myHandlers.anotherTaskHandler
};
```

---

## 🎯 Ejemplo Real: Agregar Procesamiento de Videos

### 1. Crear handler específico

```javascript
// src/workers/handlers/videoHandlers.js

/**
 * Procesar video: comprimir, generar thumbnail, etc.
 */
export const processVideoHandler = async (data) => {
  const { videoUrl, quality, generateThumbnail } = data;
  
  // Simular procesamiento pesado
  console.log(`Processing video: ${videoUrl} at quality ${quality}`);
  
  // Aquí iría la lógica real con FFmpeg, etc.
  await new Promise(resolve => setTimeout(resolve, 2000)); // Simular trabajo
  
  return {
    originalUrl: videoUrl,
    processedUrl: `/videos/processed/${Date.now()}.mp4`,
    thumbnailUrl: generateThumbnail ? `/thumbnails/${Date.now()}.jpg` : null,
    quality,
    size: '5.2MB',
    duration: '120s',
    processedAt: new Date().toISOString()
  };
};

/**
 * Generar subtítulos automáticos
 */
export const generateSubtitlesHandler = async (data) => {
  const { videoUrl, language } = data;
  
  // Lógica de generación de subtítulos
  
  return {
    videoUrl,
    subtitlesUrl: `/subtitles/${Date.now()}.srt`,
    language,
    processedAt: new Date().toISOString()
  };
};
```

### 2. Actualizar el worker

```javascript
// src/workers/notificationWorkerModular.js
import * as videoHandlers from './handlers/videoHandlers.js';

const TASK_HANDLERS = {
  // ... existentes
  'PROCESS_VIDEO': videoHandlers.processVideoHandler,
  'GENERATE_SUBTITLES': videoHandlers.generateSubtitlesHandler
};
```

### 3. Crear servicio wrapper (opcional)

```javascript
// src/services/videoService.js
import WorkerPool from '../workers/WorkerPool.js';
import path from 'path';

const workerPath = path.join(__dirname, '../workers/notificationWorkerModular.js');
const videoWorkerPool = new WorkerPool(workerPath, 2); // 2 workers para video

export const processVideoAsync = async (videoUrl, quality, generateThumbnail = true) => {
  return await videoWorkerPool.runTask({
    type: 'PROCESS_VIDEO',
    data: { videoUrl, quality, generateThumbnail }
  });
};

export const generateSubtitlesAsync = async (videoUrl, language = 'es') => {
  return await videoWorkerPool.runTask({
    type: 'GENERATE_SUBTITLES',
    data: { videoUrl, language }
  });
};
```

### 4. Usar en controller

```javascript
// src/Controllers/videoController.js
import { processVideoAsync } from '../services/videoService.js';

export const uploadVideo = async (req, res) => {
  const { videoUrl, quality } = req.body;
  
  // Responder inmediatamente
  res.status(202).json({
    message: 'Video procesándose en segundo plano',
    status: 'processing'
  });
  
  // Procesar en background
  try {
    const result = await processVideoAsync(videoUrl, quality);
    
    // Notificar al usuario cuando termine
    req.io.to(`user_${req.user.id}`).emit('video_processed', result);
    
    console.log('Video procesado:', result);
  } catch (error) {
    console.error('Error procesando video:', error);
  }
};
```

---

## ✨ Ventajas del Sistema

### 1. **Sin modificar el switch**
- Solo agregas funciones y las registras
- Código más limpio y mantenible

### 2. **Fácil testing**
```javascript
// Probar handler individualmente
import { processVideoHandler } from './handlers/videoHandlers.js';

const result = await processVideoHandler({
  videoUrl: 'test.mp4',
  quality: 'high',
  generateThumbnail: true
});

console.log(result);
```

### 3. **Organización por dominio**
```
handlers/
├── notifications/     # Todo relacionado con notificaciones
├── reports/          # Generación de reportes
├── analytics/        # Procesamiento de datos
├── media/           # Video, imágenes, audio
└── data/            # Exportaciones, limpiezas
```

### 4. **Hot-reload en desarrollo**
- Cambias un handler y se recarga automáticamente
- No necesitas reiniciar el worker pool completo

---

## 🔍 Debugging

```javascript
// Agregar logging a un handler
export const myTaskHandler = async (data) => {
  console.log('[WORKER] Starting myTask with data:', data);
  
  try {
    const result = await heavyOperation(data);
    console.log('[WORKER] Task completed:', result);
    return result;
  } catch (error) {
    console.error('[WORKER] Task failed:', error);
    throw error;
  }
};
```

---

## 📊 Monitoreo

```javascript
// Agregar métricas a tus handlers
const taskMetrics = new Map();

export const trackedHandler = async (data) => {
  const startTime = Date.now();
  const taskId = `task_${Date.now()}`;
  
  try {
    const result = await processTask(data);
    
    taskMetrics.set(taskId, {
      duration: Date.now() - startTime,
      status: 'success',
      timestamp: new Date()
    });
    
    return result;
  } catch (error) {
    taskMetrics.set(taskId, {
      duration: Date.now() - startTime,
      status: 'error',
      error: error.message,
      timestamp: new Date()
    });
    throw error;
  }
};

// Endpoint para ver métricas
export const getTaskMetrics = () => Array.from(taskMetrics.values());
```

---

## 🚀 Best Practices

1. **Handlers deben ser funciones puras**
   - No modificar estado global
   - Recibir todo por parámetros
   - Retornar siempre un objeto

2. **Validación de datos**
```javascript
export const myHandler = async (data) => {
  if (!data.requiredParam) {
    throw new Error('requiredParam is required');
  }
  // ... continuar
};
```

3. **Timeouts**
```javascript
const withTimeout = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), ms)
    )
  ]);
};

export const myHandler = async (data) => {
  return await withTimeout(
    heavyOperation(data),
    30000 // 30 segundos
  );
};
```

4. **Retry logic**
```javascript
const retry = async (fn, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
};

export const myHandler = async (data) => {
  return await retry(() => unstableOperation(data));
};
```
