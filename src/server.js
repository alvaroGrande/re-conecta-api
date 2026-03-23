import { createServer } from "http";
import logger from "./logger.js";
import app, { setIO } from "./app.js";
import { setupSocketIO } from "./config/socketIO.js";
import memoryCache from "./utils/memoryCache.js";

const PORT = process.env.PORT || 3000;

// Mostrar configuración de workers al inicio
logger.info('==================================================');
logger.info('WORKER CONFIGURATION');
logger.info('==================================================');
logger.info(`Cluster Mode: ${process.env.USE_CLUSTER === 'true' ? 'ENABLED' : 'DISABLED'}`);
if (process.env.USE_CLUSTER === 'true') {
  const clusterWorkers = process.env.CLUSTER_WORKERS || 'auto';
  logger.info(`Cluster Workers: ${clusterWorkers}`);
}
logger.info(`Worker Threads: ${process.env.USE_WORKER_THREADS !== 'false' ? 'ENABLED' : 'DISABLED'}`);
if (process.env.USE_WORKER_THREADS !== 'false') {
  const threadWorkers = process.env.WORKER_THREADS || '4';
  logger.info(`Thread Pool Size: ${threadWorkers} workers`);
}
logger.info('==================================================\n');

// Crear servidor HTTP
const httpServer = createServer(app);

// Configurar Socket.IO
const io = setupSocketIO(httpServer);

// Inyectar io en app (el middleware ya está en app.js)
setIO(io);

// Iniciar servidor (las tareas programadas se inicializan en cluster.js)
httpServer.listen(PORT, () => {
  logger.info(` Server running on http://localhost:${PORT}`);
  logger.info(` WebSocket disponible para notificaciones en tiempo real`);
  
  // Monitorear tamaño de caché cada minuto
  setInterval(() => {
    const stats = memoryCache.stats();
  }, 60 * 1000); // 60 segundos
});
