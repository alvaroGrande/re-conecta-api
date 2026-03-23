import express from 'express';
import logger from '../logger.js';

const router = express.Router();

/**
 * Endpoint para probar comportamiento cuando un worker muere
 * Solo disponible en desarrollo
 */

// Middleware para validar entorno de desarrollo
router.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ 
      error: 'Test endpoints no disponibles en producción' 
    });
  }
  next();
});

/**
 * GET /api/test/worker-info
 * Información del worker actual
 */
router.get('/worker-info', (req, res) => {
  res.json({
    pid: process.pid,
    ppid: process.ppid,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    platform: process.platform,
    nodeVersion: process.version
  });
});

/**
 * POST /api/test/kill-worker
 * Simula muerte abrupta del worker
 */
router.post('/kill-worker', (req, res) => {
  const { method = 'exit', delay = 0 } = req.body;

  logger.warn(`[TEST] Worker ${process.pid} será terminado en ${delay}ms usando método: ${method}`);
  
  // Enviar respuesta antes de morir
  res.json({ 
    message: `Worker ${process.pid} será terminado en ${delay}ms`,
    method,
    timestamp: new Date().toISOString()
  });

  setTimeout(() => {
    switch (method) {
      case 'exit':
        // Muerte limpia con código de salida
        logger.error(`[TEST] Worker ${process.pid} ejecutando process.exit(1)`);
        process.exit(1);
        break;

      case 'uncaughtException':
        // Lanzar error no manejado
        logger.error(`[TEST] Worker ${process.pid} lanzando error no manejado`);
        throw new Error('💥 Error intencional no manejado para testing');

      case 'memoryLeak':
        // Simular memory leak que eventualmente mata el proceso
        logger.error(`[TEST] Worker ${process.pid} simulando memory leak`);
        const leakArray = [];
        const interval = setInterval(() => {
          // Llenar memoria rápidamente
          leakArray.push(new Array(1000000).fill('💣'));
          logger.warn(`[TEST] Memory leak - Array size: ${leakArray.length}`);
        }, 100);
        // No limpiar el interval intencionalmente
        break;

      case 'infiniteLoop':
        // Loop infinito que bloquea el event loop
        logger.error(`[TEST] Worker ${process.pid} entrando en loop infinito`);
        while (true) {
          // Bloquear completamente el worker
          Math.random();
        }
        break;

      case 'asyncError':
        // Error en promesa sin catch
        logger.error(`[TEST] Worker ${process.pid} creando promesa rechazada sin catch`);
        Promise.reject(new Error('💥 Promesa rechazada sin manejo'));
        break;

      default:
        logger.error(`[TEST] Método desconocido: ${method}`);
    }
  }, delay);
});

/**
 * POST /api/test/stress-worker
 * Genera carga CPU intensa en el worker
 */
router.post('/stress-worker', (req, res) => {
  const { duration = 5000, intensity = 'medium' } = req.body;
  
  logger.warn(`[TEST] Worker ${process.pid} iniciando stress test (${intensity}) por ${duration}ms`);
  
  const startTime = Date.now();
  let iterations = 0;

  const stress = () => {
    const now = Date.now();
    if (now - startTime >= duration) {
      logger.info(`[TEST] Stress test completado. Iteraciones: ${iterations}`);
      return;
    }

    // Trabajo CPU-intensive según intensidad
    const workSize = intensity === 'high' ? 100000 : 
                     intensity === 'medium' ? 50000 : 10000;
    
    for (let i = 0; i < workSize; i++) {
      Math.sqrt(Math.random() * 1000000);
    }
    
    iterations++;
    
    // Dar tiempo al event loop según intensidad
    const nextDelay = intensity === 'high' ? 0 : 
                      intensity === 'medium' ? 10 : 50;
    setTimeout(stress, nextDelay);
  };

  stress();

  res.json({
    message: `Stress test iniciado en worker ${process.pid}`,
    duration,
    intensity,
    pid: process.pid
  });
});

/**
 * GET /api/test/health
 * Health check del worker
 */
router.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  res.json({
    status: 'healthy',
    pid: process.pid,
    uptime: process.uptime(),
    memory: {
      rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      external: `${(memUsage.external / 1024 / 1024).toFixed(2)} MB`
    },
    cpu: cpuUsage,
    timestamp: new Date().toISOString()
  });
});

export default router;
