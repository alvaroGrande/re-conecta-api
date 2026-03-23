import * as archivadosDAO from '../DAO/talleresArchivadosDAO.js';

/**
 * GET /api/talleres/archivados
 * Query params: anio, mes, page, limit
 */
export const getTalleresArchivados = async (req, res, next) => {
  try {
    const { anio, mes, page = 1, limit = 20 } = req.query;
    const resultado = await archivadosDAO.obtenerTalleresArchivados({
      anio: anio ? parseInt(anio) : undefined,
      mes:  mes  ? parseInt(mes)  : undefined,
      page: parseInt(page),
      limit: parseInt(limit),
    });
    res.json(resultado);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/talleres/archivados/resumen
 * Devuelve el resumen agrupado por año/mes
 */
export const getResumenArchivados = async (req, res, next) => {
  try {
    const resumen = await archivadosDAO.obtenerResumenPorPeriodo();
    res.json(resumen);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/talleres/archivados/:id
 * Detalle completo: taller + lista inscripciones con asistencia
 */
export const getTallerArchivadoDetalle = async (req, res, next) => {
  try {
    const detalle = await archivadosDAO.obtenerTallerArchivadoDetalle(req.params.id);
    res.json(detalle);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/talleres/archivados/:id/asistencia/:usuarioId
 * Body: { asistio: true|false }
 * Permite marcar o desmarcar la asistencia de un usuario
 */
export const patchAsistencia = async (req, res, next) => {
  try {
    const { id, usuarioId } = req.params;
    const { asistio } = req.body;
    if (typeof asistio !== 'boolean') {
      return res.status(400).json({ message: 'El campo asistio debe ser true o false' });
    }
    const resultado = await archivadosDAO.registrarAsistencia(id, usuarioId, asistio);
    res.json(resultado);
  } catch (error) {
    next(error);
  }
};
