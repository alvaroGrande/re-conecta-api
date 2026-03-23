import logger from "../logger.js";
import { supabase } from "../DAO/connection.js";

// Umbral para considerar una query como lenta (en ms)
const QUERY_LENTA_THRESHOLD = 500;

/**
 * Guardar log de query en la base de datos
 */
const guardarLogQuery = async (nombreQuery, duracionMs, esLenta) => {
  try {
    // Evitar recursión: no guardar logs de queries que son para guardar logs
    if (nombreQuery.includes('query_logs') || nombreQuery.includes('guardarLogQuery')) {
      return;
    }

    await supabase
      .from('query_logs')
      .insert({
        nombre_query: nombreQuery,
        duracion_ms: duracionMs,
        es_lenta: esLenta,
        fecha_ejecucion: new Date().toISOString()
      });
  } catch (error) {
    // No fallar si no se puede guardar el log
    logger.debug(`Error guardando log de query: ${error.message}`);
  }
};

/**
 * Helper para ejecutar queries con logging de tiempo
 * @param {string} queryName - Nombre de la query para el log
 * @param {Function} queryFn - Función que ejecuta la query
 * @param {Object} thresholds - Umbrales en ms para clasificar queries
 * @returns {Promise} Resultado de la query
 */
export const executeWithTiming = async (queryName, queryFn, thresholds = {}) => {
  const {
    normal = 250,      // Query normal: < 250ms
    lenta = 600,       // Query lenta: 250-600ms
    muyLenta = 1200,   // Query muy lenta: 600-1200ms
    extrema = 2000     // Query extremadamente lenta: 1200-2000ms, >2000ms crítica
  } = thresholds;
  
  const startTime = Date.now();
  
  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;
    
    // Guardar log en base de datos si es lenta
    if (duration >= QUERY_LENTA_THRESHOLD) {
      await guardarLogQuery(queryName, duration, true);
    } else if (Math.random() < 0.1) {
      // Guardar 10% de queries normales para estadísticas
      await guardarLogQuery(queryName, duration, false);
    }
    
    if (duration > extrema) {
      logger.error(`[!!!] QUERY CRITICA [${queryName}]: ${duration}ms - REVISAR URGENTE`);
    } else if (duration > muyLenta) {
      logger.warn(`[!!] QUERY EXTREMADAMENTE LENTA [${queryName}]: ${duration}ms`);
    } else if (duration > lenta) {
      logger.warn(`[!] QUERY MUY LENTA [${queryName}]: ${duration}ms`);
    } else if (duration > normal) {
      logger.info(`[~] QUERY LENTA [${queryName}]: ${duration}ms`);
    } else {
      logger.debug(`[OK] [${queryName}]: ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`[X] ERROR [${queryName}] después de ${duration}ms: ${error.message}`);
    throw error;
  }
};
