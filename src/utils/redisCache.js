import Redis from 'ioredis';
import logger from '../logger.js';

/**
 * Adaptador de caché usando Redis (ioredis).
 * Implementa la misma interfaz que MemoryCache para ser intercambiable.
 * Los valores se serializan con JSON.stringify/parse.
 * El TTL se pasa en milisegundos (igual que MemoryCache).
 */
class RedisCache {
  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        if (times > 10) return null; // dejar de reintentar tras 10 intentos
        return Math.min(times * 200, 2000);
      },
    });

    this.client.on('connect', () => logger.info('[REDIS] Conectado'));
    this.client.on('ready', () => logger.info('[REDIS] Listo para recibir comandos'));
    this.client.on('error', (err) => logger.error({ err }, '[REDIS] Error de conexión'));
    this.client.on('reconnecting', () => logger.warn('[REDIS] Reconectando...'));
    this.client.on('close', () => logger.warn('[REDIS] Conexión cerrada'));
  }

  /**
   * Obtener valor del caché
   * @param {string} key
   * @returns {Promise<any|null>}
   */
  async get(key) {
    const raw = await this.client.get(key);
    if (raw === null) {
      logger.debug(`Cache MISS: ${key}`);
      return null;
    }
    logger.debug(`Cache HIT: ${key}`);
    return JSON.parse(raw);
  }

  /**
   * Guardar valor en caché
   * @param {string} key
   * @param {any} value
   * @param {number|null} ttl - TTL en milisegundos (null o Infinity = indefinido)
   */
  async set(key, value, ttl = 5 * 60 * 1000) {
    const isIndefinite = ttl === null || ttl === Infinity;
    const serialized = JSON.stringify(value);

    if (isIndefinite) {
      await this.client.set(key, serialized);
    } else {
      // PX = expiración en milisegundos
      await this.client.set(key, serialized, 'PX', ttl);
    }

    logger.debug(`Cached: ${key} (TTL: ${isIndefinite ? 'indefinido' : ttl + 'ms'})`);
  }

  /**
   * Eliminar valor del caché
   * @param {string} key
   */
  async delete(key) {
    await this.client.del(key);
    logger.debug(`Cache deleted: ${key}`);
  }

  /**
   * Limpiar todo el caché (FLUSHDB — solo afecta a la DB actual)
   */
  async clear() {
    await this.client.flushDb();
    logger.info('[REDIS] Cache cleared completely (FLUSHDB)');
  }

  /**
   * Obtener número de entradas en el caché
   * @returns {Promise<number>}
   */
  async size() {
    return this.client.dbSize();
  }

  /**
   * Obtener todas las claves del caché
   * @returns {Promise<string[]>}
   */
  async keys() {
    return this.client.keys('*');
  }

  /**
   * Verificar si existe una clave (y no ha expirado)
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async has(key) {
    const exists = await this.client.exists(key);
    return exists === 1;
  }

  /**
   * Obtener estadísticas del caché
   * @returns {Promise<Object>}
   */
  async stats() {
    const [entries, allKeys] = await Promise.all([
      this.client.dbSize(),
      this.client.keys('*'),
    ]);

    return {
      entries,
      bytes: 0, // No disponible directamente en Redis sin escaneo completo
      size: `${entries} claves`,
      keys: allKeys,
    };
  }

  /**
   * Obtener detalles de todas las entradas del caché
   * @returns {Promise<Array>}
   */
  async getDetails() {
    const allKeys = await this.client.keys('*');
    if (!allKeys.length) return [];

    const details = await Promise.all(
      allKeys.map(async (key) => {
        const [raw, pttl] = await Promise.all([
          this.client.get(key),
          this.client.pttl(key),
        ]);

        const bytes = raw ? Buffer.byteLength(raw, 'utf8') : 0;
        let itemSize;
        if (bytes < 1024) {
          itemSize = `${bytes} B`;
        } else if (bytes < 1024 * 1024) {
          itemSize = `${(bytes / 1024).toFixed(2)} KB`;
        } else {
          itemSize = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        }

        // pttl: -1 = sin TTL (indefinido), -2 = clave no existe, >=0 = TTL restante en ms
        return {
          key,
          size: itemSize,
          bytes,
          expiresIn: pttl === -1 ? -1 : Math.ceil(Math.max(0, pttl) / 1000),
          expiresAt: pttl > 0 ? new Date(Date.now() + pttl).toISOString() : null,
          createdAt: null,
        };
      })
    );

    return details.sort((a, b) => b.bytes - a.bytes);
  }
}

export default RedisCache;
