import * as tasksDAO from '../DAO/tasksDAO.js';
import { ejecutarTareaManual } from '../services/tasksScheduler.js';
import logger from '../logger.js';
import { memoryCache } from '../utils/memoryCache.js';

/**
 * Obtener últimas ejecuciones de tareas programadas
 */
export const getUltimasEjecuciones = async (req, res, next) => {
  try {
    const limite = parseInt(req.query.limite) || 20;
    const startTime = Date.now();
    const { data: ejecuciones, fromCache } = await tasksDAO.obtenerUltimasEjecuciones(limite);
    const duration = Date.now() - startTime;
    
    // Headers con información real del caché
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.set('X-Response-Time', `${duration}ms`);
    
    logger.info(`getUltimasEjecuciones respondió en ${duration}ms (${fromCache ? 'CACHE' : 'DB'})`);
    
    res.json(ejecuciones);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener resumen de todas las tareas
 */
export const getResumenTareas = async (req, res, next) => {
  try {
    const resumen = await tasksDAO.obtenerResumenTareas();
    
    res.json(resumen);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener historial de una tarea específica
 */
export const getHistorialTarea = async (req, res, next) => {
  try {
    const { nombreTarea } = req.params;
    const limite = parseInt(req.query.limite) || 50;
    
    const historial = await tasksDAO.obtenerHistorialTarea(nombreTarea, limite);
    
    res.json(historial);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener estadísticas de tareas
 */
export const getEstadisticasTareas = async (req, res, next) => {
  try {
    const estadisticas = await tasksDAO.obtenerEstadisticasTareas();
    
    res.json(estadisticas);
  } catch (error) {
    next(error);
  }
};

/**
 * Ejecutar tarea manualmente (solo admin)
 */
export const ejecutarTareaManualmente = async (req, res, next) => {
  try {
    const { nombreTarea } = req.params;
    
    // Solo permitir a administradores
    if (req.user.rol !== 1) {
      return res.status(403).json({ 
        message: 'Solo administradores pueden ejecutar tareas manualmente' 
      });
    }

    // Ejecutar en segundo plano
    ejecutarTareaManual(nombreTarea)
      .then(() => {
        logger.info(`Tarea ${nombreTarea} ejecutada manualmente con éxito`);
      })
      .catch((error) => {
        logger.error({ error }, `Error al ejecutar tarea ${nombreTarea}`);
      });

    res.json({ 
      success: true, 
      message: `Tarea "${nombreTarea}" iniciada. Revisa los logs para ver el resultado.` 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener estadísticas de actividades
 */
export const getEstadisticasActividad = async (req, res, next) => {
  try {
    const estadisticas = await tasksDAO.obtenerEstadisticasActividad();
    
    res.json(estadisticas);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener estadísticas de queries
 */
export const getEstadisticasQueries = async (req, res, next) => {
  try {
    const startTime = Date.now();
    const { data: estadisticas, fromCache } = await tasksDAO.obtenerEstadisticasQueries();
    const duration = Date.now() - startTime;
    
    // Headers con información real del caché
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.set('X-Response-Time', `${duration}ms`);
    
    logger.info(`⏱️ getEstadisticasQueries respondió en ${duration}ms (${fromCache ? 'CACHE' : 'DB'})`);
    
    res.json(estadisticas);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener queries más lentas
 */
export const getQueriesMasLentas = async (req, res, next) => {
  try {
    const limite = parseInt(req.query.limite) || 20;
    const startTime = Date.now();
    const { data: queries, fromCache } = await tasksDAO.obtenerQueriesMasLentas(limite);
    const duration = Date.now() - startTime;
    
    // Headers con información real del caché
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.set('X-Response-Time', `${duration}ms`);
    
    logger.info(`⏱️ getQueriesMasLentas respondió en ${duration}ms (${fromCache ? 'CACHE' : 'DB'})`);
    
    res.json(queries);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener estadísticas del caché en memoria
 */
export const getCacheStats = async (req, res, next) => {
  try {
    const stats = memoryCache.stats();
    
    res.json({
      enabled: true,
      type: 'memory',
      ...stats,
      ttl: '5 minutos',
      description: 'Caché en memoria para queries lentas'
    });
  } catch (error) {
    next(error);
  }
};
/**
 * Obtener detalles de todas las entradas del caché (solo admin)
 */
export const getCacheDetails = async (req, res, next) => {
  try {
    // Solo permitir a administradores
    if (req.user.rol !== 1) {
      return res.status(403).json({ 
        message: 'Solo administradores pueden ver detalles del caché' 
      });
    }

    const details = memoryCache.getDetails();
    const stats = memoryCache.stats();
    
    res.json({ 
      summary: {
        totalEntries: stats.entries,
        totalSize: stats.size,
        totalBytes: stats.bytes
      },
      entries: details
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener los datos de una entrada específica del caché (solo admin)
 */
export const getCacheEntryData = async (req, res, next) => {
  try {
    const { key } = req.params;
    
    logger.info(`Solicitando datos del caché para la clave: ${key}`);
    
    // Solo permitir a administradores
    if (req.user.rol !== 1) {
      logger.warn(`Usuario ${req.user.id} sin permisos intentó ver datos del caché`);
      return res.status(403).json({ 
        message: 'Solo administradores pueden ver datos del caché' 
      });
    }

    const data = memoryCache.get(key);
    
    if (data === null) {
      logger.warn(`Entrada '${key}' no encontrada en el caché`);
      return res.status(404).json({ 
        success: false,
        message: 'Entrada no encontrada en el caché' 
      });
    }
    
    logger.info(`Datos del caché para '${key}' obtenidos exitosamente`);
    res.json(data);
  } catch (error) {
    logger.error(`Error al obtener datos del caché: ${error.message}`);
    next(error);
  }
};

/**
 * Eliminar una entrada específica del caché (solo admin)
 */
export const deleteCacheEntry = async (req, res, next) => {
  try {
    // Solo permitir a administradores
    if (req.user.rol !== 1) {
      return res.status(403).json({ 
        message: 'Solo administradores pueden eliminar entradas del caché' 
      });
    }

    const { key } = req.params;
    
    if (!memoryCache.has(key)) {
      return res.status(404).json({ 
        success: false,
        message: 'Entrada no encontrada en el caché' 
      });
    }

    memoryCache.delete(key);
    
    logger.info(`Entrada de caché '${key}' eliminada por usuario ${req.user.id}`);
    
    res.json({ 
      success: true, 
      message: `Entrada '${key}' eliminada del caché`,
      key
    });
  } catch (error) {
    next(error);
  }
};
/**
 * Limpiar todo el caché (solo admin)
 */
export const clearCache = async (req, res, next) => {
  try {
    // Solo permitir a administradores
    if (req.user.rol !== 1) {
      return res.status(403).json({ 
        message: 'Solo administradores pueden limpiar el caché' 
      });
    }

    const statsBefore = memoryCache.stats();
    memoryCache.clear();
    
    logger.info(`Caché limpiado manualmente por usuario ${req.user.id}`);
    
    res.json({ 
      success: true, 
      message: 'Caché limpiado correctamente',
      itemsRemoved: statsBefore.size
    });
  } catch (error) {
    next(error);
  }
};
