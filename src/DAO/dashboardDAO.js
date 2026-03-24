import { supabase } from "./connection.js";
import logger from "../logger.js";
import { executeWithTiming } from "../utils/queryLogger.js";
import { getCached } from "../utils/memoryCache.js";

/**
 * Obtener estadísticas generales del dashboard
 */
export const obtenerEstadisticasDashboard = async () => {
  const cacheKey = 'estadisticas_dashboard';
  return getCached(cacheKey, async () => {
  return executeWithTiming('obtenerEstadisticasDashboard', async () => {
    try {
      const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const hace5min = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);
      const hoy = new Date().toISOString().split('T')[0];

      // Ejecutar todas las queries en paralelo para mejor rendimiento
      const [
        totalUsuarios,
        usuariosActivos,
        usuariosConectados,
        talleresActivos,
        talleresMes,
        encuestasActivas,
        respuestasEncuestas
      ] = await Promise.all([
        // Total usuarios
        supabase
          .from('appUsers')
          .select('*', { count: 'exact', head: true }),
        
        // Usuarios activos en las últimas 24 horas
        supabase
          .from('appUsers')
          .select('*', { count: 'exact', head: true })
          .gte('ultimoInicio', hace24h),
        
        // Usuarios conectados (últimos 5 minutos)
        supabase
          .from('appUsers')
          .select('*', { count: 'exact', head: true })
          .gte('ultima_actividad', hace5min),
        
        // Talleres activos
        supabase
          .from('talleres')
          .select('*', { count: 'exact', head: true })
          .eq('activo', 1),
        
        // Talleres de este mes
        supabase
          .from('talleres')
          .select('*', { count: 'exact', head: true })
          .gte('fecha', inicioMes.toISOString()),
        
        // Encuestas activas
        supabase
          .from('encuestas')
          .select('*', { count: 'exact', head: true })
          .gte('fecha_fin', hoy),
        
        // Total de respuestas a encuestas
        supabase
          .from('encuestas_respuestas')
          .select('*', { count: 'exact', head: true })
      ]);

      return {
        totalUsuarios: totalUsuarios.count || 0,
        usuariosActivos: usuariosActivos.count || 0,
        usuariosConectados: usuariosConectados.count || 0,
        talleresActivos: talleresActivos.count || 0,
        talleresMes: talleresMes.count || 0,
        encuestasActivas: encuestasActivas.count || 0,
        respuestasEncuestas: respuestasEncuestas.count || 0
      };
    } catch (error) {
      logger.error(`Error al obtener estadísticas del dashboard: ${error.message}`);
      throw error;
    }
  });
  }, 60 * 1000); // 1 min TTL
};

/**
 * Obtener estadísticas de usuarios
 */
export const obtenerEstadisticasUsuarios = async () => {
  const cacheKey = 'estadisticas_usuarios';
  
  return getCached(cacheKey, async () => {
    return executeWithTiming('obtenerEstadisticasUsuarios', async () => {
      const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const hace5min = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const [totalUsuarios, usuariosActivos, usuariosConectados] = await Promise.all([
        supabase.from('appUsers').select('*', { count: 'exact', head: true }),
        supabase.from('appUsers').select('*', { count: 'exact', head: true }).gte('ultimoInicio', hace24h),
        supabase.from('appUsers').select('*', { count: 'exact', head: true }).gte('ultima_actividad', hace5min)
      ]);

      return {
        totalUsuarios: totalUsuarios.count || 0,
        usuariosActivos: usuariosActivos.count || 0,
        usuariosConectados: usuariosConectados.count || 0
      };
    });
  });
};

/**
 * Obtener estadísticas de talleres
 */
export const obtenerEstadisticasTalleres = async () => {
  const cacheKey = 'estadisticas_talleres';
  
  return getCached(cacheKey, async () => {
    return executeWithTiming('obtenerEstadisticasTalleres', async () => {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const [talleresActivos, talleresMes] = await Promise.all([
        supabase.from('talleres').select('*', { count: 'exact', head: true }).eq('activo', 1),
        supabase.from('talleres').select('*', { count: 'exact', head: true }).gte('fecha', inicioMes.toISOString())
      ]);

      return {
        talleresActivos: talleresActivos.count || 0,
        talleresMes: talleresMes.count || 0
      };
    });
  });
};

