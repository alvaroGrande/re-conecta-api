import * as talleresDAO from "../DAO/talleresDAO.js";
import * as dashboardDAO from "../DAO/dashboardDAO.js";
import * as notificacionesDAO from "../DAO/notificacionesDAO.js";
import * as motivosDAO from "../DAO/motivosCancelacionDAO.js";
import { supabase } from "../DAO/connection.js";
import logger from '../logger.js';

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
    const talleres = await talleresDAO.obtenerTalleres();
    res.json(talleres);
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
    const nuevoTaller = await talleresDAO.crearTaller(req.body);

    dashboardDAO.registrarActividad(
      req.user?.id,
      'taller',
      'Taller creado',
      `Creó el taller: ${req.body.titulo || 'Sin título'}`
    ).catch(err => logger.error({ err }, 'Error al registrar actividad de taller'));

    res.status(201).json(nuevoTaller);
  } catch (error) {
    next(error);
  }
};

export const editarTaller = async (req, res, next) => {
  try {
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
