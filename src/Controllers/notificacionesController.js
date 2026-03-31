import * as notificacionesDAO from "../DAO/notificacionesDAO.js";
import { obtenerContactos, obtenerUsuariosCoordinados } from "../DAO/contactosDAO.js";
import * as dashboardDAO from "../DAO/dashboardDAO.js";
import { procesarPlantilla, enviarNotificacion, verificarConfiguracion } from "../services/notificacionesService.js";
import logger from '../logger.js';

/**
 * Obtener notificaciones del usuario autenticado (extendido)
 */
export const getNotificaciones = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const { leida, tipo, canal, limit } = req.query;

    const filtros = {};
    if (leida !== undefined) filtros.leida = leida === 'true';
    if (tipo) filtros.tipo = tipo;
    if (canal) filtros.canal = canal;
    if (limit) filtros.limit = parseInt(limit);

    const notificaciones = await notificacionesDAO.obtenerNotificaciones(usuarioId, filtros);

    res.json(notificaciones);
  } catch (error) {
    next(error);
  }
};

/**
 * Contar notificaciones no leídas
 */
export const getContadorNoLeidas = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const count = await notificacionesDAO.contarNoLeidas(usuarioId);

    res.json({ count });
  } catch (error) {
    next(error);
  }
};

/**
 * Crear y enviar una notificación (extendido)
 */
export const crearNotificacion = async (req, res, next) => {
  try {
    const emisorId = req.user.id;
    const {
      receptor_id,
      tipo,
      titulo,
      contenido,
      url,
      canal = 'push',
      plantilla_codigo,
      variables = {}
    } = req.body;

    let contenidoFinal = contenido;
    let tituloFinal = titulo;
    let plantillaId = null;

    // Si se especifica plantilla, procesarla
    if (plantilla_codigo) {
      const plantilla = await notificacionesDAO.obtenerPlantilla(plantilla_codigo, canal);
      plantillaId = plantilla.id;

      // Procesar contenido con variables
      contenidoFinal = procesarPlantilla(plantilla.contenido, variables);

      // Para email, usar asunto de plantilla si no se especificó
      if (canal === 'email' && plantilla.asunto && !titulo) {
        tituloFinal = procesarPlantilla(plantilla.asunto, variables);
      }
    }

    // Crear notificación
    const notificacion = await notificacionesDAO.crearNotificacion({
      emisor_id: emisorId,
      receptor_id: receptor_id,
      tipo,
      titulo: tituloFinal,
      contenido: contenidoFinal,
      url,
      canal,
      plantilla_id: plantillaId,
      datos_adicionales: variables // Guardar variables para referencia
    });

    // Si no es push, encolar para envío
    if (canal !== 'push') {
      await notificacionesDAO.encolarNotificacion(notificacion.id, 2); // Prioridad normal
    }

    // Registrar actividad
    dashboardDAO.registrarActividad(
      emisorId,
      'notificacion',
      'Notificación enviada',
      `Envió notificación ${canal} a usuario ${receptor_id}`
    ).catch(err => logger.error({ err }, 'Error al registrar actividad de notificación'));

    res.status(201).json(notificacion);
  } catch (error) {
    next(error);
  }
};

/**
 * Marcar notificación como leída
 */
export const marcarLeida = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const notificacionId = req.params.id;

    const notificacion = await notificacionesDAO.marcarLeida(notificacionId, usuarioId);

    res.json(notificacion);
  } catch (error) {
    next(error);
  }
};

/**
 * Marcar todas las notificaciones como leídas
 */
export const marcarTodasLeidas = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const resultado = await notificacionesDAO.marcarTodasLeidas(usuarioId);

    res.json(resultado);
  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar una notificación
 */
export const eliminarNotificacion = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const notificacionId = req.params.id;

    await notificacionesDAO.eliminarNotificacion(notificacionId, usuarioId);

    res.json({ success: true, message: "Notificación eliminada" });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener notificaciones enviadas (historial)
 */
