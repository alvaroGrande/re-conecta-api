import {
  getPermisosActuales,
  actualizarTodosLosPermisos,
  resetearPermisos,
} from '../config/rolePermissionsStore.js';
import { PERMISOS, ROLES } from '../config/permissions.js';
import { supabase } from '../DAO/connection.js';
import logger from '../logger.js';

const ROLES_VALIDOS = new Set(Object.values(ROLES));

/**
 * GET /api/roles-permisos
 * Devuelve el mapa { [rol]: string[] } con los permisos actuales de cada rol.
 */
export const getPermisos = async (req, res) => {
  try {
    res.json(await getPermisosActuales());
  } catch (error) {
    logger.error(`[ROLES] Error al obtener permisos: ${error.message}`);
    res.status(500).json({ message: 'Error al obtener permisos' });
  }
};

/**
 * GET /api/roles-permisos/disponibles
 * Catálogo completo de permisos desde la tabla permisos_catalogo,
 * con descripción, grupo e icono. Ordenado por grupo y posición.
 */
export const getPermisosDisponibles = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('permisos_catalogo')
      .select('permiso, descripcion, grupo, grupo_icono, orden_grupo, orden')
      .order('orden_grupo', { ascending: true })
      .order('orden',       { ascending: true });

    if (error) throw new Error(error.message);
    res.json(data);
  } catch (error) {
    logger.error(`[ROLES] Error al obtener catálogo: ${error.message}`);
    res.status(500).json({ message: 'Error al obtener el catálogo de permisos' });
  }
};

/**
 * PUT /api/roles-permisos
 * Reemplaza los permisos de todos los roles.
 * Body: { "2": ["talleres:ver", ...], "3": ["talleres:ver", ...] }
 * El rol Administrador (1) siempre mantiene todos los permisos.
 */
export const updatePermisos = (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return res.status(400).json({ message: 'El cuerpo debe ser un objeto { [rol]: string[] }' });
    }

    const permisosValidos = new Set(Object.values(PERMISOS));

    for (const [rolStr, permisos] of Object.entries(payload)) {
      const rolNum = Number(rolStr);
      if (!ROLES_VALIDOS.has(rolNum)) {
        return res.status(400).json({ message: `Rol inválido: ${rolStr}` });
      }
      if (!Array.isArray(permisos)) {
        return res.status(400).json({ message: `Los permisos del rol ${rolStr} deben ser un array` });
      }
      for (const p of permisos) {
        if (!permisosValidos.has(p)) {
          return res.status(400).json({ message: `Permiso desconocido: "${p}"` });
        }
      }
    }

    // El Administrador (rol 1) siempre tiene TODOS los permisos — se fuerza
    payload['1'] = Object.values(PERMISOS);

    actualizarTodosLosPermisos(payload);
    logger.info(`[ROLES] Permisos actualizados por usuario ${req.user?.id}`);
    res.json({ ok: true, message: 'Permisos actualizados correctamente' });
  } catch (error) {
    logger.error(`[ROLES] Error al actualizar permisos: ${error.message}`);
    res.status(500).json({ message: 'Error al guardar los permisos' });
  }
};

/**
 * DELETE /api/roles-permisos
 * Restaura los permisos a los valores por defecto definidos en permissions.js.
 */
export const resetPermisos = (req, res) => {
  try {
    resetearPermisos();
    logger.info(`[ROLES] Permisos restaurados a valores por defecto por usuario ${req.user?.id}`);
    res.json({ ok: true, message: 'Permisos restaurados a valores por defecto' });
  } catch (error) {
    logger.error(`[ROLES] Error al restaurar permisos: ${error.message}`);
    res.status(500).json({ message: 'Error al restaurar permisos' });
  }
};
