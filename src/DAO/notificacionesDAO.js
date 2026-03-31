import { supabase } from "./connection.js";
import logger from "../logger.js";
import { executeWithTiming } from "../utils/queryLogger.js";

/**
 * Crear una nueva notificación (extendida para múltiples canales)
 * @param {Object} notificacion - Datos de la notificación
 * @returns {Object} Notificación creada
 */
export const crearNotificacion = async (notificacion) => {
  return executeWithTiming('crearNotificacion', async () => {
    const {
      emisor_id,
      receptor_id,
      tipo,
      titulo,
      contenido,
      url,
      canal = 'push',
      plantilla_id,
      datos_adicionales
    } = notificacion;

    const { data, error } = await supabase
      .from('notificaciones')
      .insert([{
        emisor_id,
        receptor_id,
        tipo,
        titulo,
        contenido,
        url,
        canal,
        plantilla_id,
        datos_adicionales
      }])
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
 * Obtener notificaciones de un usuario
 * @param {string} usuarioId - ID del usuario
 * @param {Object} filtros - Filtros opcionales
 * @returns {Array} Lista de notificaciones
 */
export const obtenerNotificaciones = async (usuarioId, filtros = {}) => {
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
      .order('created_at', { ascending: false });

    if (filtros.leida !== undefined) {
      query = query.eq('leida', filtros.leida);
    }

    if (filtros.tipo) {
      query = query.eq('tipo', filtros.tipo);
    }

    if (filtros.canal) {
      query = query.eq('canal', filtros.canal);
    }

    if (filtros.limit) {
      query = query.limit(filtros.limit);
    }

    const { data, error } = await query;

    if (error) throw new Error("Error al obtener notificaciones: " + error.message);

    return data;
  });
};

/**
 * Marcar notificación como leída
 * @param {string} notificacionId - ID de la notificación
 * @param {string} usuarioId - ID del usuario (para verificar permisos)
 * @returns {Object} Notificación actualizada
 */
export const marcarLeida = async (notificacionId, usuarioId) => {
  return executeWithTiming('marcarLeida', async () => {
    const { data, error } = await supabase
      .from('notificaciones')
      .update({
        leida: true,
        fecha_lectura: new Date().toISOString()
      })
      .eq('id', notificacionId)
      .eq('receptor_id', usuarioId)
      .select()
      .single();

    if (error) throw new Error("Error al marcar notificación como leída: " + error.message);

    return data;
  });
};

/**
 * Obtener plantilla por código
 * @param {string} codigo - Código de la plantilla
 * @param {string} canal - Canal (opcional)
 * @returns {Object} Plantilla
 */
export const obtenerPlantilla = async (codigo, canal) => {
  return executeWithTiming('obtenerPlantilla', async () => {
    let query = supabase
      .from('notificaciones_plantillas')
      .select('*')
      .eq('codigo', codigo)
      .eq('activo', true);

    if (canal) {
      query = query.eq('canal', canal);
    }

    const { data, error } = await query.single();

    if (error) throw new Error("Error al obtener plantilla: " + error.message);

    return data;
  });
};

/**
 * Obtener configuraciones de notificación de un usuario
 * @param {string} usuarioId - ID del usuario
 * @returns {Array} Configuraciones
 */
export const obtenerConfigNotificaciones = async (usuarioId) => {
  return executeWithTiming('obtenerConfigNotificaciones', async () => {
    const { data, error } = await supabase
      .from('notificaciones_config')
      .select('*')
      .eq('usuario_id', usuarioId);

    if (error) throw new Error("Error al obtener configuraciones: " + error.message);

    return data;
  });
};

/**
 * Actualizar configuración de notificación
 * @param {string} usuarioId - ID del usuario
 * @param {string} tipoEvento - Tipo de evento
 * @param {string} canal - Canal
 * @param {boolean} activo - Estado
 * @returns {Object} Configuración actualizada
 */
export const actualizarConfigNotificacion = async (usuarioId, tipoEvento, canal, activo) => {
  return executeWithTiming('actualizarConfigNotificacion', async () => {
    const { data, error } = await supabase
      .from('notificaciones_config')
      .upsert({
        usuario_id: usuarioId,
        tipo_evento: tipoEvento,
        canal: canal,
        activo: activo
      })
      .select()
      .single();

    if (error) throw new Error("Error al actualizar configuración: " + error.message);

    return data;
  });
};

/**
 * Añadir notificación a la cola de procesamiento
 * @param {string} notificacionId - ID de la notificación
 * @param {number} prioridad - Prioridad (1-4)
 * @param {Date} programadoPara - Fecha de envío (opcional)
 * @returns {Object} Elemento de cola creado
 */
export const encolarNotificacion = async (notificacionId, prioridad = 1, programadoPara = null) => {
  return executeWithTiming('encolarNotificacion', async () => {
    const { data, error } = await supabase
      .from('notificaciones_cola')
      .insert([{
        notificacion_id: notificacionId,
        prioridad: prioridad,
        programado_para: programadoPara || new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw new Error("Error al encolar notificación: " + error.message);

    return data;
  });
};

/**
 * Obtener notificaciones pendientes de la cola
 * @param {number} limit - Límite de resultados
 * @returns {Array} Elementos de cola pendientes
 */
export const obtenerColaPendiente = async (limit = 50) => {
  return executeWithTiming('obtenerColaPendiente', async () => {
    const { data, error } = await supabase
      .from('notificaciones_cola')
      .select(`
        *,
        notificacion:notificaciones (
          *,
          receptor:appUsers!receptor_id (
            id,
            nombre,
            Apellidos,
            email,
            rol
          )
        )
      `)
      .eq('estado', 'pendiente')
      .lte('programado_para', new Date().toISOString())
      .order('prioridad', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw new Error("Error al obtener cola pendiente: " + error.message);

    return data;
  });
};

/**
 * Actualizar estado de elemento en cola
 * @param {string} colaId - ID del elemento en cola
 * @param {string} estado - Nuevo estado
 * @param {string} errorMensaje - Mensaje de error (opcional)
 * @returns {Object} Elemento actualizado
 */
export const actualizarEstadoCola = async (colaId, estado, errorMensaje = null) => {
  return executeWithTiming('actualizarEstadoCola', async () => {
    const updateData = {
      estado: estado,
      procesado_en: new Date().toISOString()
    };

    if (estado === 'fallida' && errorMensaje) {
      updateData.error_mensaje = errorMensaje;
    }

    const { data, error } = await supabase
      .from('notificaciones_cola')
      .update(updateData)
      .eq('id', colaId)
      .select()
      .single();

    if (error) throw new Error("Error al actualizar estado de cola: " + error.message);

    return data;
  });
};

/**
 * Contar notificaciones no leídas de un usuario
 * @param {string} usuarioId - ID del usuario
 * @returns {number} Número de notificaciones no leídas
 */
export const contarNoLeidas = async (usuarioId) => {
  return executeWithTiming('contarNoLeidas', async () => {
    const { count, error } = await supabase
      .from('notificaciones')
      .select('*', { count: 'exact', head: true })
      .eq('receptor_id', usuarioId)
      .eq('leida', false);

    if (error) throw new Error("Error al contar notificaciones no leídas: " + error.message);

    return count;
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

/**
 * Marcar todas las notificaciones como leídas (con formato de respuesta para el controller)
 * @param {string} usuarioId - ID del usuario
 * @returns {Object} Resultado con mensaje y cantidad
 */
export const marcarTodasLeidas = async (usuarioId) => {
  const cantidad = await marcarTodasComoLeidas(usuarioId);
  return {
    success: true,
    message: `Se marcaron ${cantidad} notificaciones como leídas`,
    cantidad
  };
};

/**
 * Obtener plantillas disponibles
 * @param {string|null} canal - Canal ('email', 'whatsapp', etc.) o null para todos
 * @returns {Array} Lista de plantillas activas
 */
export const obtenerPlantillas = async (canal = null) => {
  return executeWithTiming('obtenerPlantillas', async () => {
    let query = supabase
      .from('notificaciones_plantillas')
      .select('*')
      .eq('activo', true)
      .order('nombre');

    if (canal) {
      query = query.eq('canal', canal);
    }

    const { data, error } = await query;
    if (error) throw new Error('Error al obtener plantillas: ' + error.message);
    return data;
  });
};

/**
 * Obtener cola de notificaciones pendientes (para administración)
 * @returns {Array} Elementos en cola
 */
export const obtenerColaNotificaciones = async () => {
  return obtenerColaPendiente(100);
};