export const getNotificacionesEnviadas = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const { limit } = req.query;
    const limite = limit ? parseInt(limit) : 50;

    const notificaciones = await notificacionesDAO.obtenerNotificacionesEnviadas(usuarioId, limite);

    res.json(notificaciones);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener configuraciones de notificación del usuario
 */
export const getConfigNotificaciones = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const configuraciones = await notificacionesDAO.obtenerConfigNotificaciones(usuarioId);

    res.json(configuraciones);
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar configuración de notificación
 */
export const actualizarConfigNotificacion = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const { tipo_evento, canal, activo } = req.body;

    const configuracion = await notificacionesDAO.actualizarConfigNotificacion(
      usuarioId, tipo_evento, canal, activo
    );

    res.json(configuracion);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener plantillas disponibles (admin)
 */
export const getPlantillas = async (req, res, next) => {
  try {
    const { canal } = req.query;
    const plantillas = await notificacionesDAO.obtenerPlantillas(canal);

    res.json(plantillas);
  } catch (error) {
    next(error);
  }
};

/**
 * Verificar estado de configuración de servicios
 */
export const getEstadoServicios = async (req, res, next) => {
  try {
    const servicios = verificarConfiguracion();
    res.json(servicios);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener cola de notificaciones pendientes (admin)
 */
export const getColaNotificaciones = async (req, res, next) => {
  try {
    const cola = await notificacionesDAO.obtenerColaNotificaciones();
    res.json(cola);
  } catch (error) {
    next(error);
  }
};

/**
 * Enviar notificación masiva a múltiples usuarios
 */
export const enviarNotificacionMasiva = async (req, res, next) => {
  try {
    const emisorId = req.user.id;
    const {
      usuarios_ids,
      tipo,
      titulo,
      contenido,
      url,
      canal = 'push',
      plantilla_codigo,
      variables = {}
    } = req.body;

    if (!Array.isArray(usuarios_ids) || usuarios_ids.length === 0) {
      return res.status(400).json({ error: 'Se debe especificar al menos un usuario receptor' });
    }

    const notificacionesCreadas = [];

    // Procesar plantilla si se especifica
    let contenidoFinal = contenido;
    let tituloFinal = titulo;
    let plantillaId = null;

    if (plantilla_codigo) {
      const plantilla = await notificacionesDAO.obtenerPlantilla(plantilla_codigo, canal);
      plantillaId = plantilla.id;
      contenidoFinal = procesarPlantilla(plantilla.contenido, variables);
      if (canal === 'email' && plantilla.asunto && !titulo) {
        tituloFinal = procesarPlantilla(plantilla.asunto, variables);
      }
    }

    // Crear notificación para cada usuario
    for (const receptorId of usuarios_ids) {
      const notificacion = await notificacionesDAO.crearNotificacion({
        emisor_id: emisorId,
        receptor_id: receptorId,
        tipo,
        titulo: tituloFinal,
        contenido: contenidoFinal,
        url,
        canal,
        plantilla_id: plantillaId,
        datos_adicionales: variables
      });

      // Encolar si no es push
      if (canal !== 'push') {
        await notificacionesDAO.encolarNotificacion(notificacion.id, 1); // Prioridad baja para masivos
      }

      notificacionesCreadas.push(notificacion);
    }

    // Registrar actividad
    dashboardDAO.registrarActividad(
      emisorId,
      'notificacion_masiva',
      'Notificación masiva enviada',
      `Envió notificación ${canal} a ${usuarios_ids.length} usuarios`
    ).catch(err => logger.error({ err }, 'Error al registrar actividad de notificación masiva'));

    res.status(201).json({
      mensaje: `Notificación enviada a ${notificacionesCreadas.length} usuarios`,
      notificaciones: notificacionesCreadas
    });
  } catch (error) {
    next(error);
  }
};
