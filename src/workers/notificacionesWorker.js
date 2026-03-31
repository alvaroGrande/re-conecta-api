#!/usr/bin/env node

/**
 * Worker para procesar cola de notificaciones
 * Se ejecuta periódicamente para enviar emails, WhatsApp, etc.
 */

import { supabase } from '../DAO/connection.js'
import * as notificacionesDAO from '../DAO/notificacionesDAO.js'
import { enviarNotificacion } from '../services/notificacionesService.js'
import logger from '../logger.js'

const PROCESAR_LOTE = 10 // Máximo número de notificaciones a procesar por ejecución
const INTERVALO_MS = 30000 // 30 segundos entre ejecuciones

/**
 * Procesar un elemento de la cola
 * @param {Object} itemCola - Elemento de la cola
 */
async function procesarNotificacion(itemCola) {
  const { id: colaId, notificacion } = itemCola

  try {
    logger.info({
      type: 'cola_procesando',
      colaId,
      notificacionId: notificacion.id,
      canal: notificacion.canal,
      receptorId: notificacion.receptor_id
    }, 'Procesando notificación de cola')

    // Marcar como procesando
    await notificacionesDAO.actualizarEstadoCola(colaId, 'procesando')

    // Enviar notificación
    const resultado = await enviarNotificacion(notificacion, notificacion.receptor)

    // Marcar como completada
    await notificacionesDAO.actualizarEstadoCola(colaId, 'completada')

    // Actualizar estado de la notificación
    await supabase
      .from('notificaciones')
      .update({
        estado: 'enviada',
        enviada_en: new Date().toISOString(),
        intentos: supabase.raw('intentos + 1')
      })
      .eq('id', notificacion.id)

    logger.info({
      type: 'cola_completada',
      colaId,
      notificacionId: notificacion.id,
      resultado
    }, 'Notificación procesada exitosamente')

  } catch (error) {
    logger.error({
      type: 'cola_error',
      colaId,
      notificacionId: notificacion.id,
      error: error.message
    }, 'Error al procesar notificación')

    // Incrementar intentos
    const itemActualizado = await notificacionesDAO.incrementarIntentosCola(colaId)

    // Si supera max_intentos, marcar como fallida
    if (itemActualizado.intentos >= itemActualizado.max_intentos) {
      await notificacionesDAO.actualizarEstadoCola(colaId, 'fallida', error.message)
    } else {
      // Re-encolar para reintento (con backoff exponencial)
      const delayMs = Math.pow(2, itemActualizado.intentos) * 60000 // 1min, 2min, 4min...
      const nuevaFecha = new Date(Date.now() + delayMs).toISOString()

      await supabase
        .from('notificaciones_cola')
        .update({
          estado: 'pendiente',
          programado_para: nuevaFecha
        })
        .eq('id', colaId)

      logger.info({
        type: 'cola_reencolada',
        colaId,
        intentos: itemActualizado.intentos,
        siguienteIntento: nuevaFecha
      }, 'Notificación re-encolada para reintento')
    }
  }
}

/**
 * Procesar lote de notificaciones pendientes
 */
async function procesarLote() {
  try {
    logger.info({ type: 'worker_inicio' }, 'Iniciando procesamiento de cola de notificaciones')

    // Obtener notificaciones pendientes
    const colaPendiente = await notificacionesDAO.obtenerColaPendiente(PROCESAR_LOTE)

    if (colaPendiente.length === 0) {
      logger.info({ type: 'worker_sin_trabajo' }, 'No hay notificaciones pendientes')
      return
    }

    logger.info({
      type: 'worker_lote',
      cantidad: colaPendiente.length
    }, `Procesando ${colaPendiente.length} notificaciones`)

    // Procesar en paralelo con límite de concurrencia
    const promesas = colaPendiente.map(item => procesarNotificacion(item))
    await Promise.allSettled(promesas)

    logger.info({ type: 'worker_fin' }, 'Lote procesado completado')

  } catch (error) {
    logger.error({
      type: 'worker_error',
      error: error.message
    }, 'Error en worker de notificaciones')
  }
}

/**
 * Iniciar worker
 */
function iniciarWorker() {
  logger.info({
    type: 'worker_started',
    intervalo: INTERVALO_MS,
    lote: PROCESAR_LOTE
  }, 'Worker de notificaciones iniciado')

  // Procesar inmediatamente al inicio
  procesarLote()

  // Luego procesar periódicamente
  setInterval(procesarLote, INTERVALO_MS)
}

// Manejo de señales para shutdown graceful
process.on('SIGINT', () => {
  logger.info({ type: 'worker_shutdown' }, 'Worker detenido por señal SIGINT')
  process.exit(0)
})

process.on('SIGTERM', () => {
  logger.info({ type: 'worker_shutdown' }, 'Worker detenido por señal SIGTERM')
  process.exit(0)
})

// Iniciar worker si se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  iniciarWorker()
}

export { procesarLote, iniciarWorker }
