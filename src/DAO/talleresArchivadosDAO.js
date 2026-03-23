import { supabase } from './connection.js';
import { executeWithTiming } from '../utils/queryLogger.js';

/**
 * Listar talleres archivados con filtros opcionales por año y mes.
 * @param {Object} filtros - { anio?, mes?, page?, limit? }
 */
export const obtenerTalleresArchivados = async ({ anio, mes, page = 1, limit = 20 } = {}) => {
  return executeWithTiming('obtenerTalleresArchivados', async () => {
    const offset = (page - 1) * limit;

    let query = supabase
      .from('talleres_archivados')
      .select('*, motivo:motivos_cancelacion(id,nombre)', { count: 'exact' })
      .order('fecha', { ascending: false })
      .range(offset, offset + limit - 1);

    if (anio)  query = query.eq('anio', anio);
    if (mes)   query = query.eq('mes', mes);

    const { data, error, count } = await query;
    if (error) throw new Error('Error al obtener talleres archivados: ' + error.message);

    return { data, total: count, page, limit, hasMore: offset + data.length < count };
  });
};

/**
 * Detalle de un taller archivado con sus inscripciones.
 * Cada inscripción incluye `usuario_activo: boolean` para saber si el usuario
 * sigue existiendo en appUsers (no ha sido eliminado).
 */
export const obtenerTallerArchivadoDetalle = async (tallerArchivadoId) => {
  return executeWithTiming('obtenerTallerArchivadoDetalle', async () => {
    const [{ data: taller, error: errTaller }, { data: inscripciones, error: errInsc }] =
      await Promise.all([
        supabase
          .from('talleres_archivados')
          .select('*, motivo:motivos_cancelacion(id,nombre)')
          .eq('id', tallerArchivadoId)
          .single(),
        supabase
          .from('taller_archivado_inscripciones')
          .select('*')
          .eq('taller_archivado_id', tallerArchivadoId)
          .order('nombre_usuario', { ascending: true }),
      ]);

    if (errTaller)  throw new Error('Error al obtener taller archivado: ' + errTaller.message);
    if (errInsc)    throw new Error('Error al obtener inscripciones archivadas: ' + errInsc.message);

    // Comprobar qué usuarios siguen activos en la plataforma
    const ids = (inscripciones ?? []).map(i => i.usuario_id).filter(Boolean);
    let activosSet = new Set();
    if (ids.length > 0) {
      const { data: activos } = await supabase
        .from('appUsers')
        .select('id')
        .in('id', ids);
      activosSet = new Set((activos ?? []).map(u => u.id));
    }

    const inscripcionesConEstado = (inscripciones ?? []).map(i => ({
      ...i,
      usuario_activo: activosSet.has(i.usuario_id),
    }));

    return { ...taller, inscripciones: inscripcionesConEstado };
  });
};

/**
 * Resumen por año/mes: cuántos talleres hubo y resumen de asistencia.
 */
export const obtenerResumenPorPeriodo = async () => {
  return executeWithTiming('obtenerResumenPorPeriodo', async () => {
    const { data, error } = await supabase
      .from('talleres_archivados')
      .select('anio, mes, total_inscritos, total_asistentes')
      .order('anio', { ascending: false })
      .order('mes',  { ascending: false });

    if (error) throw new Error('Error al obtener resumen por periodo: ' + error.message);

    // Agrupar en JS: { "2026-3": { anio, mes, talleres, inscritos, asistentes } }
    const mapa = {};
    for (const row of data) {
      const key = `${row.anio}-${row.mes}`;
      if (!mapa[key]) {
        mapa[key] = { anio: row.anio, mes: row.mes, talleres: 0, total_inscritos: 0, total_asistentes: 0 };
      }
      mapa[key].talleres++;
      mapa[key].total_inscritos  += row.total_inscritos;
      mapa[key].total_asistentes += row.total_asistentes;
    }

    return Object.values(mapa);
  });
};

/**
 * Marcar la asistencia de un usuario a un taller archivado.
 * Actualiza también el contador total_asistentes del taller.
 */
export const registrarAsistencia = async (tallerArchivadoId, usuarioId, asistio) => {
  return executeWithTiming('registrarAsistencia', async () => {
    const { data: updated, error } = await supabase
      .from('taller_archivado_inscripciones')
      .update({ asistio, fecha_asistencia: asistio ? new Date().toISOString() : null })
      .eq('taller_archivado_id', tallerArchivadoId)
      .eq('usuario_id', usuarioId)
      .select('usuario_id');

    if (error) throw new Error('Error al registrar asistencia: ' + error.message);
    if (!updated || updated.length === 0)
      throw new Error('Inscripción no encontrada en el archivo');

    // Recalcular total_asistentes
    const { count, error: errCount } = await supabase
      .from('taller_archivado_inscripciones')
      .select('*', { count: 'exact', head: true })
      .eq('taller_archivado_id', tallerArchivadoId)
      .eq('asistio', true);

    if (!errCount) {
      await supabase
        .from('talleres_archivados')
        .update({ total_asistentes: count })
        .eq('id', tallerArchivadoId);
    }

    return { ok: true };
  });
};
