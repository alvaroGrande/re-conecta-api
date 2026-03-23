import * as notificacionesDAO from "../DAO/notificacionesDAO.js";
import { obtenerContactos, obtenerUsuariosCoordinados } from "../DAO/contactosDAO.js";
import * as dashboardDAO from "../DAO/dashboardDAO.js";
import logger from '../logger.js';

/**
 * Obtener notificaciones del usuario autenticado
 */
export const getNotificaciones = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const { solo_no_leidas, limite } = req.query;
    
    const soloNoLeidas = solo_no_leidas === 'true';
    const limiteNum = limite ? parseInt(limite) : 50;
    
    const notificaciones = await notificacionesDAO.obtenerNotificaciones(
      usuarioId, 
      soloNoLeidas, 
      limiteNum
    );
    
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
 * Crear y enviar una notificación
 */
export const crearNotificacion = async (req, res, next) => {
  try {
    const emisorId = req.user.id;
    const { receptor_id, tipo, titulo, contenido, url } = req.body;

    if (!receptor_id || !tipo || !titulo || !contenido) {
      return res.status(400).json({ 
        message: "Faltan campos requeridos: receptor_id, tipo, titulo, contenido" 
      });
    }

    // Verificar que el emisor puede enviar notificaciones al receptor
    const puedeEnviar = await verificarPermisoEnvio(emisorId, receptor_id, req.user.rol);
    
    if (!puedeEnviar) {
      return res.status(403).json({ 
        message: "No tienes permiso para enviar notificaciones a este usuario" 
      });
    }

    const notificacion = await notificacionesDAO.crearNotificacion({
      emisor_id: emisorId,
      receptor_id,
      tipo,
      titulo,
      contenido,
      url
    });

    // Emitir evento Socket.IO al destinatario
    if (req.io) {
      req.io.to(`user_${receptor_id}`).emit('nueva_notificacion', notificacion);
      logger.info(`Notificación enviada via WebSocket a user_${receptor_id}: ${titulo}`);
    } else {
      logger.warn('Socket.IO no disponible - notificación no enviada en tiempo real');
    }

    // Registrar actividad
    try {
      await dashboardDAO.registrarActividad(
        emisorId,
        'notificacion',
        'Notificación enviada',
        `Envió notificación a ${receptor_id}: ${titulo}`
      );
    } catch (error) {
      logger.error({ error }, 'Error al registrar actividad de notificación');
    }

    res.status(201).json(notificacion);
  } catch (error) {
    next(error);
  }
};

/**
 * Enviar notificación masiva (solo instructores)
 */
export const enviarNotificacionMasiva = async (req, res, next) => {
  try {
    const emisorId = req.user.id;
    const rolEmisor = req.user.rol;
    const { receptores_ids, tipo, titulo, contenido, url } = req.body;

    // Solo instructores y admins pueden enviar notificaciones masivas
    if (rolEmisor !== 1 && rolEmisor !== 2) {
      return res.status(403).json({ 
        message: "Solo instructores y administradores pueden enviar notificaciones masivas" 
      });
    }

    if (!receptores_ids || !Array.isArray(receptores_ids) || receptores_ids.length === 0) {
      return res.status(400).json({ 
        message: "Debes especificar al menos un receptor" 
      });
    }

    if (!tipo || !titulo || !contenido) {
      return res.status(400).json({ 
        message: "Faltan campos requeridos: tipo, titulo, contenido" 
      });
    }

    // Si es instructor, verificar que puede enviar a estos usuarios
    if (rolEmisor === 2) {
      const resultado = await obtenerUsuariosCoordinados(emisorId);
      const idsCoordinados = resultado.data.map(u => u.id);
      
      const todosPermitidos = receptores_ids.every(id => idsCoordinados.includes(id));
      
      if (!todosPermitidos) {
        return res.status(403).json({ 
          message: "Solo puedes enviar notificaciones a usuarios que coordinas" 
        });
      }
    }

    const notificaciones = await notificacionesDAO.enviarNotificacionMasiva(
      emisorId,
      receptores_ids,
      { tipo, titulo, contenido: contenido, url }
    );

    // Emitir eventos Socket.IO a cada receptor
    if (req.io) {
      let enviadas = 0;
      notificaciones.forEach(notif => {
        req.io.to(`user_${notif.receptor_id}`).emit('nueva_notificacion', notif);
        enviadas++;
      });
      logger.info(`${enviadas} notificaciones enviadas via WebSocket: ${titulo}`);
    } else {
      logger.warn('Socket.IO no disponible - notificaciones no enviadas en tiempo real');
    }

    // Registrar actividad masiva
    try {
      await dashboardDAO.registrarActividad(
        emisorId,
        'notificacion',
        'Notificación masiva enviada',
        `Envió ${notificaciones.length} notificaciones: ${titulo}`
      );
    } catch (error) {
      logger.error({ error }, 'Error al registrar actividad de notificación masiva');
    }

    res.status(201).json({ 
      success: true, 
      message: `Se enviaron ${notificaciones.length} notificaciones`,
      notificaciones 
    });
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
    const notificacionId = parseInt(req.params.id);

    const notificacion = await notificacionesDAO.marcarComoLeida(notificacionId, usuarioId);
    
    res.json(notificacion);
  } catch (error) {
    if (error.message.includes("no rows returned")) {
      return res.status(404).json({ 
        message: "Notificación no encontrada o no tienes permiso" 
      });
    }
    next(error);
  }
};

/**
 * Marcar todas las notificaciones como leídas
 */
export const marcarTodasLeidas = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const cantidad = await notificacionesDAO.marcarTodasComoLeidas(usuarioId);
    
    res.json({ 
      success: true, 
      message: `Se marcaron ${cantidad} notificaciones como leídas`,
      cantidad 
    });
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
    const notificacionId = parseInt(req.params.id);

    await notificacionesDAO.eliminarNotificacion(notificacionId, usuarioId);
    
    res.json({ 
      success: true, 
      message: "Notificación eliminada" 
    });
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
    const { limite } = req.query;
    
    const limiteNum = limite ? parseInt(limite) : 50;
    
    const notificaciones = await notificacionesDAO.obtenerNotificacionesEnviadas(
      usuarioId, 
      limiteNum
    );
    
    res.json(notificaciones);
  } catch (error) {
    next(error);
  }
};

/**
 * Verificar si el emisor tiene permiso para enviar notificación al receptor
 */
const verificarPermisoEnvio = async (emisorId, receptorId, rolEmisor) => {
  // Admins pueden enviar a cualquiera
  if (rolEmisor === 1) return true;

  // Instructores pueden enviar a sus usuarios coordinados
  if (rolEmisor === 2) {
    const { data } = await obtenerUsuariosCoordinados(emisorId);
    const idsCoordinados = data.map(u => u.id);
    return idsCoordinados.includes(receptorId);
  }

  // Usuarios normales pueden enviar a sus contactos
  const {data} = await obtenerContactos(emisorId);
  const idsContactos = data.map(c => c.id);
  return idsContactos.includes(receptorId);
};
