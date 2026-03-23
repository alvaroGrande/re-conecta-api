import { supabase } from "./connection.js";
import logger from "../logger.js";
import { executeWithTiming } from "../utils/queryLogger.js";

/**
 * Crear una nueva notificación
 * @param {Object} notificacion - Datos de la notificación
 * @returns {Object} Notificación creada
 */
export const crearNotificacion = async (notificacion) => {
  return executeWithTiming('crearNotificacion', async () => {
    const { emisor_id, receptor_id, tipo, titulo, contenido, url } = notificacion;

    const { data, error } = await supabase
      .from('notificaciones')
      .insert([
        {
          emisor_id,
          receptor_id,
          tipo,
          titulo,
          contenido,
          url
        }
      ])
      .select(`
        *,
        emisor:appUsers!emisor_id (
          id,
          nombre,
          Apellidos,
          email,
          rol
        ),
        receptor:appUsers!receptor_id (
          id,
          nombre,
          Apellidos,
          email,
          rol
        )
      `)
      .single();

    if (error) throw new Error("Error al crear notificación: " + error.message);

    return data;
  });
};

/**
 * Enviar notificación a múltiples usuarios
 * @param {string} emisorId - ID del emisor
 * @param {Array<string>} receptoresIds - Array de IDs de receptores
 * @param {Object} contenido - Contenido de la notificación
 * @returns {Array} Notificaciones creadas
 */
export const enviarNotificacionMasiva = async (emisorId, receptoresIds, contenido) => {
  return executeWithTiming('enviarNotificacionMasiva', async () => {
    const { tipo, titulo, contenido: texto, url } = contenido;

    const notificaciones = receptoresIds.map(receptorId => ({
      emisor_id: emisorId,
      receptor_id: receptorId,
      tipo,
      titulo,
      contenido: texto,
      url
    }));

    const { data, error } = await supabase
      .from('notificaciones')
      .insert(notificaciones)
      .select(`
        *,
        emisor:appUsers!emisor_id (
          id,
          nombre,
          Apellidos,
          email,
          rol
        )
      `);

    if (error) throw new Error("Error al enviar notificaciones masivas: " + error.message);

    return data;
  });
};

/**
 * Obtener notificaciones de un usuario
 * @param {string} usuarioId - ID del usuario
 * @param {boolean} soloNoLeidas - Si es true, solo devuelve las no leídas
 * @param {number} limite - Límite de notificaciones a devolver
 * @returns {Array} Lista de notificaciones
 */
export const obtenerNotificaciones = async (usuarioId, soloNoLeidas = false, limite = 50) => {
  return executeWithTiming('obtenerNotificaciones', async () => {
    let query = supabase
      .from('notificaciones')
      .select(`
        *,
        emisor:appUsers!emisor_id (
          id,
          nombre,
          Apellidos,
          email,
          rol
        )
      `)
      .eq('receptor_id', usuarioId)
      .order('created_at', { ascending: false })
      .limit(limite);

    if (soloNoLeidas) {
      query = query.eq('leida', false);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    return data;
  });
};

/**
 * Contar notificaciones no leídas
 * @param {string} usuarioId - ID del usuario
 * @returns {number} Cantidad de notificaciones no leídas
 */
export const contarNoLeidas = async (usuarioId) => {
  return executeWithTiming('contarNoLeidas', async () => {
    const { count, error } = await supabase
      .from('notificaciones')
      .select('*', { count: 'exact', head: true })
      .eq('receptor_id', usuarioId)
      .eq('leida', false);

    if (error) throw new Error(error.message);

    return count || 0;
  });
};

/**
 * Marcar notificación como leída
 * @param {number} notificacionId - ID de la notificación
 * @param {string} usuarioId - ID del usuario (para verificar permisos)
 * @returns {Object} Notificación actualizada
 */
export const marcarComoLeida = async (notificacionId, usuarioId) => {
  return executeWithTiming('marcarComoLeida', async () => {
    const { data, error } = await supabase
      .from('notificaciones')
      .update({
        leida: true,
        fecha_lectura: new Date().toISOString()
      })
      .eq('id', notificacionId)
      .eq('receptor_id', usuarioId) // Solo el receptor puede marcarla como leída
      .select()
      .single();

    if (error) throw new Error("Error al marcar como leída: " + error.message);

    return data;
  });
};

/**
 * Marcar todas las notificaciones como leídas
 * @param {string} usuarioId - ID del usuario
 * @returns {number} Cantidad de notificaciones actualizadas
 */
export const marcarTodasComoLeidas = async (usuarioId) => {
  return executeWithTiming('marcarTodasComoLeidas', async () => {
    const { data, error } = await supabase
      .from('notificaciones')
      .update({
        leida: true,
        fecha_lectura: new Date().toISOString()
      })
      .eq('receptor_id', usuarioId)
      .eq('leida', false)
      .select();

    if (error) throw new Error("Error al marcar todas como leídas: " + error.message);

    return data?.length || 0;
  });
};

/**
 * Eliminar una notificación
 * @param {number} notificacionId - ID de la notificación
 * @param {string} usuarioId - ID del usuario (para verificar permisos)
 * @returns {boolean} True si se eliminó correctamente
 */
export const eliminarNotificacion = async (notificacionId, usuarioId) => {
  return executeWithTiming('eliminarNotificacion', async () => {
    const { error } = await supabase
      .from('notificaciones')
      .delete()
      .eq('id', notificacionId)
      .eq('receptor_id', usuarioId); // Solo el receptor puede eliminarla

    if (error) throw new Error("Error al eliminar notificación: " + error.message);

    return true;
  });
};

/**
 * Eliminar notificaciones antiguas leídas
 * @param {number} diasAntiguedad - Días de antigüedad para considerar una notificación como antigua
 * @returns {number} Cantidad de notificaciones eliminadas
 */
export const eliminarNotificacionesAntiguas = async (diasAntiguedad = 30) => {
  return executeWithTiming('eliminarNotificacionesAntiguas', async () => {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - diasAntiguedad);

    const { data, error } = await supabase
      .from('notificaciones')
      .delete()
      .eq('leida', true)
      .lt('fecha_lectura', fechaLimite.toISOString())
      .select();

    if (error) throw new Error("Error al eliminar notificaciones antiguas: " + error.message);

    return data?.length || 0;
  });
};

/**
 * Obtener notificaciones enviadas por un usuario (historial)
 * @param {string} usuarioId - ID del usuario
 * @param {number} limite - Límite de notificaciones a devolver
 * @returns {Array} Lista de notificaciones enviadas
 */
export const obtenerNotificacionesEnviadas = async (usuarioId, limite = 50) => {
  return executeWithTiming('obtenerNotificacionesEnviadas', async () => {
    const { data, error } = await supabase
      .from('notificaciones')
      .select(`
        *,
        receptor:appUsers!receptor_id (
          id,
          nombre,
          Apellidos,
          email,
          rol
        )
      `)
      .eq('emisor_id', usuarioId)
      .order('created_at', { ascending: false })
      .limit(limite);

    if (error) throw new Error(error.message);

    return data;
  });
};
