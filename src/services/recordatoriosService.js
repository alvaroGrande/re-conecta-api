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
import {
  obtenerRecordatoriosPendientes,
  marcarRecordatorioNotificado,
  obtenerTalleresPendientesRecordatorio,
  obtenerTalleresFinalizados,
  marcarRecordatorioTallerNotificado,
} from '../DAO/recordatoriosDAO.js';
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
  logger.info('  Recordatorios de talleres : 24h / 1h / 10min / post-taller');
  logger.info('==================================================\n');

  // Recordatorios personales (cada minuto)
  cron.schedule('* * * * *', () => procesarRecordatorios(io), {
    timezone: process.env.TZ || 'Europe/Madrid',
  });

  // Recordatorios inteligentes de talleres (cada minuto)
  cron.schedule('* * * * *', () => procesarRecordatoriosTalleres(io), {
    timezone: process.env.TZ || 'Europe/Madrid',
  });
}

// ============================================================
//  Recordatorios inteligentes de talleres
// ============================================================

/** Ventanas de recordatorio: tipo → minutos antes del taller */
const VENTANAS_TALLER = [
  { tipo: '24h',   minutos: 24 * 60 },
  { tipo: '1h',    minutos: 60 },
  { tipo: '10min', minutos: 10 },
];

function textoVentana(tipo) {
  if (tipo === '24h')   return '24 horas';
  if (tipo === '1h')    return '1 hora';
  if (tipo === '10min') return '10 minutos';
  return tipo;
}

/**
 * Procesa los recordatorios automáticos de talleres:
 * - 24 horas antes: avisa a todos los inscritos
 * - 1 hora antes: avisa a todos los inscritos
 * - 10 minutos antes: avisa a todos los inscritos
 * - Post-taller: invita a completar la encuesta de satisfacción
 */
async function procesarRecordatoriosTalleres(io) {
  try {
    // 1. Recordatorios previos al taller (24h, 1h, 10min)
    for (const ventana of VENTANAS_TALLER) {
      const talleres = await obtenerTalleresPendientesRecordatorio(ventana.tipo, ventana.minutos);

      for (const taller of talleres) {
        const inscritos = (taller.inscripciones || []).map(i => i.usuario_id);
        if (inscritos.length === 0) {
          await marcarRecordatorioTallerNotificado(taller.id, ventana.tipo);
          continue;
        }

        const emisorId = SISTEMA_USER_ID;
        if (!emisorId) {
          logger.warn('[RECORDATORIOS_TALLERES] SISTEMA_USER_ID no configurado — omitiendo notificaciones de taller');
          continue;
        }

        const titulo   = `⏰ Taller en ${textoVentana(ventana.tipo)}`;
        const contenido = `"${taller.titulo}" comienza en ${textoVentana(ventana.tipo)}.`;

        for (const usuarioId of inscritos) {
          try {
            const notif = await crearNotificacion({
              emisor_id:   emisorId,
              receptor_id: usuarioId,
              tipo:        'recordatorio',
              titulo,
              contenido,
              url:         `/talleres`,
            });

            if (io) io.to(`user_${usuarioId}`).emit('nueva_notificacion', notif);
          } catch (err) {
            logger.error(`[RECORDATORIOS_TALLERES] Error notificando usuario ${usuarioId}:`, err);
          }
        }

        await marcarRecordatorioTallerNotificado(taller.id, ventana.tipo);
        logger.info(`[RECORDATORIOS_TALLERES] ${ventana.tipo} → taller #${taller.id} "${taller.titulo}" → ${inscritos.length} usuario(s) notificado(s)`);
      }
    }

    // 2. Post-taller: invitación a encuesta de satisfacción
    const finalizados = await obtenerTalleresFinalizados(2);
    for (const taller of finalizados) {
      const inscritos = (taller.inscripciones || []).map(i => i.usuario_id);
      if (inscritos.length === 0) {
        await marcarRecordatorioTallerNotificado(taller.id, 'post_taller');
        continue;
      }

      const emisorId = SISTEMA_USER_ID;
      if (!emisorId) continue;

      const titulo    = `📋 ¿Cómo fue el taller?`;
      const contenido = `El taller "${taller.titulo}" ha finalizado. ¡Comparte tu opinión en la encuesta de satisfacción!`;

      for (const usuarioId of inscritos) {
        try {
          const notif = await crearNotificacion({
            emisor_id:   emisorId,
            receptor_id: usuarioId,
            tipo:        'recordatorio',
            titulo,
            contenido,
            url:         `/encuestas`,
          });

          if (io) io.to(`user_${usuarioId}`).emit('nueva_notificacion', notif);
        } catch (err) {
          logger.error(`[RECORDATORIOS_TALLERES] Error notificando post_taller usuario ${usuarioId}:`, err);
        }
      }

      await marcarRecordatorioTallerNotificado(taller.id, 'post_taller');
      logger.info(`[RECORDATORIOS_TALLERES] post_taller → taller #${taller.id} "${taller.titulo}" → ${inscritos.length} invitación(es) a encuesta`);
    }
  } catch (err) {
    logger.error('[RECORDATORIOS_TALLERES] Error general en procesarRecordatoriosTalleres:', err);
  }
}
