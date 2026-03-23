import { supabase } from "./connection.js";
import { executeWithTiming } from "../utils/queryLogger.js";
import logger from '../logger.js';
import { getCached, memoryCache } from '../utils/memoryCache.js';


/**
 * Registrar inicio de una tarea programada
 */
export const registrarInicioTarea = async (nombreTarea) => {
  return executeWithTiming(
    'registrarInicioTarea',
    async () => {
      const ahora = new Date();
      const { data, error } = await supabase
        .from('logs_tareas_programadas')
        .insert({
          nombre_tarea: nombreTarea,
          estado: 'iniciada',
          fecha_inicio: ahora.toISOString()
        })
        .select('id, fecha_inicio')
        .single();
      
      if (error) throw error;
      return { id: data.id, timestampInicio: ahora.getTime() };
    }
  );
};

/**
 * Registrar finalización exitosa de tarea
 */
export const registrarFinTarea = async (logId, datos, timestampInicio = null) => {
  return executeWithTiming(
    'registrarFinTarea',
    async () => {
      const {
        registrosProcesados = 0,
        registrosArchivados = 0,
        registrosEliminados = 0,
        mensaje = '',
        detalles = {}
      } = datos;

      let duracionMs;
      
      if (timestampInicio) {
        // Usar el timestamp pasado como parámetro
        duracionMs = Math.round(Date.now() - timestampInicio);
      } else {
        // Fallback: obtener de la base de datos
        const { data: logData, error: logError } = await supabase
          .from('logs_tareas_programadas')
          .select('fecha_inicio')
          .eq('id', logId)
          .single();
        
        if (logError) throw logError;
        const fechaInicio = new Date(logData.fecha_inicio);
        duracionMs = Math.round(Date.now() - fechaInicio.getTime());
      }
      
      logger.info(`[Tarea Completada] Duracion: ${duracionMs}ms (${(duracionMs/1000).toFixed(2)}s)`);

      const { error } = await supabase
        .from('logs_tareas_programadas')
        .update({
          estado: 'completada',
          fecha_fin: new Date().toISOString(),
          duracion_ms: duracionMs,
          registros_procesados: registrosProcesados,
          registros_archivados: registrosArchivados,
          registros_eliminados: registrosEliminados,
          mensaje: mensaje,
          detalles: detalles
        })
        .eq('id', logId);
      
      if (error) throw error;
      
      // Invalidar cachés relacionados con tareas
      // Invalidar todas las variantes de límite (10, 20, 50, etc)
      const allKeys = memoryCache.keys();
      const keysToDelete = allKeys.filter(key => 
        key.startsWith('ultimas_ejecuciones_') || key === 'estadisticas_queries'
      );
      keysToDelete.forEach(key => memoryCache.delete(key));
      
      if (keysToDelete.length > 0) {
        logger.debug(`Cache invalidado: ${keysToDelete.length} claves eliminadas (tareas completadas)`);
      }
      
      return { success: true, logId, duracionMs };
    }
  );
};

/**
 * Registrar error en tarea
 */
export const registrarErrorTarea = async (logId, error, timestampInicio = null) => {
  return executeWithTiming(
    'registrarErrorTarea',
    async () => {
      let duracionMs;
      
      if (timestampInicio) {
        // Usar el timestamp pasado como parámetro
        duracionMs = Math.round(Date.now() - timestampInicio);
      } else {
        // Fallback: obtener de la base de datos
        const { data: logData, error: logError } = await supabase
          .from('logs_tareas_programadas')
          .select('fecha_inicio')
          .eq('id', logId)
          .single();
        
        if (logError) throw logError;
        const fechaInicio = new Date(logData.fecha_inicio);
        duracionMs = Math.round(Date.now() - fechaInicio.getTime());
      }
      
      logger.info(`[Tarea Error] Duración: ${duracionMs}ms (${(duracionMs/1000).toFixed(2)}s)`);

      const { error: updateError } = await supabase
        .from('logs_tareas_programadas')
        .update({
          estado: 'error',
          fecha_fin: new Date().toISOString(),
          duracion_ms: duracionMs,
          error: error.message || error.toString(),
          mensaje: error.stack || ''
        })
        .eq('id', logId);
      
      if (updateError) throw updateError;
      
      // Invalidar cachés relacionados con tareas
      // Invalidar todas las variantes de límite (10, 20, 50, etc)
      const allKeys = memoryCache.keys();
      const keysToDelete = allKeys.filter(key => 
        key.startsWith('ultimas_ejecuciones_') || key === 'estadisticas_queries'
      );
      keysToDelete.forEach(key => memoryCache.delete(key));
      
      if (keysToDelete.length > 0) {
        logger.debug(`Cache invalidado: ${keysToDelete.length} claves eliminadas (error en tarea)`);
      }
      
      return { success: true, logId, duracionMs };
    }
  );
};

/**
 * Obtener últimas ejecuciones de tareas
 * CACHED: 5 minutos
 */
export const obtenerUltimasEjecuciones = async (limite = 20) => {
  const cacheKey = `ultimas_ejecuciones_${limite}`;
  
  const { data, fromCache } = await getCached(cacheKey, async () => {
    return executeWithTiming(
      'obtenerUltimasEjecuciones',
      async () => {
        const { data, error } = await supabase
          .from('logs_tareas_programadas')
          .select(`
            id,
            nombre_tarea,
            estado,
            fecha_inicio,
            fecha_fin,
            duracion_ms,
            registros_procesados,
            registros_archivados,
            registros_eliminados,
            mensaje,
            error
          `)
          .order('fecha_inicio', { ascending: false })
          .limit(limite);
        
        if (error) throw error;
        return data;
      }
    );
  }, 5 * 60 * 1000); // 5 minutos
  
  return { data, fromCache };
};

