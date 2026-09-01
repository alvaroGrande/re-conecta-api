import { memoryCache as memoryCacheInstance } from './memoryCache.js';
import RedisCache from './redisCache.js';
import logger from '../logger.js';

/**
 * Adaptador unificado de caché.
 *
 * Selecciona el driver según la variable de entorno CACHE_DRIVER:
 *   CACHE_DRIVER=memory  → caché en memoria (por defecto)
 *   CACHE_DRIVER=redis   → Redis via ioredis (requiere REDIS_URL)
 *
 * Todos los métodos del objeto exportado son compatibles con await aunque el
 * driver de memoria sea síncrono: `await syncValue` en JS devuelve el valor sin error.
 */
const driver = (process.env.CACHE_DRIVER || 'memory').toLowerCase();

let cacheInstance;

if (driver === 'redis') {
  cacheInstance = new RedisCache();
  logger.debug('[CACHE] Driver: Redis');
} else {
  cacheInstance = memoryCacheInstance;
  logger.debug('[CACHE] Driver: Memoria');
}

/** Instancia del caché activo */
export const cache = cacheInstance;

/**
 * Alias de retrocompatibilidad: los módulos que importaban `memoryCache`
 * siguen funcionando sin cambiar el nombre de la variable.
 */
export const memoryCache = cacheInstance;

/** Export por defecto para `import cache from './cache.js'` */
export default cacheInstance;

/**
 * Helper para usar el caché con funciones async (patrón cache-aside).
 * Compatible con ambos drivers.
 *
 * @param {string} key - Clave del caché
 * @param {Function} fetchFunction - Función async que obtiene los datos si no están en caché
 * @param {number} ttl - TTL en milisegundos (default: 5 min)
 * @returns {Promise<{ data: any, fromCache: boolean }>}
 */
export const getCached = async (key, fetchFunction, ttl = 5 * 60 * 1000) => {
  const cached = await cacheInstance.get(key);
  if (cached !== null) {
    logger.info(`[CACHE HIT] Datos obtenidos del cache: ${key}`);
    return { data: cached, fromCache: true };
  }

  logger.info(`[CACHE MISS] Consultando base de datos: ${key}`);
  const startTime = Date.now();
  const result = await fetchFunction();
  const duration = Date.now() - startTime;

  await cacheInstance.set(key, result, ttl);
  logger.info(`[CACHED] Datos guardados en cache (${duration}ms): ${key}`);

  return { data: result, fromCache: false };
};

/** Driver activo como string ('memory' | 'redis') */
export const cacheDriver = driver;
