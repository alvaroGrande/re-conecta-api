import * as dashboardDAO from '../DAO/dashboardDAO.js';
import logger from '../logger.js';

/**
 * Obtener estadísticas generales del dashboard
 */
export const getEstadisticas = async (req, res, next) => {
  try {
    // Solo admin puede ver estadísticas
    if (req.user.rol !== 1) {
      return res.status(403).json({ message: 'No tienes permisos para ver estadísticas' });
    }

    const startTime = Date.now();
    const resultado = await dashboardDAO.obtenerEstadisticasDashboard();
    const duration = Date.now() - startTime;

    res.setHeader('X-Cache', resultado.fromCache ? 'HIT' : 'MISS');
    res.setHeader('X-Response-Time', `${duration}ms`);
    res.json(resultado.data);
  } catch (error) {
    logger.error(`[DASHBOARD] Error al obtener estadísticas: ${error.message}`);
    next(error);
  }
};

/**
 * Obtener estadísticas de usuarios
 */
export const getEstadisticasUsuarios = async (req, res, next) => {
  try {
    if (req.user.rol !== 1) {
      return res.status(403).json({ message: 'No tienes permisos' });
    }

    const startTime = Date.now();
    const resultado = await dashboardDAO.obtenerEstadisticasUsuarios();
    const duration = Date.now() - startTime;
    
    // Headers informativos
    res.setHeader('X-Cache', resultado.fromCache ? 'HIT' : 'MISS');
    res.setHeader('X-Response-Time', `${duration}ms`);
    
    // Log informativo
    logger.info({
      endpoint: 'dashboard/estadisticas/usuarios',
      cache: resultado.fromCache ? 'HIT' : 'MISS',
      duration: `${duration}ms`
    });
    
    res.json(resultado.data);
  } catch (error) {
    logger.error(`[DASHBOARD] Error al obtener estadísticas de usuarios: ${error.message}`);
    next(error);
  }
};

/**
 * Obtener estadísticas de talleres
 */
export const getEstadisticasTalleres = async (req, res, next) => {
  try {
    if (req.user.rol !== 1) {
      return res.status(403).json({ message: 'No tienes permisos' });
    }

    const startTime = Date.now();
    const resultado = await dashboardDAO.obtenerEstadisticasTalleres();
    const duration = Date.now() - startTime;
    
    // Headers informativos
    res.setHeader('X-Cache', resultado.fromCache ? 'HIT' : 'MISS');
    res.setHeader('X-Response-Time', `${duration}ms`);
    
    // Log informativo
    logger.info({
      endpoint: 'dashboard/estadisticas/talleres',
      cache: resultado.fromCache ? 'HIT' : 'MISS',
      duration: `${duration}ms`
    });
    
    res.json(resultado.data);
  } catch (error) {
    logger.error(`[DASHBOARD] Error al obtener estadísticas de talleres: ${error.message}`);
    next(error);
  }
};

/**
 * Obtener estadísticas de encuestas
 */
export const getEstadisticasEncuestas = async (req, res, next) => {
  try {
    if (req.user.rol !== 1) {
      return res.status(403).json({ message: 'No tienes permisos' });
    }

    const startTime = Date.now();
    const resultado = await dashboardDAO.obtenerEstadisticasEncuestas();
    const duration = Date.now() - startTime;
    
    // Headers informativos
    res.setHeader('X-Cache', resultado.fromCache ? 'HIT' : 'MISS');
    res.setHeader('X-Response-Time', `${duration}ms`);
    
    // Log informativo
    logger.info({
      endpoint: 'dashboard/estadisticas/encuestas',
      cache: resultado.fromCache ? 'HIT' : 'MISS',
      duration: `${duration}ms`
    });
    
    res.json(resultado.data);
  } catch (error) {
    logger.error(`[DASHBOARD] Error al obtener estadísticas de encuestas: ${error.message}`);
    next(error);
  }
};

/**
 * Obtener distribución de usuarios por rol
 */
export const getDistribucionRoles = async (req, res, next) => {
  try {
    if (req.user.rol !== 1) {
      return res.status(403).json({ message: 'No tienes permisos' });
    }

    const startTime = Date.now();
    const resultado = await dashboardDAO.obtenerDistribucionRoles();
    const duration = Date.now() - startTime;

    res.setHeader('X-Cache', resultado.fromCache ? 'HIT' : 'MISS');
    res.setHeader('X-Response-Time', `${duration}ms`);
    res.json(resultado.data);
  } catch (error) {
    logger.error(`[DASHBOARD] Error al obtener distribución de roles: ${error.message}`);
    next(error);
  }
};

/**
 * Obtener actividad de los últimos N días
 */
export const getActividadPorDias = async (req, res, next) => {
  try {
    if (req.user.rol !== 1) {
      return res.status(403).json({ message: 'No tienes permisos' });
    }

    const dias = parseInt(req.query.dias) || 7;
    const startTime = Date.now();
    const resultado = await dashboardDAO.obtenerActividadPorDias(dias);
    const duration = Date.now() - startTime;

    res.setHeader('X-Cache', resultado.fromCache ? 'HIT' : 'MISS');
    res.setHeader('X-Response-Time', `${duration}ms`);
    res.json(resultado.data);
  } catch (error) {
    logger.error(`[DASHBOARD] Error al obtener actividad por días: ${error.message}`);
    next(error);
  }
};

/**
 * Obtener usuarios conectados en tiempo real
 */
export const getUsuariosConectados = async (req, res, next) => {
  try {
    if (req.user.rol !== 1) {
      return res.status(403).json({ message: 'No tienes permisos' });
    }

    const usuarios = await dashboardDAO.obtenerUsuariosConectados();
    res.json(usuarios);
  } catch (error) {
    logger.error(`[DASHBOARD] Error al obtener usuarios conectados: ${error.message}`);
    next(error);
  }
};

/**
 * Obtener actividad reciente del sistema o de un usuario específico
 */
export const getActividadReciente = async (req, res, next) => {
  try {
    const rawId = req.params.id || null;
    const limite = parseInt(req.query.limite) || 10;
    const dias   = parseInt(req.query.dias)   || 7;

    // Los admins pueden ver cualquier actividad;
    // el resto solo puede consultar la suya propia (comparamos como strings para evitar
    // problemas de tipo: el JWT puede devolver el id como number o string)
    if (req.user.rol !== 1) {
      if (!rawId || String(req.user.id) !== String(rawId)) {
        return res.status(403).json({ message: 'No tienes permisos' });
      }
    }

    const actividad = rawId
      ? await dashboardDAO.obtenerActividadUsuario(rawId, dias)
      : (await dashboardDAO.obtenerActividadReciente(limite)).data;

    res.json(actividad);
  } catch (error) {
    logger.error(`[DASHBOARD] Error al obtener actividad: ${error.message}`);
    next(error);
  }
};
