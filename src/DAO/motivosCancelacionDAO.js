import { supabase } from './connection.js';
import { executeWithTiming } from '../utils/queryLogger.js';
import memoryCache from '../utils/memoryCache.js';
import logger from '../logger.js';

const CACHE_KEY = 'motivos_cancelacion';

/**
 * Devuelve los motivos de cancelación activos, ordenados.
 * Los resultados se cachean indefinidamente ya que el catálogo
 * apenas cambia; se invalida manualmente tras cualquier mutación.
 */
export const obtenerMotivosCancelacion = async () => {
  return executeWithTiming('obtenerMotivosCancelacion', async () => {
    const cached = memoryCache.get(CACHE_KEY);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('motivos_cancelacion')
      .select('id, nombre, descripcion')
      .eq('activo', true)
      .order('orden', { ascending: true });

    if (error) throw new Error('Error al obtener motivos de cancelación: ' + error.message);

    // TTL indefinido: este catálogo rara vez cambia
    memoryCache.set(CACHE_KEY, data, null);
    logger.debug('Cache SET: motivos_cancelacion');

    return data;
  });
};

/** Invalida la caché (llamar tras insertar/actualizar/borrar motivos) */
export const invalidarCacheMotivos = () => {
  memoryCache.delete(CACHE_KEY);
  logger.debug('Cache invalidado: motivos_cancelacion');
};
