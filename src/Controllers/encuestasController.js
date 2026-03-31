import * as encuestasDAO from "../DAO/encuestasDAO.js";
import * as dashboardDAO from "../DAO/dashboardDAO.js";
import * as notificacionesDAO from "../DAO/notificacionesDAO.js";
import * as userDAO from "../DAO/userDAO.js";
import { procesarPlantilla } from "../services/notificacionesService.js";
import { supabase } from "../DAO/connection.js";
import logger from '../logger.js';

const esAdmin             = (user) => user?.rol === 1;
const esAdminOCoordinador = (user) => user?.rol === 1 || user?.rol === 2;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esUUID  = (v) => UUID_RE.test(v);

/**
 * Obtener todas las encuestas (con filtros opcionales)
 */
export const getEncuestas = async (req, res, next) => {
  try {
    const { estado, q } = req.query;
    const filtros = {};

    if (estado) filtros.estado = estado;
    if (q?.trim()) filtros.q = q.trim();

    // Filtrar por rol del usuario autenticado
    if (req.user) {
      filtros.usuarioRol = req.user.rol;
      filtros.usuarioId  = req.user.id;
    }

    const encuestas = await encuestasDAO.obtenerEncuestas(filtros);
    res.json(encuestas);
  } catch (error) {
    next(error);
  }
};

/**+
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
    if (!esAdminOCoordinador(req.user)) {
      return res.status(403).json({ 
        message: "No tienes permisos para crear encuestas." 
      });
    }

    const { titulo, descripcion, fecha_fin, rol_objetivo, notificar_admins, notificar_coordinadores, notificar_usuarios, usuarios_destino, preguntas } = req.body;

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

    // Coordinadores: creado_por = su id; siempre dirigen la encuesta a usuarios (rol 3)
    // Admins: creado_por = null (distingue encuestas de admin de las de coordinador)
    const creadoPor       = req.user.rol === 2 ? req.user.id : null;
    const rolObjetivoFinal = req.user.rol === 2 ? 3 : (rol_objetivo || null);

    const nuevaEncuesta = await encuestasDAO.crearEncuesta({
      ...req.body,
      rol_objetivo: rolObjetivoFinal,
      creado_por: creadoPor
    });
    
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

    // Notificaciones automáticas por nueva encuesta
    enviarNotificacionesNuevaEncuesta(nuevaEncuesta, req.user, {
      notificar_admins,
      notificar_coordinadores,
      notificar_usuarios,
      usuarios_destino
    }).catch(err =>
      logger.error({ err }, 'Error al enviar notificaciones de nueva encuesta')
    );

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
    const encuestaId = req.params.id;
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
    const encuestaId = req.params.id;
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
    if (!esAdmin(req.user)) {
      return res.status(403).json({ 
        message: "No tienes permisos para publicar encuestas. Solo administradores." 
      });
    }

    const encuestaId = req.params.id;
    
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
    if (!esAdminOCoordinador(req.user)) {
      return res.status(403).json({ 
        message: "No tienes permisos para ver respuestas detalladas. Solo administradores." 
      });
    }

    const encuestaId = req.params.id;
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
    if (!esAdminOCoordinador(req.user)) {
      return res.status(403).json({
        message: "No tienes permisos para ver respuestas de usuarios. Solo administradores."
      });
    }

    const encuestaId = req.params.id;
    const usuarioId  = req.params.usuarioId;

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
    if (!esAdmin(req.user)) {
      return res.status(403).json({ 
        message: "No tienes permisos para cerrar encuestas. Solo administradores." 
      });
    }

    const encuestaId = req.params.id;
    
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

// ─── Notificaciones automáticas ──────────────────────────────────────────────

/**
 * Enviar notificaciones automáticas cuando se crea una nueva encuesta
 * @param {Object} encuesta - Datos de la encuesta creada
 * @param {Object} creador - Usuario que creó la encuesta
 * @param {Object} opcionesNotif - Opciones de notificación
 */
