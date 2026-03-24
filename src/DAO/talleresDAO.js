import {supabase} from "./connection.js";
import logger from "../logger.js";
import { executeWithTiming } from "../utils/queryLogger.js";
import memoryCache from "../utils/memoryCache.js";
export const obtenerTalleres = async ({ page = 1, limit = 50 } = {}) => {
  return executeWithTiming('obtenerTalleres', async () => {
    const from = (page - 1) * limit;
    const to   = from + limit - 1;

    const { data, error, count } = await supabase
      .from('talleres')
      .select('*', { count: 'exact' })
      .order('fecha', { ascending: true })
      .range(from, to);

    if (error) throw new Error(error.message);
    return { data, total: count ?? 0, page, limit };
  });
};

export const obtenerTallerPorId = async (id) => {
  return executeWithTiming('obtenerTallerPorId', async () => {
    const { data, error } = await supabase
      .from('talleres')
      .select('*')
      .eq('id', id)
      .maybeSingle()  // devuelve null si no existe, sin lanzar error

    if (error) throw error
    return data  // null si no se encontró
  });
};

export const crearTaller = async (taller) => {
  return executeWithTiming('crearTaller', async () => {
    logger.debug('crearTaller - datos:', taller);
    // Solo enviar columnas conocidas de la tabla talleres
    const camposPermitidos = ['titulo', 'descripcion', 'fecha', 'duracion', 'aforo', 'activo', 'modalidad', 'tipo_pago', 'creado_por'];
    const datosFiltrados = Object.fromEntries(
      Object.entries(taller).filter(([k]) => camposPermitidos.includes(k))
    );
    const { data, error } = await supabase
      .from('talleres')
      .insert([datosFiltrados])
      .select()
      .single();
    logger.debug('crearTaller - error:', error);
    if (error) throw new Error("No se ha podido crear el taller: " + error.message);
    
    // Invalidar caché de estadísticas de talleres
    memoryCache.delete('estadisticas_talleres');
    logger.debug('Cache invalidado: nuevo taller creado');
    
    return data
  });
};

export const activarTaller = async (id) => {
  return executeWithTiming('activarTaller', async () => {
    const { data, error } = await supabase
      .from('talleres')
      .update({ activo: 1 })
      .eq('id', id)
      .select()  // devuelve el objeto actualizado
    if (error) throw new Error("No se ha podido activar el taller: " + error.message);
    
    // Invalidar caché de estadísticas de talleres
    memoryCache.delete('estadisticas_talleres');
    logger.debug('Cache invalidado: taller activado');
    
    return data;  // devuelve el primer objeto del array
  });
};
export const desactivarTaller = async (id) => {
  return executeWithTiming('desactivarTaller', async () => {
    const { data, error } = await supabase
      .from('talleres')
      .update({ activo: 0 })
      .eq('id', id)
      .select()  // devuelve el objeto actualizado
    if (error) throw new Error("No se ha podido desactivar el taller: " + error.message);
    
    // Invalidar caché de estadísticas de talleres
    memoryCache.delete('estadisticas_talleres');
    logger.debug('Cache invalidado: taller desactivado');
    
    return data;  // devuelve el primer objeto del array
  });
};

export const editarTaller = async (id, datos) => {
  return executeWithTiming('editarTaller', async () => {
    // Solo enviar campos editables conocidos; nunca actualizar id ni inscritos
    const camposPermitidos = ['titulo', 'descripcion', 'fecha', 'duracion', 'aforo', 'activo', 'modalidad', 'tipo_pago'];
    const datosFiltrados = Object.fromEntries(
      Object.entries(datos).filter(([k]) => camposPermitidos.includes(k))
    );
    const { data, error } = await supabase
      .from('talleres')
      .update(datosFiltrados)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error('No se ha podido editar el taller: ' + error.message);
    memoryCache.delete('estadisticas_talleres');
    return data;
  });
};

export const eliminarTaller = async (id) => {
  return executeWithTiming('eliminarTaller', async () => {
    const { error } = await supabase
      .from('talleres')
      .delete()
      .eq('id', id);
    if (error) throw new Error('No se ha podido eliminar el taller: ' + error.message);
    memoryCache.delete('estadisticas_talleres');
    return true;
  });
};

/**
 * Inscribe a un usuario en un taller.
 * inscritoPorId: null = auto-inscripción; id = monitor que inscribe.
 */
export const inscribirUsuario = async (tallerId, usuarioId, inscritoPorId = null) => {
  return executeWithTiming('inscribirUsuario', async () => {
    // Verificar que no esté ya inscrito
    const { data: existe } = await supabase
      .from('taller_inscripciones')
      .select('id')
      .eq('taller_id', tallerId)
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (existe) throw new Error('El usuario ya está inscrito en este taller');

    // Verificar aforo
    const { data: tallerData, error: tallerErr } = await supabase
      .from('talleres')
      .select('aforo, inscritos')
      .eq('id', tallerId)
      .single();
    if (tallerErr) throw tallerErr;
    if (tallerData.inscritos >= tallerData.aforo) {
      throw new Error('El taller ha alcanzado el aforo máximo');
    }

    // Insertar inscripción
    const { error: insError } = await supabase
      .from('taller_inscripciones')
      .insert({ taller_id: tallerId, usuario_id: usuarioId, inscrito_por: inscritoPorId });
    if (insError) throw new Error('Error al inscribir: ' + insError.message);

    // Incrementar contador (RPC atómica con Supabase)
    const { data: updated, error: updError } = await supabase
      .from('talleres')
      .update({ inscritos: tallerData.inscritos + 1 })
      .eq('id', tallerId)
      .select('inscritos')
      .single();
    if (updError) logger.warn('inscribirUsuario: error actualizando contador', updError);

    return updated?.inscritos ?? tallerData.inscritos + 1;
  });
};