/**
 * Obtener historial de una tarea específica
 */
export const obtenerHistorialTarea = async (nombreTarea, limite = 50) => {
  return executeWithTiming(
    'obtenerHistorialTarea',
    async () => {
      const { data, error } = await supabase
        .from('logs_tareas_programadas')
        .select(`
          id,
          nombre_tarea,
          estado,
          fecha_inicio,
          fecha_fin,
          duracion_ms,
          registros_procesados,
          registros_archivados,
          registros_eliminados,
          mensaje,
          error
        `)
        .eq('nombre_tarea', nombreTarea)
        .order('fecha_inicio', { ascending: false })
        .limit(limite);
      
      if (error) throw error;
      return data;
    }
  );
};

/**
 * Obtener resumen de últimas ejecuciones por tarea
 */
export const obtenerResumenTareas = async () => {
  return executeWithTiming(
    'obtenerResumenTareas',
    async () => {
      const { data, error } = await supabase
        .from('ultimas_ejecuciones_tareas')
        .select('*')
        .order('fecha_inicio', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  );
};

/**
 * Obtener estadísticas generales de tareas
 */
export const obtenerEstadisticasTareas = async () => {
  return executeWithTiming(
    'obtenerEstadisticasTareas',
    async () => {
      const { data, error } = await supabase
        .rpc('obtener_estadisticas_tareas');
      
      if (error) throw error;
      return data;
    }
  );
};

/**
 * Ejecutar archivado de actividades
 */
export const ejecutarArchivadoActividades = async (diasRetencion = 90) => {
  return executeWithTiming(
    'ejecutarArchivadoActividades',
    async () => {
      const { data, error } = await supabase
        .rpc('archivar_actividades_antiguas', { dias_retencion: diasRetencion });
      
      if (error) throw error;
      return data;
    }
  );
};

/**
 * Ejecutar limpieza de archivo
 */
export const ejecutarLimpiezaArchivo = async (diasTotal = 365) => {
  return executeWithTiming(
    'ejecutarLimpiezaArchivo',
    async () => {
      const { data, error } = await supabase
        .rpc('limpiar_archivo_antiguo', { dias_total: diasTotal });
      
      if (error) throw error;
      return data;
    }
  );
};

/**
 * Obtener estadísticas de tablas de actividad
 */
export const obtenerEstadisticasActividad = async () => {
  return executeWithTiming(
    'obtenerEstadisticasActividad',
    async () => {
      // Obtener estadísticas de actividad_sistema
      const { data: activaData, error: activaError } = await supabase
        .from('actividad_sistema')
        .select('created_at');
      
      if (activaError) throw activaError;

      // Obtener estadísticas de actividad_sistema_archivo
      const { data: archivoData, error: archivoError } = await supabase
        .from('actividad_sistema_archivo')
        .select('created_at');
      
      if (archivoError) throw archivoError;

      const estadisticas = [];

      if (activaData && activaData.length > 0) {
        const fechas = activaData.map(r => new Date(r.created_at)).sort((a, b) => a - b);
        estadisticas.push({
          tabla: 'Activa',
          registros: activaData.length,
          mas_antigua: fechas[0],
          mas_reciente: fechas[fechas.length - 1]
        });
      }

      if (archivoData && archivoData.length > 0) {
        const fechas = archivoData.map(r => new Date(r.created_at)).sort((a, b) => a - b);
        estadisticas.push({
          tabla: 'Archivo',
          registros: archivoData.length,
          mas_antigua: fechas[0],
          mas_reciente: fechas[fechas.length - 1]
        });
      }

      return estadisticas;
    }
  );
};

/**
 * Obtener estadísticas de queries
 * CACHED: 5 minutos
 */
export const obtenerEstadisticasQueries = async () => {
  const cacheKey = 'estadisticas_queries';
  
  const { data, fromCache } = await getCached(cacheKey, async () => {
    return executeWithTiming(
      'obtenerEstadisticasQueries',
      async () => {
        const { data, error } = await supabase
          .rpc('obtener_estadisticas_queries');
        
        if (error) throw error;
        return data;
      }
    );
  }, 5 * 60 * 1000); // 5 minutos
  
  return { data, fromCache };
};

/**
 * Obtener queries más lentas
 * CACHED: 5 minutos
 */
export const obtenerQueriesMasLentas = async (limite = 20) => {
  const cacheKey = `queries_mas_lentas_${limite}`;
  
  const { data, fromCache } = await getCached(cacheKey, async () => {
    return executeWithTiming(
      'obtenerQueriesMasLentas',
      async () => {
        const { data, error } = await supabase
          .from('queries_mas_lentas')
          .select('*')
          .limit(limite);
        
        if (error) throw error;
        return data;
      }
    );
  }, 5 * 60 * 1000); // 5 minutos
  
  return { data, fromCache };
};

/**
 * Limpiar logs antiguos de queries
 */
export const limpiarQueryLogsAntiguos = async (diasRetencion = 30) => {
  return executeWithTiming(
    'limpiarQueryLogsAntiguos',
    async () => {
      const { data, error } = await supabase
        .rpc('limpiar_query_logs_antiguos', { dias_retencion: diasRetencion });
      
      if (error) throw error;
      return data;
    }
  );
};