/**
 * Obtener estadísticas de encuestas
 */
export const obtenerEstadisticasEncuestas = async () => {
  const cacheKey = 'estadisticas_encuestas';
  
  return getCached(cacheKey, async () => {
    return executeWithTiming('obtenerEstadisticasEncuestas', async () => {
      const hoy = new Date().toISOString().split('T')[0];

      const [encuestasActivas, respuestasEncuestas] = await Promise.all([
        supabase.from('encuestas').select('*', { count: 'exact', head: true }).gte('fecha_fin', hoy),
        supabase.from('encuestas_respuestas').select('*', { count: 'exact', head: true })
      ]);

      return {
        encuestasActivas: encuestasActivas.count || 0,
        respuestasEncuestas: respuestasEncuestas.count || 0
      };
    });
  });
};

/**
 * Obtener distribución de usuarios por rol
 * 3 COUNT queries paralelas en PostgreSQL en lugar de fetch masivo + filtro en JS
 */
export const obtenerDistribucionRoles = async () => {
  const cacheKey = 'distribucion_roles';
  return getCached(cacheKey, async () => {
    return executeWithTiming('obtenerDistribucionRoles', async () => {
      const [admins, coordinadores, usuarios] = await Promise.all([
        supabase.from('appUsers').select('*', { count: 'exact', head: true }).eq('rol', 1),
        supabase.from('appUsers').select('*', { count: 'exact', head: true }).eq('rol', 2),
        supabase.from('appUsers').select('*', { count: 'exact', head: true }).eq('rol', 3),
      ]);

      if (admins.error) throw new Error(admins.error.message);
      if (coordinadores.error) throw new Error(coordinadores.error.message);
      if (usuarios.error) throw new Error(usuarios.error.message);

      return [
        { rol: 1, cantidad: admins.count || 0 },
        { rol: 2, cantidad: coordinadores.count || 0 },
        { rol: 3, cantidad: usuarios.count || 0 },
      ];
    });
  }, 5 * 60 * 1000); // 5 min TTL
};

/**
 * Obtener actividad de usuarios de los últimos N días
 * Cacheado por ventana de días para evitar fetch masivo en cada solicitud
 */
export const obtenerActividadPorDias = async (dias = 7) => {
  const cacheKey = `actividad_por_dias_${dias}`;
  return getCached(cacheKey, async () => {
  return executeWithTiming('obtenerActividadPorDias', async () => {
    const hoy = new Date();
    const fechaInicio = new Date(hoy);
    fechaInicio.setDate(fechaInicio.getDate() - (dias - 1));
    fechaInicio.setHours(0, 0, 0, 0);

    // Una sola query para obtener todos los logins de los últimos N días
    const { data, error } = await supabase
      .from('appUsers')
      .select('ultimoInicio')
      .gte('ultimoInicio', fechaInicio.toISOString())
      .not('ultimoInicio', 'is', null);

    if (error) throw new Error(error.message);

    // Agrupar por día en memoria
    const conteosPorDia = {};
    (data || []).forEach(usuario => {
      if (usuario.ultimoInicio) {
        const fecha = new Date(usuario.ultimoInicio);
        const fechaStr = fecha.toISOString().split('T')[0];
        conteosPorDia[fechaStr] = (conteosPorDia[fechaStr] || 0) + 1;
      }
    });

    // Generar array con todos los días (incluir días sin actividad)
    const resultado = [];
    for (let i = dias - 1; i >= 0; i--) {
      const fecha = new Date(hoy);
      fecha.setDate(fecha.getDate() - i);
      fecha.setHours(0, 0, 0, 0);
      
      const fechaStr = fecha.toISOString().split('T')[0];
      
      resultado.push({
        fecha: fechaStr,
        dia_semana: fecha.toLocaleDateString('es-ES', { weekday: 'long' }),
        cantidad: conteosPorDia[fechaStr] || 0
      });
    }

    return resultado;
  });
  }, 10 * 60 * 1000); // 10 min TTL — datos de días pasados no cambian frecuentemente
};

/**
 * Obtener usuarios conectados en tiempo real (últimos 5 minutos)
 */
export const obtenerUsuariosConectados = async () => {
  return executeWithTiming('obtenerUsuariosConectados', async () => {
    const hace5min = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('appUsers')
      .select('id, nombre, Apellidos, email, rol, ultimoInicio, ultima_actividad')
      .gte('ultima_actividad', hace5min)
      .order('ultima_actividad', { ascending: false });

    if (error) throw new Error(error.message);

    return data || [];
  });
};

