import { supabase } from "./connection.js";
import { executeWithTiming } from "../utils/queryLogger.js";

/**
 * Obtener recordatorios según el rol del usuario.
 * - rol 3 (usuario): solo sus propios recordatorios.
 * - rol 1/2 (admin/supervisor): todos, con filtros opcionales.
 *
 * @param {string} usuarioId - UUID del usuario autenticado
 * @param {number} rol - Rol del usuario (1=admin, 2=supervisor, 3=usuario)
 * @param {Object} filtros
 * @param {boolean} filtros.show_admin  - Incluir recordatorios de tipo 'admin'
 * @param {boolean} filtros.show_users  - Incluir recordatorios de tipo 'user' de otros usuarios
 * @param {string}  filtros.usuario_id  - Filtrar por un usuario concreto (solo supervisores)
 */
export const obtenerRecordatorios = async (usuarioId, rol, filtros = {}) => {
  return executeWithTiming('obtenerRecordatorios', async () => {
    const esSupervisor = rol === 1 || rol === 2;

    let query = supabase
      .from('recordatorios')
      .select(`
        *,
        usuario:appUsers!usuario_id (
          id,
          nombre,
          Apellidos,
          email
        )
      `)
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true });

    if (!esSupervisor) {
      // Usuarios normales: solo sus propios recordatorios
      query = query.eq('usuario_id', usuarioId);
    } else {
      // Supervisores/admins: aplica filtros opcionales
      const { show_admin = true, show_users = true, usuario_id } = filtros;

      if (show_admin && show_users) {
        // Sin filtro por tipo: devuelve todos
        if (usuario_id) {
          // Recordatorios admin + recordatorios del usuario seleccionado
          query = query.or(`tipo.eq.admin,and(tipo.eq.user,usuario_id.eq.${usuario_id})`);
        }
        // Si no hay usuario_id, devuelve todo (sin filtro adicional)
      } else if (show_admin && !show_users) {
        query = query.eq('tipo', 'admin');
      } else if (!show_admin && show_users) {
        query = query.eq('tipo', 'user');
        if (usuario_id) {
          query = query.eq('usuario_id', usuario_id);
        }
      } else {
        // Ninguno activo: devolver vacío
        return [];
      }
    }

    const { data, error } = await query;
    if (error) throw new Error('Error al obtener recordatorios: ' + error.message);
    return data;
  });
};

/**
 * Crear un nuevo recordatorio.
 *
 * @param {Object} datos
 * @param {string} datos.usuario_id
 * @param {string} datos.titulo
 * @param {string} [datos.descripcion]
 * @param {string} datos.fecha  - Formato 'YYYY-MM-DD'
 * @param {string} datos.hora   - Formato 'HH:MM'
 * @param {string} datos.tipo   - 'admin' | 'user'
 */
export const crearRecordatorio = async (datos) => {
  return executeWithTiming('crearRecordatorio', async () => {
    const { usuario_id, titulo, descripcion, fecha, hora, tipo } = datos;

    const { data, error } = await supabase
      .from('recordatorios')
      .insert([{ usuario_id, titulo, descripcion, fecha, hora, tipo }])
      .select(`
        *,
        usuario:appUsers!usuario_id (
          id,
          nombre,
          Apellidos,
          email
        )
      `)
      .single();

    if (error) throw new Error('Error al crear recordatorio: ' + error.message);
    return data;
  });
};

/**
 * Actualizar un recordatorio existente.
 * Solo el propietario puede editar su propio recordatorio.
 *
 * @param {number} id
 * @param {string} usuarioId  - UUID del usuario autenticado
 * @param {Object} cambios    - Campos a actualizar
 */
export const actualizarRecordatorio = async (id, usuarioId, cambios) => {
  return executeWithTiming('actualizarRecordatorio', async () => {
    // Verificar propiedad
    const { data: recordatorio, error: fetchError } = await supabase
      .from('recordatorios')
      .select('id, usuario_id')
      .eq('id', id)
      .single();

    if (fetchError || !recordatorio) {
      throw new Error('Recordatorio no encontrado');
    }

    if (recordatorio.usuario_id !== usuarioId) {
      throw Object.assign(new Error('No tienes permiso para editar este recordatorio'), { status: 403 });
    }

    const { titulo, descripcion, fecha, hora } = cambios;
    const update = {};
    if (titulo !== undefined)      update.titulo      = titulo;
    if (descripcion !== undefined) update.descripcion = descripcion;
    if (fecha !== undefined)       update.fecha       = fecha;
    if (hora !== undefined)        update.hora        = hora;
    update.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('recordatorios')
      .update(update)
      .eq('id', id)
      .select(`
        *,
        usuario:appUsers!usuario_id (
          id,
          nombre,
          Apellidos,
          email
        )
      `)
      .single();

    if (error) throw new Error('Error al actualizar recordatorio: ' + error.message);
    return data;
  });
};

