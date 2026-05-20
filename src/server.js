import { createServer } from "http";
import { createRequire } from "module";
import logger from "./logger.js";
import app, { setIO } from "./app.js";
import { setupSocketIO } from "./config/socketIO.js";
import memoryCache from "./utils/memoryCache.js";
import { initDbHealth } from "./utils/dbHealth.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const PORT = process.env.PORT || 3000;
logger.info('==================================================');
logger.info(`API VERSION: v${pkg.version}`);
logger.info(`Node VERSION: ${process.version}`);
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

// Exportar io para que cluster.js pueda pasarlo al scheduler
export const getIO = () => io;

// Iniciar servidor (las tareas programadas se inicializan en cluster.js)
httpServer.listen(PORT, async () => {
  logger.info(` Server running on http://localhost:${PORT}`);
  logger.info(` WebSocket disponible para notificaciones en tiempo real`);

  // Verificar conexión a la base de datos
  await initDbHealth();
  
  // Monitorear tamaño de caché cada minuto
  setInterval(() => {
    const stats = memoryCache.stats();
    logger.info(`Cache Stats - Keys: ${stats.keys}, Size: ${stats.size} bytes, Hits: ${stats.hits}, Misses: ${stats.misses}`);
  }, 30 * 1000); // 30 segundos
});
