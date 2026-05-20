import { supabase } from '../DAO/connection.js';
import logger from '../logger.js';

let connected = false;
let retryInterval = null;
const RETRY_MS = 10_000; // reintentar cada 10 segundos

let _onDown = null;
let _onUp = null;

/**
 * Registra callbacks que se invocan al perder/recuperar la conexion.
 * @param {Function} onDown - Se llama cuando la DB deja de responder
 * @param {Function} onUp   - Se llama cuando la DB se recupera
 */
export function registrarCallbacksPausa(onDown, onUp) {
  _onDown = onDown;
  _onUp = onUp;
}

async function ping() {
  try {
    const { error } = await supabase.from('appUsers').select('id').limit(1);
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

function startRetry() {
  if (retryInterval) return;
  if (_onDown) _onDown();
  retryInterval = setInterval(async () => {
    const ok = await ping();
    if (ok) {
      connected = true;
      logger.info('Base de datos reconectada. Las peticiones se reanudan con normalidad.');
      if (_onUp) _onUp();
      clearInterval(retryInterval);
      retryInterval = null;
    }
  }, RETRY_MS);
}

/**
 * Llama a esto al arrancar el servidor.
 * Hace ping a la DB; si falla, activa el bloqueo de peticiones y
 * reintenta en background hasta recuperar la conexión.
 */
export async function initDbHealth() {
  connected = await ping();
  if (connected) {
    logger.info('Conexión a la base de datos: OK');
  } else {
    logger.error('No se pudo conectar a la base de datos. Las peticiones seran bloqueadas hasta restaurar la conexion. Reintentando cada 10s...');
    startRetry();
  }
  return connected;
}

/** Devuelve true si la DB está disponible en este momento */
export const isDbConnected = () => connected;