/**
 * Eliminar un recordatorio.
 * Verifica permisos: propietario siempre puede; supervisor puede borrar tipo 'user'.
 *
 * @param {number} id          - ID del recordatorio
 * @param {string} usuarioId   - UUID del usuario autenticado
 * @param {number} rol         - Rol del usuario
 */
export const eliminarRecordatorio = async (id, usuarioId, rol) => {
  return executeWithTiming('eliminarRecordatorio', async () => {
    // Obtener el recordatorio para verificar permisos
    const { data: recordatorio, error: fetchError } = await supabase
      .from('recordatorios')
      .select('id, usuario_id, tipo')
      .eq('id', id)
      .single();

    if (fetchError || !recordatorio) {
      throw new Error('Recordatorio no encontrado');
    }

    const esPropietario = recordatorio.usuario_id === usuarioId;
    const esSupervisor = rol === 1 || rol === 2;
    const puedeEliminar =
      esPropietario ||
      (esSupervisor && recordatorio.tipo === 'user');

    if (!puedeEliminar) {
      throw Object.assign(new Error('No tienes permiso para eliminar este recordatorio'), { status: 403 });
    }

    const { error } = await supabase
      .from('recordatorios')
      .delete()
      .eq('id', id);

    if (error) throw new Error('Error al eliminar recordatorio: ' + error.message);
    return { id };
  });
};

/**
 * Obtener recordatorios pendientes de notificar que empiezan en los próximos `minutosAntes` minutos.
 * Solo devuelve los que aún no han sido notificados (notificado_at IS NULL)
 * y cuya fecha+hora está entre ahora y ahora+minutosAntes.
 *
 * @param {number} minutosAntes - Ventana de anticipación en minutos
 * @returns {Array} Recordatorios con datos del usuario propietario
 */
export const obtenerRecordatoriosPendientes = async (minutosAntes) => {
  return executeWithTiming('obtenerRecordatoriosPendientes', async () => {
    const ahora = new Date();
    const limite = new Date(ahora.getTime() + minutosAntes * 60 * 1000);

    // Fetch de hoy y mañana (evita escanear toda la tabla)
    const hoy = ahora.toISOString().slice(0, 10);
    const manana = limite.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('recordatorios')
      .select(`
        *,
        usuario:appUsers!usuario_id (
          id,
          nombre,
          Apellidos,
          email
        )
      `)
      .is('notificado_at', null)
      .gte('fecha', hoy)
      .lte('fecha', manana);

    if (error) throw new Error('Error al obtener recordatorios pendientes: ' + error.message);

    // Filtrar en JS: el datetime del recordatorio debe estar dentro de la ventana [ahora, limite]
    return (data || []).filter((rec) => {
      const dt = new Date(`${rec.fecha}T${rec.hora}`);
      return dt >= ahora && dt <= limite;
    });
  });
};

/**
 * Marcar un recordatorio como ya notificado.
 *
 * @param {number} id - ID del recordatorio
 */
