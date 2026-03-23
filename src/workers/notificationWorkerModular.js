/**
 * Versión modular del worker usando handlers externos
 * Fácil de extender sin modificar el archivo principal
 */
import { parentPort } from 'worker_threads';
import * as handlers from './handlers/taskHandlers.js';

// Mapa de tipos a handlers
const TASK_HANDLERS = {
  'SEND_BULK_NOTIFICATIONS': handlers.bulkNotificationsHandler,
  'PROCESS_ANALYTICS': handlers.analyticsHandler,
  'GENERATE_REPORT': handlers.reportHandler,
  'PROCESS_IMAGE': handlers.imageProcessingHandler,
  'GENERATE_USER_STATS': handlers.userStatsHandler,
  'EXPORT_DATA': handlers.dataExportHandler,
  'CLEANUP_DATA': handlers.dataCleanupHandler
};

/**
 * Obtener lista de tipos disponibles
 */
const getAvailableTypes = () => Object.keys(TASK_HANDLERS);

/**
 * Ejecutar tarea
 */
const executeTask = async (type, data) => {
  const handler = TASK_HANDLERS[type];
  
  if (!handler) {
    throw new Error(
      `Unknown task type: ${type}. Available types: ${getAvailableTypes().join(', ')}`
    );
  }

  return await handler(data);
};

// Listener principal
parentPort.on('message', async (task) => {
  const startTime = Date.now();
  
  try {
    const { type, data, taskId } = task;

    const result = await executeTask(type, data);
    
    parentPort.postMessage({ 
      success: true, 
      result,
      type,
      taskId,
      executionTime: Date.now() - startTime
    });

  } catch (error) {
    parentPort.postMessage({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      taskId: task.taskId,
      executionTime: Date.now() - startTime
    });
  }
});

// Health check
parentPort.on('ping', () => {
  parentPort.postMessage({ 
    pong: true, 
    availableTypes: getAvailableTypes(),
    memoryUsage: process.memoryUsage()
  });
});
