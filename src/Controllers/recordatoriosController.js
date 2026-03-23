import * as recordatoriosDAO from '../DAO/recordatoriosDAO.js';
import * as dashboardDAO from '../DAO/dashboardDAO.js';
import logger from '../logger.js';

/**
 * GET /api/recordatorios
 * Query params (solo para supervisores/admins):
 *   show_admin  - '0' | '1'  (default '1')
 *   show_users  - '0' | '1'  (default '1')
 *   usuario_id  - UUID del usuario a filtrar
 */
export const getRecordatorios = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const rol = req.user.rol;

    const filtros = {
      show_admin: req.query.show_admin !== '0',
      show_users: req.query.show_users !== '0',
      usuario_id: req.query.usuario_id || null
    };

    const recordatorios = await recordatoriosDAO.obtenerRecordatorios(usuarioId, rol, filtros);
    res.json({ data: recordatorios });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/recordatorios
 * Body: { titulo, descripcion?, fecha, hora }
 */
export const crearRecordatorio = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const rol = req.user.rol;
    const { titulo, descripcion, fecha, hora } = req.body;

    if (!titulo || !fecha || !hora) {
      return res.status(400).json({ message: 'Faltan campos requeridos: titulo, fecha, hora' });
    }

    // Tipo determinado por el rol del creador
    const tipo = (rol === 1 || rol === 2) ? 'admin' : 'user';

    const recordatorio = await recordatoriosDAO.crearRecordatorio({
      usuario_id: usuarioId,
      titulo,
      descripcion: descripcion || null,
      fecha,
      hora,
      tipo
    });

    logger.info(`Recordatorio creado: id=${recordatorio.id} usuario=${usuarioId}`);

    // Fire-and-forget: no bloquea la respuesta
    dashboardDAO.registrarActividad(
      usuarioId,
      'recordatorio',
      'Recordatorio creado',
      `Creó el recordatorio: ${titulo} para el ${fecha} a las ${hora}`
    ).catch(actError => logger.error({ actError }, 'Error al registrar actividad de recordatorio'));

    res.status(201).json({ data: recordatorio });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/recordatorios/:id
 * Body: { titulo?, descripcion?, fecha?, hora? }
 */
export const actualizarRecordatorio = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    const { titulo, descripcion, fecha, hora } = req.body;
    const actualizado = await recordatoriosDAO.actualizarRecordatorio(id, usuarioId, {
      titulo, descripcion, fecha, hora
    });

    logger.info(`Recordatorio actualizado: id=${id} por usuario=${usuarioId}`);
    res.json({ data: actualizado });
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ message: error.message });
    }
    if (error.message === 'Recordatorio no encontrado') {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

/**
 * DELETE /api/recordatorios/:id
 */
export const eliminarRecordatorio = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const rol = req.user.rol;
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    // Obtener título antes de borrar para el registro de actividad
    const recordatorios = await recordatoriosDAO.obtenerRecordatorios(usuarioId, rol);
    const recordatorio = recordatorios.find(r => r.id === id);
    const tituloRecordatorio = recordatorio?.titulo || `ID ${id}`;

    await recordatoriosDAO.eliminarRecordatorio(id, usuarioId, rol);

    logger.info(`Recordatorio eliminado: id=${id} por usuario=${usuarioId}`);

    // Fire-and-forget: no bloquea la respuesta
    dashboardDAO.registrarActividad(
      usuarioId,
      'recordatorio',
      'Recordatorio eliminado',
      `Eliminó el recordatorio: ${tituloRecordatorio}`
    ).catch(actError => logger.error({ actError }, 'Error al registrar actividad de eliminación de recordatorio'));

    res.json({ message: 'Recordatorio eliminado correctamente' });
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ message: error.message });
    }
    if (error.message === 'Recordatorio no encontrado') {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};