export const marcarRecordatorioNotificado = async (id) => {
  return executeWithTiming('marcarRecordatorioNotificado', async () => {
    const { error } = await supabase
      .from('recordatorios')
      .update({ notificado_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error('Error al marcar recordatorio como notificado: ' + error.message);
  });
};

// ============================================================
//  Recordatorios automáticos de talleres (inteligentes)
// ============================================================

/**
 * Obtener talleres que necesitan recordatorios automáticos.
 * Devuelve talleres cuya fecha de inicio está dentro de la ventana indicada
 * y que todavía no han recibido el tipo de recordatorio solicitado.
 *
 * @param {'24h'|'1h'|'10min'} tipo
 * @param {number} minutosVentana  - Cuántos minutos antes del taller se revisa este tipo
 * @returns {Array} Talleres con inscripciones de usuarios
 */
export const obtenerTalleresPendientesRecordatorio = async (tipo, minutosVentana) => {
  return executeWithTiming('obtenerTalleresPendientesRecordatorio', async () => {
    const ahora   = new Date();
    const margen  = 60 * 1000;                                      // ±1 min tolerancia
    const inicio  = new Date(ahora.getTime() + minutosVentana * 60 * 1000 - margen);
    const fin     = new Date(ahora.getTime() + minutosVentana * 60 * 1000 + margen);

    // IDs de talleres que ya tienen este tipo notificado
    const { data: yaNotificados, error: errN } = await supabase
      .from('recordatorios_talleres')
      .select('taller_id')
      .eq('tipo', tipo)
      .not('notificado_en', 'is', null);

    if (errN) throw new Error('Error al consultar recordatorios_talleres: ' + errN.message);

    const idsExcluir = (yaNotificados || []).map(r => r.taller_id);

    let query = supabase
      .from('talleres')
      .select(`
        id,
        titulo,
        fecha,
        duracion,
        inscripciones:taller_inscripciones(
          usuario_id
        )
      `)
      .eq('activo', true)
      .gte('fecha', inicio.toISOString())
      .lte('fecha', fin.toISOString());

    if (idsExcluir.length > 0) {
      query = query.not('id', 'in', `(${idsExcluir.map(id => `"${id}"`).join(',')})`);
    }

    const { data, error } = await query;
    if (error) throw new Error('Error al obtener talleres para recordatorio: ' + error.message);
    return data || [];
  });
};

/**
 * Obtener talleres que acaban de terminar (para enviar encuesta post-taller).
 * Un taller "terminó" cuando `fecha + duracion` está dentro de la última 1 minuto
 * y no se ha enviado el recordatorio post_taller aún.
 *
 * @param {number} toleranciaMin  - Ventana de detección en minutos (default 2)
 * @returns {Array} Talleres finalizados con inscripciones
 */
export const obtenerTalleresFinalizados = async (toleranciaMin = 2) => {
  return executeWithTiming('obtenerTalleresFinalizados', async () => {
    const ahora = new Date();

    // Obtener talleres activos recientes (los de la última semana pueden haber terminado ahora)
    const { data: talleres, error } = await supabase
      .from('talleres')
      .select(`
        id,
        titulo,
        fecha,
        duracion,
        inscripciones:taller_inscripciones(
          usuario_id
        )
      `)
      .eq('activo', true)
      .gte('fecha', new Date(ahora.getTime() - 24 * 60 * 60 * 1000).toISOString())
      .lte('fecha', ahora.toISOString());

    if (error) throw new Error('Error al obtener talleres finalizados: ' + error.message);

    // IDs que ya tienen post_taller notificado
    const { data: yaNotificados } = await supabase
      .from('recordatorios_talleres')
      .select('taller_id')
      .eq('tipo', 'post_taller')
      .not('notificado_en', 'is', null);

    const idsExcluir = new Set((yaNotificados || []).map(r => r.taller_id));

    // Filtrar en JS: el taller terminó dentro de la tolerancia
    const toleranciaMs = toleranciaMin * 60 * 1000;
    return (talleres || []).filter(t => {
      if (idsExcluir.has(t.id)) return false;
      const inicio = new Date(t.fecha);
      const fin = new Date(inicio.getTime() + (t.duracion || 60) * 60 * 1000);
      return fin <= ahora && (ahora - fin) <= toleranciaMs;
    });
  });
};

/**
 * Marcar un recordatorio de taller como notificado.
 * Hace upsert para crear el registro si no existe aún.
 *
 * @param {number} tallerId
 * @param {'24h'|'1h'|'10min'|'post_taller'} tipo
 */
export const marcarRecordatorioTallerNotificado = async (tallerId, tipo) => {
  return executeWithTiming('marcarRecordatorioTallerNotificado', async () => {
    const { error } = await supabase
      .from('recordatorios_talleres')
      .upsert(
        { taller_id: tallerId, tipo, notificado_en: new Date().toISOString() },
        { onConflict: 'taller_id,tipo' }
      );

    if (error) throw new Error('Error al marcar recordatorio de taller: ' + error.message);
  });
};
