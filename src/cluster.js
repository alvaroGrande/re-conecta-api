import cluster from 'cluster';
import os from 'os';
import logger from './logger.js';
import { inicializarTareasProgramadas } from './services/tasksScheduler.js';

const numCPUs = os.cpus().length;
const useCluster = process.env.USE_CLUSTER === 'true';
const workersCount = process.env.CLUSTER_WORKERS 
  ? parseInt(process.env.CLUSTER_WORKERS) 
  : Math.max(2, numCPUs - 1); // Dejar 1 CPU libre

if (!useCluster) {
  // Modo single process
  logger.info('Running in SINGLE PROCESS mode (USE_CLUSTER=false)');
  await import('./server.js');
  // Inicializar tareas programadas en modo single process
  inicializarTareasProgramadas();
} else if (cluster.isPrimary) {
  logger.info(`Master process ${process.pid} is running`);
  logger.info(`System has ${numCPUs} CPU cores available`);
  logger.info(`Starting ${workersCount} worker processes`);

  // Fork workers
  for (let i = 0; i < workersCount; i++) {
    const worker = cluster.fork();
    logger.info(`Worker #${i + 1} (PID: ${worker.process.pid}) started`);
  }

  logger.info(`Cluster initialized with ${workersCount} workers`);

  // Inicializar tareas programadas SOLO en el proceso primario
  logger.info('Initializing scheduled tasks in primary process...');
  inicializarTareasProgramadas();

  // Manejar workers que mueren
  cluster.on('exit', (worker, code, signal) => {
    logger.error(`Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
    const newWorker = cluster.fork();
    logger.info(`New worker ${newWorker.process.pid} started as replacement`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
    
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  });

} else {
  // Worker process - import and start the server
  await import('./server.js');
  logger.info(`Worker ${process.pid} is ready to handle requests`);
}