export const desinscribirUsuario = async (tallerId, usuarioId) => {
  return executeWithTiming('desinscribirUsuario', async () => {
    const { error: delError } = await supabase
      .from('taller_inscripciones')
      .delete()
      .eq('taller_id', tallerId)
      .eq('usuario_id', usuarioId);
    if (delError) throw new Error('Error al desinscribir: ' + delError.message);

    // Decrementar contador
    const { data: tallerData, error: errTaller } = await supabase
      .from('talleres')
      .select('inscritos')
      .eq('id', tallerId)
      .maybeSingle();

    if (errTaller) {
      logger.warn({ err: errTaller, tallerId }, 'desinscribirUsuario: error leyendo contador');
    } else if (tallerData) {
      const nuevoContador = Math.max(0, (tallerData.inscritos ?? 0) - 1);
      const { error: errUpdate } = await supabase
        .from('talleres').update({ inscritos: nuevoContador }).eq('id', tallerId);
      if (errUpdate) logger.warn({ err: errUpdate, tallerId }, 'desinscribirUsuario: error actualizando contador');
    }

    return true;
  });
};

export const obtenerInscritos = async (tallerId) => {
  return executeWithTiming('obtenerInscritos', async () => {
    const { data, error } = await supabase
      .from('taller_inscripciones')
      .select(`
        id,
        fecha_inscripcion,
        inscrito_por,
        usuario:usuario_id (id, nombre, "Apellidos", email, foto_perfil)
      `)
      .eq('taller_id', tallerId)
      .order('fecha_inscripcion', { ascending: true });
    if (error) throw new Error('Error al obtener inscritos: ' + error.message);
    return data;
  });
};

export const verificarInscripcion = async (tallerId, usuarioId) => {
  return executeWithTiming('verificarInscripcion', async () => {
    const { data } = await supabase
      .from('taller_inscripciones')
      .select('id')
      .eq('taller_id', tallerId)
      .eq('usuario_id', usuarioId)
      .maybeSingle();
    return !!data;
  });
};

/**
 * Archiva un taller cancelado manualmente:
 *  1. Snapshot → talleres_archivados (cancelado=true, motivo_cancelacion)
 *  2. Copia inscripciones → taller_archivado_inscripciones
 *  3. Borra inscripciones activas y el taller de la tabla activa
 * Devuelve la lista de usuarios inscritos que deben ser notificados.
 */
export const archivarTallerCancelado = async (taller, adminId, motivo = null, motivoId = null) => {
  return executeWithTiming('archivarTallerCancelado', async () => {
    const tallerId = taller.id;

    // 1. Obtener inscripciones antes de borrar
    const { data: inscripciones, error: errInsc } = await supabase
      .from('taller_inscripciones')
      .select(`
        usuario_id, inscrito_por, fecha_inscripcion,
        usuario:usuario_id (id, nombre, "Apellidos", email)
      `)
      .eq('taller_id', tallerId);
    if (errInsc) throw new Error('Error al obtener inscritos: ' + errInsc.message);

    // 2. Insertar snapshot en talleres_archivados
    const fechaTaller = new Date(taller.fecha);
    const { data: archivado, error: errArchivar } = await supabase
      .from('talleres_archivados')
      .insert({
        taller_id:              tallerId,
        titulo:                 taller.titulo,
        descripcion:            taller.descripcion,
        fecha:                  taller.fecha,
        anio:                   fechaTaller.getUTCFullYear(),
        mes:                    fechaTaller.getUTCMonth() + 1,
        duracion:               taller.duracion,
        aforo:                  taller.aforo,
        modalidad:              taller.modalidad,
        tipo_pago:              taller.tipo_pago,
        total_inscritos:        inscripciones?.length ?? 0,
        total_asistentes:       0,
        cancelado:              true,
        motivo_cancelacion:     motivo ?? null,
        motivo_cancelacion_id:  motivoId ?? null,
        datos_originales:       taller,
        archivado_por:          adminId,
      })
      .select('id')
      .single();
    if (errArchivar) throw new Error('Error al archivar taller: ' + errArchivar.message);

    // 3. Copiar inscripciones al archivo
    if (inscripciones && inscripciones.length > 0) {
      const filas = inscripciones.map(i => ({
        taller_archivado_id: archivado.id,
        usuario_id:          i.usuario_id,
        nombre_usuario:      `${i.usuario?.nombre ?? ''} ${i.usuario?.Apellidos ?? ''}`.trim(),
        email_usuario:       i.usuario?.email ?? '',
        inscrito_por:        i.inscrito_por,
        fecha_inscripcion:   i.fecha_inscripcion,
        asistio:             false,
      }));
      const { error: errFilas } = await supabase.from('taller_archivado_inscripciones').insert(filas);
      if (errFilas) throw new Error('Error al copiar inscripciones al archivo: ' + errFilas.message);
    }

    // 4. Eliminar inscripciones activas y el taller
    await supabase.from('taller_inscripciones').delete().eq('taller_id', tallerId);
    await supabase.from('talleres').delete().eq('id', tallerId);

    memoryCache.delete('estadisticas_talleres');

    return inscripciones ?? [];
  });
};