/**
 * Obtener actividad reciente del sistema agrupada por usuario
 * Cacheado 2 min: reduce carga en tabla actividad_sistema en cada carga del dashboard
 */
export const obtenerActividadReciente = async (limite = 10) => {
  const cacheKey = `actividad_reciente_${limite}`;
  return getCached(cacheKey, async () => {
  return executeWithTiming('obtenerActividadReciente', async () => {
    // Fetch suficientes filas para obtener `limite` usuarios únicos tras la agrupación
    const sqlLimit = Math.min(limite * 10, 200);
    const { data, error } = await supabase
      .from('actividad_sistema')
      .select(`
        id,
        tipo,
        titulo,
        descripcion,
        created_at,
        usuario:usuario_id (
          id,
          nombre,
          Apellidos,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .limit(sqlLimit);

    if (error) {
      logger.warn('Error al obtener actividad reciente, devolviendo array vacío:', error.message);
      return [];
    }

    // Agrupar por usuario
    const actividadesPorUsuario = {};
    
    (data || []).forEach(actividad => {
      const usuarioId = actividad.usuario?.id;
      if (!usuarioId) return;
      
      if (!actividadesPorUsuario[usuarioId]) {
        actividadesPorUsuario[usuarioId] = {
          usuario: actividad.usuario,
          actividades: [],
          ultimaActividad: actividad.created_at
        };
      }
      
      actividadesPorUsuario[usuarioId].actividades.push({
        tipo: actividad.tipo,
        titulo: actividad.titulo,
        descripcion: actividad.descripcion,
        fecha: actividad.created_at
      });
    });

    // Convertir a array y ordenar por última actividad
    const resultado = Object.values(actividadesPorUsuario)
      .sort((a, b) => new Date(b.ultimaActividad) - new Date(a.ultimaActividad))
      .slice(0, limite)
      .map(item => ({
        usuario_id: item.usuario.id,
        nombre: item.usuario.nombre,
        apellidos: item.usuario.Apellidos,
        correoUsuario: item.usuario.email,
        tipo: item.actividades[0].tipo, // Tipo de la actividad más reciente
        descripcion: item.actividades.length === 1 
          ? item.actividades[0].descripcion 
          : `${item.actividades.length} actividades recientes`,
        fecha: item.ultimaActividad,
        total_actividades: item.actividades.length,
        actividades: item.actividades // Incluir todas las actividades para el modal
      }));

    return resultado;
  });
  }, 2 * 60 * 1000); // 2 min TTL
};

/**
 * Registrar actividad en el sistema
 */
export const registrarActividad = async (usuarioId, tipo, titulo, descripcion = null) => {
  return executeWithTiming('registrarActividad', async () => {
    const { data, error } = await supabase
      .from('actividad_sistema')
      .insert([
        {
          usuario_id: usuarioId,
          tipo,
          titulo,
          descripcion
        }
      ])
      .select()
      .single();

    if (error) {
      logger.error(`Error al registrar actividad: ${error.message}`);
      throw new Error(error.message);
    }

    return data;
  });
};

/**
 * Actualizar última actividad del usuario
 */
export const actualizarUltimaActividad = async (usuarioId) => {
  return executeWithTiming('actualizarUltimaActividad', async () => {
    const { error } = await supabase
      .from('appUsers')
      .update({ ultima_actividad: new Date().toISOString() })
      .eq('id', usuarioId);

    if (error) {
      logger.error(`Error al actualizar última actividad: ${error.message}`);
      throw new Error(error.message);
    }

    return true;
  });
};

/**
 * Obtener actividad de un usuario específico de los últimos N días
 */
export const obtenerActividadUsuario = async (usuarioId, dias = 7) => {
  return executeWithTiming('obtenerActividadUsuario', async () => {
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - dias);
    fechaInicio.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('actividad_sistema')
      .select('id, tipo, titulo, descripcion, created_at')
      .eq('usuario_id', usuarioId)
      .gte('created_at', fechaInicio.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      logger.warn(`Error al obtener actividad del usuario ${usuarioId}:`, error.message);
      return [];
    }

    return data || [];
  });
};
