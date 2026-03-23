import logger from '../logger.js';

/**
 * Caché en memoria simple con TTL
 * Ideal para datos que no cambian frecuentemente
 */
class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  /**
   * Obtener valor del caché
   * @param {string} key - Clave del caché
   * @returns {any|null} - Valor cacheado o null si no existe o expiró
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Si no tiene expiración (Infinity) o no expiró, devolver el valor
    if (item.expires === Infinity || Date.now() <= item.expires) {
      logger.debug(`Cache HIT: ${key}`);
      return item.value;
    }

    // Si expiró, eliminar
    this.delete(key);
    return null;
  }

  /**
   * Guardar valor en caché
   * @param {string} key - Clave del caché
   * @param {any} value - Valor a cachear
   * @param {number|null} ttl - Tiempo de vida en milisegundos (default: 5 min, null = indefinido)
   */
  set(key, value, ttl = 5 * 60 * 1000) {
    // Si TTL es null o Infinity, cachear indefinidamente
    const isIndefinite = ttl === null || ttl === Infinity;
    const expires = isIndefinite ? Infinity : Date.now() + ttl;

    // Guardar en caché
    this.cache.set(key, { value, expires });

    // Limpiar timer anterior si existe
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }

    // Solo configurar auto-limpieza si no es indefinido
    if (!isIndefinite) {
      const timer = setTimeout(() => {
        this.delete(key);
      }, ttl);

      this.timers.set(key, timer);
    }

    logger.debug(`Cached: ${key} (TTL: ${isIndefinite ? 'indefinido' : ttl + 'ms'})`);
  }

  /**
   * Eliminar valor del caché
   * @param {string} key - Clave a eliminar
   */
  delete(key) {
    this.cache.delete(key);
    
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }

    logger.debug(`Cache deleted: ${key}`);
  }

  /**
   * Limpiar todo el caché
   */
  clear() {
    // Limpiar todos los timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }

    this.cache.clear();
    this.timers.clear();

    logger.info('Cache cleared completely');
  }

  /**
   * Obtener tamaño del caché
   */
  size() {
    return this.cache.size;
  }

  /**
   * Obtener todas las claves
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Verificar si existe una clave
   */
  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    
    // Si no tiene expiración o no expiró, existe
    if (item.expires === Infinity || Date.now() <= item.expires) {
      return true;
    }
    
    // Si expiró, eliminar y devolver false
    this.delete(key);
    return false;
  }

  /**
   * Calcular tamaño aproximado en bytes de un valor
   */
  _calculateSize(value) {
    const str = JSON.stringify(value);
    // Cada caracter en JavaScript es 2 bytes (UTF-16)
    return str.length * 2;
  }

  /**
   * Obtener estadísticas del caché
   */
  stats() {
    let totalBytes = 0;
    
    // Calcular tamaño total de todos los valores en caché
    for (const [key, item] of this.cache.entries()) {
      totalBytes += this._calculateSize(item.value);
      totalBytes += key.length * 2; // Tamaño de la clave
    }
    
    // Convertir a formato legible
    let sizeFormatted;
    if (totalBytes < 1024) {
      sizeFormatted = `${totalBytes} B`;
    } else if (totalBytes < 1024 * 1024) {
      sizeFormatted = `${(totalBytes / 1024).toFixed(2)} KB`;
    } else {
      sizeFormatted = `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    
    return {
      entries: this.cache.size,
      bytes: totalBytes,
      size: sizeFormatted,
      keys: this.keys()
    };
  }

  /**
   * Obtener detalles de todas las entradas del caché
   * @returns {Array} Array de objetos con información de cada entrada
   */
  getDetails() {
    const details = [];
    const now = Date.now();
    
    for (const [key, item] of this.cache.entries()) {
      const itemBytes = this._calculateSize(item.value) + key.length * 2;
      const isIndefinite = item.expires === Infinity;
      
      let itemSize;
      if (itemBytes < 1024) {
        itemSize = `${itemBytes} B`;
      } else if (itemBytes < 1024 * 1024) {
        itemSize = `${(itemBytes / 1024).toFixed(2)} KB`;
      } else {
        itemSize = `${(itemBytes / (1024 * 1024)).toFixed(2)} MB`;
      }
      
      details.push({
        key,
        size: itemSize,
        bytes: itemBytes,
        expiresIn: isIndefinite ? -1 : Math.ceil(Math.max(0, item.expires - now) / 1000), // -1 = indefinido
        expiresAt: isIndefinite ? null : new Date(item.expires).toISOString(),
        createdAt: null // No podemos calcular el createdAt sin almacenarlo explícitamente
      });
    }
    
    // Ordenar por tamaño (mayor a menor)
    return details.sort((a, b) => b.bytes - a.bytes);
  }
}

// Instancia única del caché
export const memoryCache = new MemoryCache();

/**
 * Función helper para usar caché con async functions
 * @param {string} key - Clave del caché
 * @param {Function} fetchFunction - Función async que obtiene los datos
 * @param {number} ttl - TTL en milisegundos (default: 5 min)
 * @returns {Object} { data, fromCache: boolean }
 */
export const getCached = async (key, fetchFunction, ttl = 5 * 60 * 1000) => {
  // Intentar obtener del caché
  const cached = memoryCache.get(key);
  if (cached !== null) {
    logger.info(`[CACHE HIT] Datos obtenidos del cache: ${key}`);
    return { data: cached, fromCache: true };
  }

  // Si no está en caché, ejecutar función y cachear resultado
  logger.info(`[CACHE MISS] Consultando base de datos: ${key}`);
  const startTime = Date.now();
  const result = await fetchFunction();
  const duration = Date.now() - startTime;
  
  memoryCache.set(key, result, ttl);
  logger.info(`[CACHED] Datos guardados en cache (${duration}ms): ${key}`);
  
  return { data: result, fromCache: false };
};

export default memoryCache;