async function enviarNotificacionesNuevaEncuesta(encuesta, creador, opcionesNotif) {
  try {
    let usuarios = [];

    if (creador.rol === 2) {
      // Coordinador: notificar solo a los usuarios_destino seleccionados
      if (opcionesNotif.notificar_usuarios && Array.isArray(opcionesNotif.usuarios_destino)) {
        const { data, error } = await supabase
          .from('appUsers')
          .select('id, nombre, Apellidos, email')
          .in('id', opcionesNotif.usuarios_destino.filter(id => id !== creador.id))
          .eq('activo', true);

        if (!error && data) usuarios = data;
      }
    } else {
      // Admin: lógica por roles
      const rolesSeleccionados = [];
      if (opcionesNotif.notificar_admins) rolesSeleccionados.push(1);
      if (opcionesNotif.notificar_coordinadores) rolesSeleccionados.push(2);
      if (opcionesNotif.notificar_usuarios) rolesSeleccionados.push(3);

      if (rolesSeleccionados.length > 0) {
        const { data, error } = await supabase
          .from('appUsers')
          .select('id, nombre, Apellidos, email, rol')
          .in('rol', rolesSeleccionados)
          .neq('id', creador.id)
          .eq('activo', true);

        if (!error && data) usuarios = data;
      }
    }

    if (!usuarios.length) {
      logger.info('No hay usuarios para notificar nueva encuesta');
      return;
    }

    // Preparar variables para plantilla
    const variables = {
      titulo: encuesta.titulo,
      descripcion: encuesta.descripcion || 'Sin descripción',
      creador: `${creador.nombre} ${creador.Apellidos || ''}`.trim(),
      url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/encuestas?id=${encuesta.id}`
    };

    // Enviar notificación push a todos los usuarios seleccionados
    const notificacionesPush = usuarios.map(usuario => ({
      emisor_id: creador.id,
      receptor_id: usuario.id,
      tipo: 'nueva_encuesta',
      titulo: `Nueva encuesta: ${encuesta.titulo}`,
      contenido: `Hay una nueva encuesta "${encuesta.titulo}". ¡Tu opinión es importante!`,
      url: `/encuestas?id=${encuesta.id}`,
      canal: 'push'
    }));

    // Crear notificaciones push
    await Promise.allSettled(
      notificacionesPush.map(notif => notificacionesDAO.crearNotificacion(notif))
    );

    // Para email y WhatsApp, verificar configuraciones de usuario
    const usuariosConConfig = await Promise.all(
      usuarios.map(async (usuario) => {
        const configs = await notificacionesDAO.obtenerConfigNotificaciones(usuario.id);
        return { ...usuario, configs };
      })
    );

    // Enviar emails si están configurados
    const usuariosEmail = usuariosConConfig.filter(u =>
      u.configs.some(c => c.tipo_evento === 'nueva_encuesta' && c.canal === 'email' && c.activo)
    );

    if (usuariosEmail.length > 0) {
      const notificacionesEmail = usuariosEmail.map(usuario => ({
        emisor_id: creador.id,
        receptor_id: usuario.id,
        tipo: 'nueva_encuesta',
        titulo: `Nueva encuesta disponible: ${encuesta.titulo}`,
        contenido: '', // Se procesará con plantilla
        url: variables.url,
        canal: 'email',
        plantilla_codigo: 'nueva_encuesta',
        variables
      }));

      // Crear y encolar notificaciones email
      await Promise.allSettled(
        notificacionesEmail.map(async (notif) => {
          const creada = await notificacionesDAO.crearNotificacion(notif);
          await notificacionesDAO.encolarNotificacion(creada.id, 2);
        })
      );
    }

    // Enviar WhatsApp si están configurados
    const usuariosWhatsApp = usuariosConConfig.filter(u =>
      u.configs.some(c => c.tipo_evento === 'nueva_encuesta' && c.canal === 'whatsapp' && c.activo)
    );

    if (usuariosWhatsApp.length > 0) {
      const notificacionesWhatsApp = usuariosWhatsApp.map(usuario => ({
        emisor_id: creador.id,
        receptor_id: usuario.id,
        tipo: 'nueva_encuesta',
        titulo: `Nueva encuesta: ${encuesta.titulo}`,
        contenido: '', // Se procesará con plantilla
        url: variables.url,
        canal: 'whatsapp',
        plantilla_codigo: 'nueva_encuesta_whatsapp',
        variables: { ...variables, nombre: usuario.nombre }
      }));

      // Crear y encolar notificaciones WhatsApp
      await Promise.allSettled(
        notificacionesWhatsApp.map(async (notif) => {
          const creada = await notificacionesDAO.crearNotificacion(notif);
          await notificacionesDAO.encolarNotificacion(creada.id, 3); // Prioridad alta
        })
      );
    }

    logger.info({
      type: 'notificaciones_nueva_encuesta',
      encuestaId: encuesta.id,
      totalUsuarios: usuarios.length,
      pushEnviados: notificacionesPush.length,
      emailsEncolados: usuariosEmail.length,
      whatsappEncolados: usuariosWhatsApp.length
    }, 'Notificaciones de nueva encuesta enviadas');

  } catch (error) {
    logger.error({
      type: 'error_notificaciones_nueva_encuesta',
      encuestaId: encuesta.id,
      error: error.message
    }, 'Error al enviar notificaciones de nueva encuesta');
  }
}
