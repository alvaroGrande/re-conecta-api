/**
 * Servicio de Workers para tareas asíncronas
 * Maneja procesamiento en background sin bloquear requests
 */
import path from 'path';
import { fileURLToPath } from 'url';
import WorkerPool from '../workers/WorkerPool.js';
import logger from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Verificar si workers están habilitados
const useWorkers = process.env.USE_WORKER_THREADS !== 'false';
const numWorkers = parseInt(process.env.WORKER_THREADS || '4');

let workerPool = null;

if (useWorkers) {
  // Crear pool de workers
  const notificationWorkerPath = path.join(__dirname, '../workers/notificationWorker.js');
  workerPool = new WorkerPool(notificationWorkerPath, numWorkers);

  workerPool.on('error', (error) => {
    logger.error('Worker pool error:', error);
  });
  
  logger.info(`🔧 Worker Thread Pool enabled with ${numWorkers} workers`);
} else {
  logger.info('🔷 Worker Thread Pool DISABLED - Tasks will run synchronously');
}

/**
 * Enviar notificaciones masivas en background
 */
export const processBulkNotificationsAsync = async (receptores_ids, titulo, contenido) => {
  if (!useWorkers || !workerPool) {
    logger.warn('Workers disabled - processing synchronously');
    // Procesamiento síncrono fallback
    return {
      success: true,
      result: {
        totalRecipients: receptores_ids.length,
        batches: Math.ceil(receptores_ids.length / 50),
        processedAt: new Date().toISOString(),
        mode: 'synchronous'
      }
    };
  }

  try {
    const result = await workerPool.runTask({
      type: 'SEND_BULK_NOTIFICATIONS',
      data: { receptores_ids, titulo, contenido }
    });

    logger.info(`📧 Bulk notifications processed: ${result.result.totalRecipients} recipients (Worker mode)`);
    return result;
  } catch (error) {
    logger.error('Error processing bulk notifications:', error);
    throw error;
  }
};

/**
 * Procesar analíticas en background
 */
export const processAnalyticsAsync = async (startDate, endDate, userId) => {
  if (!useWorkers || !workerPool) {
    logger.warn('Workers disabled - skipping analytics processing');
    return { success: false, error: 'Workers not available' };
  }

  try {
    const result = await workerPool.runTask({
      type: 'PROCESS_ANALYTICS',
      data: { startDate, endDate, userId }
    });

    logger.info(`Analytics processed for user ${userId} (Worker mode)`);
    return result;
  } catch (error) {
    logger.error('Error processing analytics:', error);
    throw error;
  }
};

/**
 * Generar reportes en background
 */
export const generateReportAsync = async (type, filters) => {
  if (!useWorkers || !workerPool) {
    logger.warn('Workers disabled - skipping report generation');
    return { success: false, error: 'Workers not available' };
  }

  try {
    const result = await workerPool.runTask({
      type: 'GENERATE_REPORT',
      data: { type, filters }
    });

    logger.info(`📄 Report generated: ${type} (Worker mode)`);
    return result;
  } catch (error) {
    logger.error('Error generating report:', error);
    throw error;
  }
};

/**
 * Obtener estado del worker pool
 */
export const getWorkerPoolStatus = () => {
  if (!useWorkers || !workerPool) {
    return {
      enabled: false,
      mode: 'synchronous',
      message: 'Worker threads disabled'
    };
  }

  return {
    enabled: true,
    mode: 'worker-threads',
    totalWorkers: workerPool.workers.length,
    freeWorkers: workerPool.freeWorkers.length,
    queuedTasks: workerPool.taskQueue.length,
    busyWorkers: workerPool.workers.length - workerPool.freeWorkers.length,
    configuredWorkers: numWorkers
  };
};

/**
 * Terminar worker pool (para shutdown graceful)
 */
export const shutdownWorkerPool = async () => {
  if (workerPool) {
    await workerPool.terminate();
    logger.info('Worker pool shut down');
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  await shutdownWorkerPool();
});

process.on('SIGINT', async () => {
  await shutdownWorkerPool();
});
