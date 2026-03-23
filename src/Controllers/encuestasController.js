import * as encuestasDAO from "../DAO/encuestasDAO.js";
import * as dashboardDAO from "../DAO/dashboardDAO.js";
import * as notificacionesDAO from "../DAO/notificacionesDAO.js";
import * as userDAO from "../DAO/userDAO.js";
import logger from '../logger.js';

/**
 * Obtener todas las encuestas (con filtros opcionales)
 */
export const getEncuestas = async (req, res, next) => {
  try {
    const { estado } = req.query;
    const filtros = {};

    if (estado) {
      filtros.estado = estado;
    }

    // Filtrar por rol del usuario autenticado
    if (req.user) {
      filtros.usuarioRol = req.user.rol;
    }

    const encuestas = await encuestasDAO.obtenerEncuestas(filtros);
    res.json(encuestas);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener una encuesta específica por ID
 */
export const getEncuestaPorId = async (req, res, next) => {
  try {
    const encuesta = await encuestasDAO.obtenerEncuestaPorId(req.params.id);
    
    if (!encuesta) {
      return res.status(404).json({ message: "Encuesta no encontrada" });
    }

    res.json(encuesta);
  } catch (error) {
    next(error);
  }
};

/**
 * Crear una nueva encuesta (solo administradores)
 */
export const crearEncuesta = async (req, res, next) => {
  try {
    // Verificar que el usuario es administrador (rol 1)
    if (req.user.rol !== 1) {
      return res.status(403).json({ 
        message: "No tienes permisos para crear encuestas. Solo administradores." 
      });
    }

    const { titulo, descripcion, fecha_fin, rol_objetivo, notificar_admins, notificar_coordinadores, notificar_usuarios, preguntas } = req.body;

    // Validaciones básicas
    if (!titulo || !descripcion || !fecha_fin) {
      return res.status(400).json({ 
        message: "Faltan campos requeridos: titulo, descripcion, fecha_fin" 
      });
    }

    if (!preguntas || preguntas.length === 0) {
      return res.status(400).json({ 
        message: "La encuesta debe tener al menos una pregunta" 
      });
    }

    // Validar que la fecha_fin sea futura
    const fechaFin = new Date(fecha_fin);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (fechaFin < hoy) {
      return res.status(400).json({ 
        message: "La fecha de finalización debe ser igual o posterior a hoy" 
      });
    }

    // Validar preguntas
    for (const pregunta of preguntas) {
      if (!pregunta.texto || !pregunta.tipo) {
        return res.status(400).json({ 
          message: "Todas las preguntas deben tener texto y tipo" 
        });
      }

      if (!['multiple', 'abierta'].includes(pregunta.tipo)) {
        return res.status(400).json({ 
          message: "Tipo de pregunta inválido. Debe ser 'multiple' o 'abierta'" 
        });
      }

      // Si es múltiple, debe tener opciones
      if (pregunta.tipo === 'multiple') {
        if (!pregunta.opciones || pregunta.opciones.length === 0) {
          return res.status(400).json({ 
            message: "Las preguntas de tipo 'multiple' deben tener al menos una opción" 
          });
        }

        // Validar que las opciones tengan texto
        for (const opcion of pregunta.opciones) {
          if (!opcion.texto) {
            return res.status(400).json({ 
              message: "Todas las opciones deben tener texto" 
            });
          }
        }
      }
    }

    const nuevaEncuesta = await encuestasDAO.crearEncuesta(req.body);
    
    // Registrar actividad
    try {
      await dashboardDAO.registrarActividad(
        req.user.id,
        'encuesta',
        'Encuesta creada',
        `Creó la encuesta: ${req.body.titulo}`
      );
    } catch (error) {
      logger.error({ error }, 'Error al registrar actividad de creación de encuesta');
    }

    // Enviar notificación a todos los usuarios
    try {
      const rolesSeleccionados = [];
      if (notificar_admins) rolesSeleccionados.push(1);
      if (notificar_coordinadores) rolesSeleccionados.push(2);
      if (notificar_usuarios) rolesSeleccionados.push(3);

      // Si no hay roles seleccionados, no enviar notificaciones
      if (rolesSeleccionados.length === 0) {
        logger.info('No se seleccionaron roles para notificación de nueva encuesta');
      } else {
        // Obtener solo los usuarios de los roles necesarios en la DB, excluyendo al creador
        // Evita traer toda la tabla a memoria para filtrar en JS
        const filtrosUsuarios = {};
        if (rolesSeleccionados.length === 1) {
          filtrosUsuarios.role = rolesSeleccionados[0];
        }
        const { data: usuariosFiltrados } = await userDAO.getAllUsers(filtrosUsuarios);
        const receptoresIds = (usuariosFiltrados || [])
          .filter(u => u.id !== req.user.id && rolesSeleccionados.includes(u.rol))
          .map(u => u.id);

        if (receptoresIds.length > 0) {
          const notificaciones = await notificacionesDAO.enviarNotificacionMasiva(
            req.user.id,
            receptoresIds,
            {
              tipo: 'encuesta',
              titulo: 'Nueva encuesta disponible',
              contenido: `Hay una nueva encuesta: "${req.body.titulo}". ¡Tu opinión es importante!`,
              url: `/encuestas?id=${nuevaEncuesta.id}`
            }
          );

          // Emitir eventos Socket.IO a cada receptor
          if (req.io) {
            notificaciones.forEach(notif => {
              req.io.to(`user_${notif.receptor_id}`).emit('nueva_notificacion', notif);
            });
            logger.info(`${notificaciones.length} notificaciones enviadas para nueva encuesta: ${req.body.titulo}`);
          }
        } else {
          logger.info('No hay usuarios con los roles seleccionados para notificar');
        }
      }
    } catch (error) {
      logger.error({ error }, 'Error al enviar notificaciones de nueva encuesta');
      // No fallar la creación de la encuesta si falla el envío de notificaciones
    }
    
    res.status(201).json(nuevaEncuesta);
  } catch (error) {
    next(error);
  }
};

/**
 * Responder a una encuesta
 */
export const responderEncuesta = async (req, res, next) => {
  try {
    const encuestaId = parseInt(req.params.id);
    const usuarioId = req.user.id;
    const { respuestas } = req.body;

    // Validación básica
    if (!respuestas || Object.keys(respuestas).length === 0) {
      return res.status(400).json({ 
        message: "Debes proporcionar al menos una respuesta" 
      });
    }

    const resultado = await encuestasDAO.crearRespuestaEncuesta(
      encuestaId, 
      usuarioId, 
      respuestas
    );

    // Registrar actividad
    try {
      const encuesta = await encuestasDAO.obtenerEncuestaPorId(encuestaId);
      await dashboardDAO.registrarActividad(
        usuarioId,
        'encuesta',
        'Encuesta respondida',
        `Respondió la encuesta: ${encuesta.titulo}`
      );
    } catch (error) {
      logger.error({ error }, 'Error al registrar actividad de encuesta');
    }

    res.status(201).json(resultado);
  } catch (error) {
    // Errores específicos del DAO
    if (error.message === "La encuesta ya está cerrada") {
      return res.status(400).json({ message: error.message });
    }
    if (error.message === "Ya has respondido esta encuesta") {
      return res.status(409).json({ message: error.message });
    }
    
    next(error);
  }
};

/**
 * Obtener resultados de una encuesta
 */
export const getResultadosEncuesta = async (req, res, next) => {
  try {
    const encuestaId = parseInt(req.params.id);
    const usuarioId = req.user.id;

    const resultado = await encuestasDAO.obtenerResultadosEncuesta(
      encuestaId, 
      usuarioId
    );

    // Indicar si la respuesta proviene de caché
    res.setHeader('X-Cache', resultado.fromCache ? 'HIT' : 'MISS');

    res.json(resultado);
  } catch (error) {
    next(error);
  }
};

/**
 * Publicar/activar una encuesta (cambiar estado a activa)
 * Solo administradores
 */
export const publicarEncuesta = async (req, res, next) => {
  try {
    // Verificar que el usuario es administrador
    if (req.user.rol !== 1) {
      return res.status(403).json({ 
        message: "No tienes permisos para publicar encuestas. Solo administradores." 
      });
    }

    const encuestaId = parseInt(req.params.id);
    
    // Verificar que la encuesta existe
    const encuesta = await encuestasDAO.obtenerEncuestaPorId(encuestaId);
    
    if (!encuesta) {
      return res.status(404).json({ message: "Encuesta no encontrada" });
    }

    // Verificar que la fecha_fin es futura
    const fechaFin = new Date(encuesta.fecha_fin);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (fechaFin < hoy) {
      return res.status(400).json({ 
        message: "No se puede publicar una encuesta con fecha de finalización pasada" 
      });
    }

    res.json({ 
      success: true, 
      mensaje: "Encuesta publicada correctamente",
      encuesta 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener lista de usuarios que han respondido una encuesta
 * Solo administradores
 */
export const getRespuestasDetalladas = async (req, res, next) => {
  try {
    // Verificar que el usuario es administrador
    if (req.user.rol !== 1) {
      return res.status(403).json({ 
        message: "No tienes permisos para ver respuestas detalladas. Solo administradores." 
      });
    }

    const encuestaId = parseInt(req.params.id);
    const respuestas = await encuestasDAO.obtenerRespuestasDetalladas(encuestaId);

    res.json(respuestas);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener las respuestas de un usuario concreto en una encuesta
 * Solo administradores
 */
export const getRespuestasDeUsuario = async (req, res, next) => {
  try {
    if (req.user.rol !== 1) {
      return res.status(403).json({
        message: "No tienes permisos para ver respuestas de usuarios. Solo administradores."
      });
    }

    const encuestaId = parseInt(req.params.id);
    const usuarioId = parseInt(req.params.usuarioId);

    if (isNaN(encuestaId) || isNaN(usuarioId)) {
      return res.status(400).json({ message: "IDs inválidos" });
    }

    const respuestas = await encuestasDAO.obtenerRespuestasDeUsuario(encuestaId, usuarioId);
    res.json(respuestas);
  } catch (error) {
    next(error);
  }
};

/**
 * Cerrar una encuesta manualmente antes de su fecha de fin
 * Solo administradores
 */
export const cerrarEncuesta = async (req, res, next) => {
  try {
    // Verificar que el usuario es administrador
    if (req.user.rol !== 1) {
      return res.status(403).json({ 
        message: "No tienes permisos para cerrar encuestas. Solo administradores." 
      });
    }

    const encuestaId = parseInt(req.params.id);
    
    // Verificar que la encuesta existe y está activa
    const encuesta = await encuestasDAO.obtenerEncuestaPorId(encuestaId);
    
    if (!encuesta) {
      return res.status(404).json({ message: "Encuesta no encontrada" });
    }

    if (encuesta.estado === 'cerrada') {
      return res.status(400).json({ 
        message: "La encuesta ya está cerrada" 
      });
    }

    const encuestaActualizada = await encuestasDAO.cerrarEncuesta(encuestaId);

    // Registrar actividad
    try {
      await dashboardDAO.registrarActividad(
        req.user.id,
        'encuesta',
        'Encuesta cerrada',
        `Cerró manualmente la encuesta: ${encuesta.titulo}`
      );
    } catch (error) {
      logger.error({ error }, 'Error al registrar actividad de cierre de encuesta');
    }

    res.json({ 
      success: true, 
      mensaje: "Encuesta cerrada correctamente",
      encuesta: encuestaActualizada
    });
  } catch (error) {
    next(error);
  }
};
