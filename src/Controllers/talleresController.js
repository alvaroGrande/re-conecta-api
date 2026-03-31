import * as talleresDAO from "../DAO/talleresDAO.js";
import * as dashboardDAO from "../DAO/dashboardDAO.js";
import * as notificacionesDAO from "../DAO/notificacionesDAO.js";
import * as motivosDAO from "../DAO/motivosCancelacionDAO.js";
import { getValoresByCategoria } from "../DAO/lovDAO.js";
import { supabase } from "../DAO/connection.js";
import logger from '../logger.js';

async function validarLOVs(modalidad, tipo_pago, res) {
  const [cursos, pagos] = await Promise.all([
    getValoresByCategoria('tipo_curso'),
    getValoresByCategoria('tipo_pago'),
  ])
  const codigosCursos = cursos.map(v => v.codigo)
  const codigosPagos  = pagos.map(v => v.codigo)
  if (modalidad && !codigosCursos.includes(modalidad)) {
    res.status(400).json({ error: `Modalidad "${modalidad}" no válida. Valores permitidos: ${codigosCursos.join(', ')}` })
    return false
  }
  if (tipo_pago && !codigosPagos.includes(tipo_pago)) {
    res.status(400).json({ error: `Tipo de pago "${tipo_pago}" no válido. Valores permitidos: ${codigosPagos.join(', ')}` })
    return false
  }
  return true
}

export const getMotivosCancelacion = async (req, res, next) => {
  try {
    const motivos = await motivosDAO.obtenerMotivosCancelacion();
    res.json(motivos);
  } catch (error) {
    next(error);
  }
};

