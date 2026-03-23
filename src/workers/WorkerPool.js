/**
 * Worker Pool para tareas pesadas
 * Usa Worker Threads de Node.js para procesamiento paralelo
 */
import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import logger from '../logger.js';

class WorkerPool extends EventEmitter {
  constructor(workerPath, numWorkers = null) {
    super();
    this.workerPath = workerPath;
    
    // Usar variable de entorno o valor por defecto
    const defaultWorkers = parseInt(process.env.WORKER_THREADS || '4');
    this.numWorkers = numWorkers || defaultWorkers;
    
    this.workers = [];
    this.freeWorkers = [];
    this.taskQueue = [];
    
    this.initializeWorkers();
  }

  initializeWorkers() {
    logger.info(`🔧 Initializing Worker Thread Pool with ${this.numWorkers} workers`);
    
    for (let i = 0; i < this.numWorkers; i++) {
      this.createWorker(i + 1);
    }
    
    logger.info(`Worker Thread Pool ready with ${this.numWorkers} workers`);
  }

  createWorker(workerId) {
    const worker = new Worker(this.workerPath);
    worker.workerId = workerId;
    
    worker.on('message', (result) => {
      this.emit('taskComplete', result);
      this.freeWorkers.push(worker);
      this.processQueue();
    });

    worker.on('error', (error) => {
      logger.error(`Worker #${workerId} error:`, error);
      this.emit('error', error);
    });

    worker.on('exit', (code) => {
      logger.warn(`Worker #${workerId} (PID: ${worker.threadId}) exited with code ${code}`);
      this.workers = this.workers.filter(w => w !== worker);
      this.freeWorkers = this.freeWorkers.filter(w => w !== worker);
      
      // Reemplazar worker muerto
      if (this.workers.length < this.numWorkers) {
        logger.info(`♻️ Replacing dead worker #${workerId}`);
        this.createWorker(workerId);
      }
    });

    this.workers.push(worker);
    this.freeWorkers.push(worker);
    
    logger.debug(`Worker #${workerId} created and added to pool`);
  }

  async runTask(taskData) {
    return new Promise((resolve, reject) => {
      const task = {
        data: taskData,
        resolve,
        reject
      };

      if (this.freeWorkers.length > 0) {
        this.executeTask(task);
      } else {
        this.taskQueue.push(task);
      }
    });
  }

  executeTask(task) {
    const worker = this.freeWorkers.pop();
    
    const messageHandler = (result) => {
      worker.removeListener('message', messageHandler);
      worker.removeListener('error', errorHandler);
      
      this.freeWorkers.push(worker);
      task.resolve(result);
      this.processQueue();
    };

    const errorHandler = (error) => {
      worker.removeListener('message', messageHandler);
      worker.removeListener('error', errorHandler);
      
      this.freeWorkers.push(worker);
      task.reject(error);
      this.processQueue();
    };

    worker.once('message', messageHandler);
    worker.once('error', errorHandler);
    worker.postMessage(task.data);
  }

  processQueue() {
    while (this.freeWorkers.length > 0 && this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      this.executeTask(task);
    }
  }

  async terminate() {
    const promises = this.workers.map(worker => 
      worker.terminate()
    );
    await Promise.all(promises);
    logger.info('🛑 All workers terminated');
  }
}

export default WorkerPool;
