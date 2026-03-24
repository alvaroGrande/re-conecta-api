/**
 * Servicio de recordatorios automáticos.
 *
 * Cada minuto consulta los recordatorios que están a punto de comenzar
 * y envía una notificación push (Socket.IO) + notificación persistente (BD)
 * al usuario propietario del recordatorio.
 *
 * Variables de entorno:
 *  - RECORDATORIO_MINUTOS_ANTES  (default: 15)  — margen de anticipación
 *  - TZ                                          — timezone del servidor (recomendado: 'Europe/Madrid')
 */
import cron from 'node-cron';
import logger from '../logger.js';
import { obtenerRecordatoriosPendientes, marcarRecordatorioNotificado } from '../DAO/recordatoriosDAO.js';
import { crearNotificacion } from '../DAO/notificacionesDAO.js';

const MINUTOS_ANTES = parseInt(process.env.RECORDATORIO_MINUTOS_ANTES || '15', 10);

// ID del "sistema" que actúa como emisor en la tabla notificaciones.
// Debe ser un UUID válido existente en appUsers (p.ej. una cuenta de servicio).
// Si no está configurado, se usa el propio usuario como emisor de su recordatorio.
const SISTEMA_USER_ID = process.env.SISTEMA_USER_ID || null;

/**
 * Formatea los minutos restantes para el mensaje de notificación.
 */
function formatearTiempoRestante(minutosAntes) {
  if (minutosAntes === 60) return '1 hora';
  if (minutosAntes > 60) return `${Math.floor(minutosAntes / 60)}h ${minutosAntes % 60}min`;
  return `${minutosAntes} minutos`;
}

/**
 * Procesa los recordatorios próximos y envía las notificaciones.
 */
async function procesarRecordatorios(io) {
  try {
    const pendientes = await obtenerRecordatoriosPendientes(MINUTOS_ANTES);

    if (pendientes.length === 0) return;

    logger.info(`[RECORDATORIOS] ${pendientes.length} recordatorio(s) próximo(s) — notificando...`);

    for (const rec of pendientes) {
      const usuarioId = rec.usuario_id;
      const emisorId = SISTEMA_USER_ID || usuarioId;

      const tiempoTexto = formatearTiempoRestante(MINUTOS_ANTES);
      const titulo = `⏰ Recordatorio en ${tiempoTexto}`;
      const contenido = rec.descripcion
        ? `${rec.titulo}: ${rec.descripcion}`
        : rec.titulo;

      try {
        // 1. Persistir notificación en BD
        const notificacion = await crearNotificacion({
          emisor_id: emisorId,
          receptor_id: usuarioId,
          tipo: 'recordatorio',
          titulo,
          contenido,
          url: '/calendario',
        });

        // 2. Emitir en tiempo real por Socket.IO si está disponible
        if (io) {
          io.to(`user_${usuarioId}`).emit('nueva_notificacion', notificacion);
        }

        // 3. Marcar como notificado para no reenviarlo
        await marcarRecordatorioNotificado(rec.id);

        logger.info(`[RECORDATORIOS] Notificación enviada → usuario ${usuarioId} | recordatorio #${rec.id}: "${rec.titulo}"`);
      } catch (err) {
        // Error en un recordatorio individual: loguear y continuar con los demás
        logger.error(`[RECORDATORIOS] Error procesando recordatorio #${rec.id}:`, err);
      }
    }
  } catch (err) {
    logger.error('[RECORDATORIOS] Error al consultar recordatorios pendientes:', err);
  }
}

/**
 * Inicializa el cron job de recordatorios.
 * Debe llamarse una sola vez al arrancar el servidor, pasando la instancia de Socket.IO.
 *
 * @param {import('socket.io').Server} io
 */
export function inicializarServicioRecordatorios(io) {
  logger.info('==================================================');
  logger.info('SERVICIO DE RECORDATORIOS AUTOMATICOS');
  logger.info('==================================================');
  logger.info(`  Anticipacion configurada : ${MINUTOS_ANTES} minutos`);
  logger.info(`  Frecuencia de comprobacion: cada minuto`);
  logger.info(`  Variable de entorno       : RECORDATORIO_MINUTOS_ANTES= ${MINUTOS_ANTES}`);
  logger.info('==================================================\n');

  // Ejecutar cada minuto
  cron.schedule('* * * * *', () => procesarRecordatorios(io), {
    timezone: process.env.TZ || 'Europe/Madrid',
  });
}