export const getTalleres = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const result = await talleresDAO.obtenerTalleres({ page, limit });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getTallerPorId = async (req, res) => {
  try {
    const taller = await talleresDAO.obtenerTallerPorId(req.params.id);
    if (!taller) return res.status(404).json({ message: "Taller no encontrado" });
    res.json(taller);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const crearTaller = async (req, res, next) => {
  try {
    const { modalidad, tipo_pago } = req.body
    if (!await validarLOVs(modalidad, tipo_pago, res)) return

    // Inyectar creado_por para rastrear al coordinador o admin que crea el taller
    const nuevoTaller = await talleresDAO.crearTaller({
      ...req.body,
      creado_por: req.user.id,
    });

    dashboardDAO.registrarActividad(
      req.user?.id,
      'taller',
      'Taller creado',
      `Creó el taller: ${req.body.titulo || 'Sin título'}`
    ).catch(err => logger.error({ err }, 'Error al registrar actividad de taller'));

    // Notificaciones automáticas por nuevo taller
    enviarNotificacionesNuevoTaller(nuevoTaller, req.user).catch(err =>
      logger.error({ err }, 'Error al enviar notificaciones de nuevo taller')
    );

    res.status(201).json(nuevoTaller);
  } catch (error) {
    next(error);
  }
};

export const editarTaller = async (req, res, next) => {
  try {
    const { modalidad, tipo_pago } = req.body
    if (!await validarLOVs(modalidad, tipo_pago, res)) return

    const tallerEditado = await talleresDAO.editarTaller(req.params.id, req.body);
    if (!tallerEditado) return res.status(404).json({ message: "Taller no encontrado" });

    dashboardDAO.registrarActividad(
      req.user?.id,
      'taller',
      'Taller editado',
      `Editó el taller: ${tallerEditado.titulo || req.params.id}`
    ).catch(err => logger.error({ err }, 'Error al registrar actividad de edición de taller'));

    res.json(tallerEditado);
  } catch (error) {
    if (error.code === 'PGRST116') return res.status(404).json({ message: 'Taller no encontrado' });
    next(error);
  }
};

export const eliminarTaller = async (req, res, next) => {
  try {
    await talleresDAO.eliminarTaller(req.params.id);

    dashboardDAO.registrarActividad(
      req.user?.id,
      'taller',
      'Taller eliminado',
      `Eliminó el taller con id: ${req.params.id}`
    ).catch(err => logger.error({ err }, 'Error al registrar actividad de eliminación de taller'));

    res.json({ message: "Taller eliminado correctamente" });
  } catch (error) {
    next(error);
  }
};

export const activarTaller = async (req, res, next) => {
  try {
    const tallerActivado = await talleresDAO.activarTaller(req.params.id);
    if (!tallerActivado || (Array.isArray(tallerActivado) && tallerActivado.length === 0))
      return res.status(404).json({ message: 'Taller no encontrado' });
    res.json(Array.isArray(tallerActivado) ? tallerActivado[0] : tallerActivado);
  } catch (error) {
    if (error.code === 'PGRST116') return res.status(404).json({ message: 'Taller no encontrado' });
    next(error);
  }
};

export const desactivarTaller = async (req, res, next) => {
  try {
    const tallerDesactivado = await talleresDAO.desactivarTaller(req.params.id);
    if (!tallerDesactivado || (Array.isArray(tallerDesactivado) && tallerDesactivado.length === 0))
      return res.status(404).json({ message: 'Taller no encontrado' });
    res.json(Array.isArray(tallerDesactivado) ? tallerDesactivado[0] : tallerDesactivado);
  } catch (error) {
    if (error.code === 'PGRST116') return res.status(404).json({ message: 'Taller no encontrado' });
    next(error);
  }
};

/** Cancela el taller: lo archiva (con motivo) y elimina de activos */
export const cancelarTaller = async (req, res, next) => {
  try {
    const tallerId = req.params.id;
    const adminId = req.user?.id;
    const motivo   = req.body?.motivo?.trim()   || null;
    const motivoId = req.body?.motivo_id        ?? null;

    const taller = await talleresDAO.obtenerTallerPorId(tallerId);
    if (!taller) return res.status(404).json({ message: 'Taller no encontrado' });

    // Resolver el nombre del motivo para la notificación (si viene motivoId)
    let nombreMotivo = motivo;
    if (motivoId) {
      const motivos = await motivosDAO.obtenerMotivosCancelacion();
      const m = motivos.find(x => x.id === motivoId);
      if (m) nombreMotivo = [m.nombre, motivo].filter(Boolean).join('. ');
    }

    // Archivar el taller (mueve inscripciones al archivo, borra el taller activo)
    const afectados = await talleresDAO.archivarTallerCancelado(taller, adminId, motivo, motivoId);

    // Notificar a cada usuario afectado (fire-and-forget)
    const io = req.io;
    const contenidoNotif = nombreMotivo
      ? `El taller "${taller.titulo}" ha sido cancelado. Motivo: ${nombreMotivo}`
      : `El taller "${taller.titulo}" ha sido cancelado. Has sido dado de baja automáticamente.`;

    for (const item of afectados) {
      if (item.usuario?.id) {
        notificacionesDAO.crearNotificacion({
          emisor_id: adminId,
          receptor_id: item.usuario.id,
          tipo: 'taller',
          titulo: `Taller cancelado: ${taller.titulo}`,
          contenido: contenidoNotif,
        }).then(notificacion => {
          if (io) {
            io.to(`user_${item.usuario.id}`).emit('nueva_notificacion', notificacion);
          }
        }).catch(err => logger.error({ err, usuarioId: item.usuario.id }, 'Error al notificar cancelación de taller'));
      }
    }

    dashboardDAO.registrarActividad(
      adminId,
      'taller',
      'Taller cancelado',
      `Canceló el taller "${taller.titulo}" (${afectados.length} usuario(s) desinscrito(s))${nombreMotivo ? '. Motivo: ' + nombreMotivo : ''}`
    ).catch(err => logger.error({ err }, 'Error al registrar actividad de cancelación'));

    res.json({ message: 'Taller cancelado correctamente', desinscritosTotales: afectados.length });
  } catch (error) {
    next(error);
  }
};

// ─── Inscripciones ───────────────────────────────────────────────────────────

/** El usuario autenticado se inscribe a sí mismo */
export const inscribirTaller = async (req, res, next) => {
  try {
    const usuarioId = req.user?.id;
    if (!usuarioId) return res.status(401).json({ message: "No autenticado" });

    const inscritos = await talleresDAO.inscribirUsuario(req.params.id, usuarioId, null);
    res.json({ inscritos });
  } catch (error) {
    if (error.message.includes('ya está inscrito') || error.message.includes('aforo')) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
};

/** El usuario autenticado se desinscribe a sí mismo */
export const desinscribirTaller = async (req, res, next) => {
  try {
    const usuarioId = req.user?.id;
    if (!usuarioId) return res.status(401).json({ message: "No autenticado" });

    const inscritos = await talleresDAO.desinscribirUsuario(req.params.id, usuarioId);
    res.json({ inscritos });
  } catch (error) {
    next(error);
  }
};

/**
 * Monitor/Admin inscribe a un usuario en un taller.
 * El monitor solo puede inscribir a usuarios que supervisa.
 */
export const inscribirUsuarioSupervisor = async (req, res, next) => {
  try {
    const { tallerId, usuarioId } = req.params;
    const supervisorId = req.user?.id;
    const rol = req.user?.rol;

    if (rol === 2) {
      const { data: relacion } = await supabase
        .from('usuarios_instructores')
        .select('id')
        .eq('instructor_id', supervisorId)
        .eq('usuario_id', usuarioId)
        .maybeSingle();

      if (!relacion) {
        return res.status(403).json({ message: "No supervisa a este usuario" });
      }
    }

    const inscritos = await talleresDAO.inscribirUsuario(tallerId, usuarioId, supervisorId);
    res.json({ inscritos });
  } catch (error) {
    if (error.message.includes('ya está inscrito') || error.message.includes('aforo')) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
};

// ─── Notificaciones automáticas ──────────────────────────────────────────────

/**
 * Enviar notificaciones automáticas cuando se crea un nuevo taller
 * @param {Object} taller - Datos del taller creado
 * @param {Object} creador - Usuario que creó el taller
 */
async function enviarNotificacionesNuevoTaller(taller, creador) {
  try {
    // Obtener todos los usuarios activos (excluyendo al creador)
    const { data: usuarios, error } = await supabase
      .from('appUsers')
      .select('id, nombre, Apellidos, email')
      .neq('id', creador.id)
      .eq('activo', true);

    if (error || !usuarios?.length) {
      logger.warn({ error }, 'No se pudieron obtener usuarios para notificaciones de nuevo taller');
      return;
    }

    // Preparar variables para plantilla
    const variables = {
      titulo: taller.titulo,
      descripcion: taller.descripcion || 'Sin descripción',
      fecha: new Date(taller.fecha).toLocaleDateString('es-ES'),
      duracion: taller.duracion,
      aforo: taller.aforo,
      modalidad: taller.modalidad,
      tipo_pago: taller.tipo_pago,
      creador: `${creador.nombre} ${creador.Apellidos || ''}`.trim(),
      url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/talleres`
    };

    // Enviar notificación push a todos los usuarios
    const notificacionesPush = usuarios.map(usuario => ({
      emisor_id: creador.id,
      receptor_id: usuario.id,
      tipo: 'nuevo_taller',
      titulo: `Nuevo taller: ${taller.titulo}`,
      contenido: `Se ha publicado un nuevo taller "${taller.titulo}" para el ${variables.fecha}. ¡Échale un vistazo!`,
      url: `/talleres`,
      canal: 'push'
    }));

    // Crear notificaciones push (no se encolan, se envían inmediatamente)
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
      u.configs.some(c => c.tipo_evento === 'nuevo_taller' && c.canal === 'email' && c.activo)
    );

    if (usuariosEmail.length > 0) {
      const notificacionesEmail = usuariosEmail.map(usuario => ({
        emisor_id: creador.id,
        receptor_id: usuario.id,
        tipo: 'nuevo_taller',
        titulo: `Nuevo taller disponible: ${taller.titulo}`,
        contenido: '', // Se procesará con plantilla
        url: variables.url,
        canal: 'email',
        plantilla_codigo: 'nuevo_taller',
        variables
      }));

      // Crear y encolar notificaciones email
      await Promise.allSettled(
        notificacionesEmail.map(async (notif) => {
          const creada = await notificacionesDAO.crearNotificacion(notif);
          await notificacionesDAO.encolarNotificacion(creada.id, 2); // Prioridad normal
        })
      );
    }

    // Enviar WhatsApp si están configurados
    const usuariosWhatsApp = usuariosConConfig.filter(u =>
      u.configs.some(c => c.tipo_evento === 'nuevo_taller' && c.canal === 'whatsapp' && c.activo)
    );

    if (usuariosWhatsApp.length > 0) {
      const notificacionesWhatsApp = usuariosWhatsApp.map(usuario => ({
        emisor_id: creador.id,
        receptor_id: usuario.id,
        tipo: 'nuevo_taller',
        titulo: `Nuevo taller: ${taller.titulo}`,
        contenido: '', // Se procesará con plantilla
        url: variables.url,
        canal: 'whatsapp',
        plantilla_codigo: 'nuevo_taller_whatsapp',
        variables: { ...variables, nombre: usuario.nombre }
      }));

      // Crear y encolar notificaciones WhatsApp
      await Promise.allSettled(
        notificacionesWhatsApp.map(async (notif) => {
          const creada = await notificacionesDAO.crearNotificacion(notif);
          await notificacionesDAO.encolarNotificacion(creada.id, 3); // Prioridad alta para WhatsApp
        })
      );
    }

    logger.info({
      type: 'notificaciones_nuevo_taller',
      tallerId: taller.id,
      totalUsuarios: usuarios.length,
      pushEnviados: notificacionesPush.length,
      emailsEncolados: usuariosEmail.length,
      whatsappEncolados: usuariosWhatsApp.length
    }, 'Notificaciones de nuevo taller enviadas');

  } catch (error) {
    logger.error({
      type: 'error_notificaciones_nuevo_taller',
      tallerId: taller.id,
      error: error.message
    }, 'Error al enviar notificaciones de nuevo taller');
  }
}

/**
 * Monitor/Admin desinscribe a un usuario de un taller.
 */
export const desinscribirUsuarioSupervisor = async (req, res, next) => {
  try {
    const { tallerId, usuarioId } = req.params;
    const supervisorId = req.user?.id;
    const rol = req.user?.rol;

    if (rol === 2) {
      const { data: relacion } = await supabase
        .from('usuarios_instructores')
        .select('id')
        .eq('instructor_id', supervisorId)
        .eq('usuario_id', usuarioId)
        .maybeSingle();

      if (!relacion) {
        return res.status(403).json({ message: "No supervisa a este usuario" });
      }
    }

    const inscritos = await talleresDAO.desinscribirUsuario(tallerId, usuarioId);

    dashboardDAO.registrarActividad(
      supervisorId,
      'taller',
      'Usuario desinscrito de taller',
      `Desinscribió al usuario ${usuarioId} del taller ${tallerId}`
    ).catch(err => logger.error({ err }, 'Error al registrar actividad de desinscripción por supervisor'));

    res.json({ inscritos });
  } catch (error) {
    next(error);
  }
};

/** Lista de usuarios inscritos en un taller (admin/monitor) */
export const getInscritos = async (req, res, next) => {
  try {
    const inscritos = await talleresDAO.obtenerInscritos(req.params.id);
    res.json(inscritos);
  } catch (error) {
    next(error);
  }
};

/** Comprueba si el usuario autenticado está inscrito en el taller */
export const getMiInscripcion = async (req, res, next) => {
  try {
    const usuarioId = req.user?.id;
    if (!usuarioId) return res.status(401).json({ message: "No autenticado" });
    const inscrito = await talleresDAO.verificarInscripcion(req.params.id, usuarioId);
    res.json({ inscrito });
  } catch (error) {
    next(error);
  }
};