/** Elimina todas las inscripciones de un taller y devuelve los usuarios afectados */
export const cancelarInscripciones = async (tallerId) => {
  return executeWithTiming('cancelarInscripciones', async () => {
    // Obtener inscritos antes de borrar para poder notificarlos
    const { data: inscritos, error: errorGet } = await supabase
      .from('taller_inscripciones')
      .select('usuario:usuario_id (id, nombre, "Apellidos", email)')
      .eq('taller_id', tallerId);
    if (errorGet) throw new Error('Error al obtener inscritos: ' + errorGet.message);

    if (inscritos.length === 0) return [];

    // Eliminar todas las inscripciones en una sola query
    const { error } = await supabase
      .from('taller_inscripciones')
      .delete()
      .eq('taller_id', tallerId);
    if (error) throw new Error('Error al cancelar inscripciones: ' + error.message);

    // Resetear contador de inscritos
    await supabase.from('talleres').update({ inscritos: 0 }).eq('id', tallerId);

    return inscritos;
  });
};

/**
 * Archiva los talleres cuya fecha expiró hace más de `diasMinimos` días.
 * Para cada taller:
 *   1. Copia las inscripciones a taller_archivado_inscripciones
 *   2. Inserta el snapshot en talleres_archivados
 *   3. Borra inscripciones y el taller de las tablas activas
 * Devuelve el número de talleres archivados.
 */
export const archivarTalleresExpirados = async (diasMinimos = 7) => {
  return executeWithTiming('archivarTalleresExpirados', async () => {
    const limite = new Date();
    limite.setDate(limite.getDate() - diasMinimos);

    // 1. Obtener talleres candidatos (expirados hace más de diasMinimos días)
    const { data: candidatos, error: errCandidatos } = await supabase
      .from('talleres')
      .select('*')
      .lt('fecha', limite.toISOString());

    if (errCandidatos) throw new Error('Error al buscar talleres expirados: ' + errCandidatos.message);
    if (!candidatos || candidatos.length === 0) return 0;

    let archivados = 0;

    for (const taller of candidatos) {
      // 2. Obtener inscripciones del taller
      const { data: inscripciones } = await supabase
        .from('taller_inscripciones')
        .select(`
          usuario_id, inscrito_por, fecha_inscripcion,
          usuario:usuario_id (nombre, "Apellidos", email)
        `)
        .eq('taller_id', taller.id);

      // 3. Insertar snapshot en talleres_archivados
      const fechaTaller = new Date(taller.fecha);
      const { data: archivado, error: errArchivar } = await supabase
        .from('talleres_archivados')
        .insert({
          taller_id:        taller.id,
          titulo:           taller.titulo,
          descripcion:      taller.descripcion,
          fecha:            taller.fecha,
          anio:             fechaTaller.getUTCFullYear(),
          mes:              fechaTaller.getUTCMonth() + 1,
          duracion:         taller.duracion,
          aforo:            taller.aforo,
          modalidad:        taller.modalidad,
          tipo_pago:        taller.tipo_pago,
          total_inscritos:  inscripciones?.length ?? 0,
          total_asistentes: 0,
          cancelado:        false,
          motivo_cancelacion: null,
          datos_originales: taller,
          archivado_por:    null,
        })
        .select('id')
        .single();

      if (errArchivar) {
        logger.error({ err: errArchivar, tallerId: taller.id }, 'Error al archivar taller');
        continue;
      }

      // 4. Copiar inscripciones al archivo
      if (inscripciones && inscripciones.length > 0) {
        const filas = inscripciones.map(i => ({
          taller_archivado_id: archivado.id,
          usuario_id:          i.usuario_id,
          nombre_usuario:      `${i.usuario?.nombre ?? ''} ${i.usuario?.Apellidos ?? ''}`.trim(),
          email_usuario:       i.usuario?.email ?? '',
          inscrito_por:        i.inscrito_por,
          fecha_inscripcion:   i.fecha_inscripcion,
          asistio:             false,
        }));

        await supabase.from('taller_archivado_inscripciones').insert(filas);
      }

      // 5. Eliminar inscripciones activas y el taller
      await supabase.from('taller_inscripciones').delete().eq('taller_id', taller.id);
      await supabase.from('talleres').delete().eq('id', taller.id);

      memoryCache.delete('estadisticas_talleres');
      archivados++;
    }

    return archivados;
  });
};