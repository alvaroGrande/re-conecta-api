import { supabase } from "./connection.js";
import logger from "../logger.js";
import { executeWithTiming } from "../utils/queryLogger.js";
import memoryCache from "../utils/memoryCache.js";

/**
 * Obtener todas las encuestas con sus preguntas y opciones
 * @param {Object} filtros - Filtros opcionales (estado: 'activa' | 'cerrada', usuarioRol: rol del usuario)
 * @returns {Array} Lista de encuestas
 */
export const obtenerEncuestas = async (filtros = {}) => {
  return executeWithTiming('obtenerEncuestas', async () => {
    // El conteo de respuestas se obtiene en la misma query mediante relación anidada
    // evitando el patrón N+1 (1 query por encuesta) del código anterior
    let query = supabase
      .from('encuestas')
      .select(`
        *,
        creador:appUsers!encuestas_creado_por_fkey(id, nombre, Apellidos),
        preguntas:encuestas_preguntas(
          *,
          opciones:encuestas_opciones(*)
        ),
        respuestas_count:encuestas_respuestas(count)
      `)
      .order('fecha_creacion', { ascending: false });

    // Filtrar por estado en la base de datos (no en memoria)
    if (filtros.estado) {
      const hoy = new Date().toISOString().split('T')[0];
      if (filtros.estado === 'activa') {
        query = query.gte('fecha_fin', hoy);   // incluye el día de hoy completo
      } else if (filtros.estado === 'cerrada') {
        query = query.lt('fecha_fin', hoy);    // excluye el día de hoy
      }
    }

    // Búsqueda de texto en título y descripción
    if (filtros.q) {
      query = query.or(`titulo.ilike.%${filtros.q}%,descripcion.ilike.%${filtros.q}%`);
    }

    // Filtrar visibilidad según rol:
    // - Admin (1): ve todo
    // - Coordinador (2): sus propias encuestas + encuestas de admin para coordinadores/todos
    // - Usuario (3): encuestas de admin para usuarios/todos + encuestas de sus coordinadores
    if (filtros.usuarioRol === 1) {
      // Admin ve todas las encuestas — sin restricción adicional
    } else if (filtros.usuarioRol === 2 && filtros.usuarioId) {
      if (filtros.estado === 'cerrada') {
        // En pasadas: solo las encuestas que el coordinador creó
        query = query.eq('creado_por', filtros.usuarioId);
      } else {
        // En activas: las suyas + encuestas de admin para coordinadores/todos
        query = query.or(
          `creado_por.eq.${filtros.usuarioId},` +
          `and(creado_por.is.null,rol_objetivo.is.null),` +
          `and(creado_por.is.null,rol_objetivo.eq.2)`
        );
      }
    } else if (filtros.usuarioRol === 3 && filtros.usuarioId) {
      // Obtener coordinadores asignados al usuario
      const { data: coordRows } = await supabase
        .from('usuarios_instructores')
        .select('instructor_id')
        .eq('usuario_id', filtros.usuarioId);
      const coordIds = (coordRows || []).map(r => r.instructor_id);

      if (coordIds.length > 0) {
        query = query.or(
          `and(creado_por.is.null,rol_objetivo.is.null),` +
          `and(creado_por.is.null,rol_objetivo.eq.3),` +
          `creado_por.in.(${coordIds.join(',')})`
        );
      } else {
        query = query.or(
          `and(creado_por.is.null,rol_objetivo.is.null),` +
          `and(creado_por.is.null,rol_objetivo.eq.3)`
        );
      }
    } else if (filtros.usuarioRol) {
      // Fallback para casos sin usuarioId
      query = query.or(`rol_objetivo.is.null,rol_objetivo.eq.${filtros.usuarioRol}`);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    const hoy = new Date().toISOString().split('T')[0];
    return data.map(encuesta => ({
      ...encuesta,
      respuestas: encuesta.respuestas_count?.[0]?.count ?? 0,
      respuestas_count: undefined,
      estado: encuesta.fecha_fin >= hoy ? 'activa' : 'cerrada'
    }));
  });
};

/**
 * Obtener una encuesta específica por ID
 * @param {number} id - ID de la encuesta
 * @returns {Object} Encuesta con preguntas y opciones
 */
export const obtenerEncuestaPorId = async (id) => {
  return executeWithTiming('obtenerEncuestaPorId', async () => {
    const { data, error } = await supabase
      .from('encuestas')
      .select(`
        *,
        creador:appUsers!encuestas_creado_por_fkey(id, nombre, Apellidos),
        preguntas:encuestas_preguntas(
          *,
          opciones:encuestas_opciones(*)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);

    // Agregar conteo de respuestas
    const { count } = await supabase
      .from('encuestas_respuestas')
      .select('*', { count: 'exact', head: true })
      .eq('encuesta_id', id);

    return {
      ...data,
      respuestas: count || 0,
      estado: data.fecha_fin >= new Date().toISOString().split('T')[0] ? 'activa' : 'cerrada'
    };
  });
};

/**
 * Crear una nueva encuesta con sus preguntas y opciones
 * @param {Object} encuestaData - Datos de la encuesta
 * @returns {Object} Encuesta creada
 */
export const crearEncuesta = async (encuestaData) => {
  return executeWithTiming('crearEncuesta', async () => {
    const { titulo, descripcion, fecha_fin, rol_objetivo, preguntas, creado_por } = encuestaData;

    // 1. Crear la encuesta
    const { data: encuesta, error: errorEncuesta } = await supabase
      .from('encuestas')
      .insert([
        {
          titulo,
          descripcion,
          fecha_fin,
          rol_objetivo: rol_objetivo || null,
          creado_por: creado_por || null,
          fecha_creacion: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (errorEncuesta) throw new Error("Error al crear encuesta: " + errorEncuesta.message);

    // Invalidar caché de estadísticas de encuestas
    memoryCache.delete('estadisticas_encuestas');
    logger.debug('Cache invalidado: nueva encuesta creada');

    // 2. Crear las preguntas asociadas
    if (preguntas && preguntas.length > 0) {
      const preguntasParaInsertar = preguntas.map((p, index) => ({
        encuesta_id: encuesta.id,
        texto: p.texto,
        tipo: p.tipo,
        orden: index + 1
      }));

      const { data: preguntasCreadas, error: errorPreguntas } = await supabase
        .from('encuestas_preguntas')
        .insert(preguntasParaInsertar)
        .select();

      if (errorPreguntas) throw new Error("Error al crear preguntas: " + errorPreguntas.message);

      // 3. Crear opciones para preguntas de tipo 'multiple'
      const opcionesParaInsertar = [];
      
      preguntas.forEach((pregunta, pIndex) => {
        if (pregunta.tipo === 'multiple' && pregunta.opciones) {
          pregunta.opciones.forEach((opcion, oIndex) => {
            opcionesParaInsertar.push({
              pregunta_id: preguntasCreadas[pIndex].id,
              texto: opcion.texto,
              orden: oIndex + 1
            });
          });
        }
      });

      if (opcionesParaInsertar.length > 0) {
        const { error: errorOpciones } = await supabase
          .from('encuestas_opciones')
          .insert(opcionesParaInsertar);

        if (errorOpciones) throw new Error("Error al crear opciones: " + errorOpciones.message);
      }
    }

    // Retornar encuesta completa
    return await obtenerEncuestaPorId(encuesta.id);
  });
};

/**
 * Crear respuesta de usuario a una encuesta
 * @param {number} encuestaId - ID de la encuesta
 * @param {number} usuarioId - ID del usuario
 * @param {Object} respuestas - Objeto con respuestas {preguntaId: valor}
 * @returns {Object} Respuesta creada
 */
export const crearRespuestaEncuesta = async (encuestaId, usuarioId, respuestas) => {
  return executeWithTiming('crearRespuestaEncuesta', async () => {
    // Verificar que la encuesta existe y está activa
    const encuesta = await obtenerEncuestaPorId(encuestaId);
    const hoy = new Date().toISOString().split('T')[0];
    
    if (new Date(encuesta.fecha_fin) < new Date(hoy)) {
      throw new Error("La encuesta ya está cerrada");
    }

    // Verificar si el usuario ya respondió esta encuesta
    const { data: respuestaExistente } = await supabase
      .from('encuestas_respuestas')
      .select('id')
      .eq('encuesta_id', encuestaId)
      .eq('usuario_id', usuarioId)
      .single();

    if (respuestaExistente) {
      throw new Error("Ya has respondido esta encuesta");
    }

    // Crear registro de respuesta
    const { data: respuestaRegistro, error: errorRespuesta } = await supabase
      .from('encuestas_respuestas')
      .insert([
        {
          encuesta_id: encuestaId,
          usuario_id: usuarioId,
          fecha_respuesta: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (errorRespuesta) throw new Error("Error al registrar respuesta: " + errorRespuesta.message);

    // Insertar respuestas detalladas
    const respuestasDetalladas = [];

    for (const [preguntaId, valor] of Object.entries(respuestas)) {
      const pregunta = encuesta.preguntas.find(p => p.id === parseInt(preguntaId));
      
      if (!pregunta) continue;

      if (pregunta.tipo === 'multiple') {
        // Para múltiples, valor es un array de IDs de opciones
        const opcionesSeleccionadas = Array.isArray(valor) ? valor : [valor];
        
        opcionesSeleccionadas.forEach(opcionId => {
          respuestasDetalladas.push({
            respuesta_id: respuestaRegistro.id,
            pregunta_id: parseInt(preguntaId),
            opcion_id: opcionId,
            texto_respuesta: null
          });
        });
      } else if (pregunta.tipo === 'abierta') {
        // Para abiertas, valor es texto
        respuestasDetalladas.push({
          respuesta_id: respuestaRegistro.id,
          pregunta_id: parseInt(preguntaId),
          opcion_id: null,
          texto_respuesta: valor
        });
      }
    }

    if (respuestasDetalladas.length > 0) {
      const { error: errorDetalles } = await supabase
        .from('encuestas_respuestas_detalle')
        .insert(respuestasDetalladas);

      if (errorDetalles) throw new Error("Error al guardar detalles: " + errorDetalles.message);
    }

    // Invalidar cachés relacionados con esta encuesta
    memoryCache.delete('estadisticas_encuestas');
    memoryCache.delete(`respuestas_detalladas_${encuestaId}`);
    logger.debug('Cache invalidado: nueva respuesta a encuesta');

    return {
      success: true,
      mensaje: "Respuesta registrada correctamente"
    };
  });
};

/**
 * Obtener resultados agregados de una encuesta
 * @param {number} encuestaId - ID de la encuesta
 * @param {number} usuarioId - ID del usuario (para verificar si ya respondió)
 * @returns {Object} Resultados agregados
 */
export const obtenerResultadosEncuesta = async (encuestaId, usuarioId = null) => {
  return executeWithTiming('obtenerResultadosEncuesta', async () => {
    const encuesta = await obtenerEncuestaPorId(encuestaId);

    // Determinar si la encuesta está cerrada (no activa)
    const encuestaCerrada = encuesta.estado !== 'activa';
    const cacheKey = `resultados_encuesta_${encuestaId}`;

    // Si la encuesta está cerrada, intentar obtener del caché
    if (encuestaCerrada) {
      const cached = memoryCache.get(cacheKey);
      if (cached) {
        logger.info(`[CACHE HIT] Resultados de encuesta cerrada ${encuestaId} obtenidos del caché`);
        
        // Verificar si el usuario ya respondió (esto no se cachea porque depende del usuario)
        let yaRespondida = false;
        if (usuarioId) {
          const { data } = await supabase
            .from('encuestas_respuestas')
            .select('id')
            .eq('encuesta_id', encuestaId)
            .eq('usuario_id', usuarioId)
            .single();

          yaRespondida = !!data;
        }
        
        return {
          yaRespondida,
          resultados: cached,
          fromCache: true
        };
      }
    }

    // Verificar si el usuario ya respondió
    let yaRespondida = false;
    if (usuarioId) {
      const { data } = await supabase
        .from('encuestas_respuestas')
        .select('id')
        .eq('encuesta_id', encuestaId)
        .eq('usuario_id', usuarioId)
        .single();

      yaRespondida = !!data;
    }

    // Obtener conteos agregados por pregunta+opcion desde la DB (no en memoria)
    // Esto evita traer miles de filas individuales a Node.js para contarlas en JS
    const { data: conteos, error: errorConteos } = await supabase
      .rpc('contar_respuestas_encuesta', { p_encuesta_id: encuestaId });

    if (errorConteos) {
      // Fallback: si la RPC no existe usar query directa con join
      logger.warn('RPC contar_respuestas_encuesta no disponible, usando fallback');
      const { data: detalles, error } = await supabase
        .from('encuestas_respuestas_detalle')
        .select(`
          pregunta_id,
          opcion_id,
          texto_respuesta,
          respuesta:encuestas_respuestas!inner(encuesta_id)
        `)
        .eq('respuesta.encuesta_id', encuestaId);

      if (error) throw new Error(error.message);

      const resultados = {};
      encuesta.preguntas.forEach(pregunta => {
        const respuestasPregunta = detalles.filter(d => d.pregunta_id === pregunta.id);
        if (pregunta.tipo === 'multiple') {
          const opciones = {};
          pregunta.opciones.forEach(opcion => {
            opciones[opcion.id] = respuestasPregunta.filter(r => r.opcion_id === opcion.id).length;
          });
          resultados[pregunta.id] = { total: respuestasPregunta.length, opciones };
        } else if (pregunta.tipo === 'abierta') {
          resultados[pregunta.id] = {
            respuestas: respuestasPregunta.map(r => r.texto_respuesta).filter(Boolean)
          };
        }
      });
      if (encuestaCerrada) {
        memoryCache.set(cacheKey, resultados, null);
        logger.info(`[CACHED INDEFINIDO] Resultados de encuesta cerrada ${encuestaId}`);
      }
      return { yaRespondida, resultados, fromCache: false };
    }

    // Construir resultados desde los conteos devueltos por la RPC/query agregada
    const resultados = {};
    encuesta.preguntas.forEach(pregunta => {
      if (pregunta.tipo === 'multiple') {
        const opciones = {};
        let total = 0;
        pregunta.opciones.forEach(opcion => {
          const fila = conteos.find(c => c.pregunta_id === pregunta.id && c.opcion_id === opcion.id);
          const votos = fila?.votos ?? 0;
          opciones[opcion.id] = votos;
          total += votos;
        });
        resultados[pregunta.id] = { total, opciones };
      } else if (pregunta.tipo === 'abierta') {
        // Para respuestas abiertas se necesitan los textos; se obtienen por separado
        // (volumen manejable comparado con preguntas de opción múltiple)
        const textos = conteos
          .filter(c => c.pregunta_id === pregunta.id && c.texto_respuesta)
          .map(c => c.texto_respuesta);
        resultados[pregunta.id] = { respuestas: textos };
      }
    });

    // Si la encuesta está cerrada, cachear indefinidamente
    if (encuestaCerrada) {
      memoryCache.set(cacheKey, resultados, null);
      logger.info(`[CACHED INDEFINIDO] Resultados de encuesta cerrada ${encuestaId}`);
    }

    return {
      yaRespondida,
      resultados,
      fromCache: false
    };
  });
};

/**
 * Obtener las respuestas detalladas de un usuario concreto en una encuesta
 * @param {number} encuestaId - ID de la encuesta
 * @param {number} usuarioId - ID del usuario
 * @returns {Array} Detalles de respuesta agrupados por pregunta
 */
export const obtenerRespuestasDeUsuario = async (encuestaId, usuarioId) => {
  return executeWithTiming('obtenerRespuestasDeUsuario', async () => {
    // Obtener el ID del registro de respuesta del usuario
    const { data: respuesta, error: errRespuesta } = await supabase
      .from('encuestas_respuestas')
      .select('id, fecha_respuesta')
      .eq('encuesta_id', encuestaId)
      .eq('usuario_id', usuarioId)
      .single();

    if (errRespuesta || !respuesta) return [];

    // Obtener el detalle con el texto de la opción seleccionada
    const { data: detalles, error } = await supabase
      .from('encuestas_respuestas_detalle')
      .select(`
        pregunta_id,
        opcion_id,
        texto_respuesta,
        opcion:encuestas_opciones(texto)
      `)
      .eq('respuesta_id', respuesta.id);

    if (error) throw new Error(error.message);

    return {
      fecha_respuesta: respuesta.fecha_respuesta,
      detalles: detalles || []
    };
  });
};

/**
 * Verificar si un usuario ya respondió una encuesta
 * @param {number} encuestaId - ID de la encuesta
 * @param {number} usuarioId - ID del usuario
 * @returns {boolean} True si ya respondió
 */
export const verificarRespuestaUsuario = async (encuestaId, usuarioId) => {
  return executeWithTiming('verificarRespuestaUsuario', async () => {
    const { data } = await supabase
      .from('encuestas_respuestas')
      .select('id')
      .eq('encuesta_id', encuestaId)
      .eq('usuario_id', usuarioId)
      .single();

    return !!data;
  });
};

/**
 * Obtener lista detallada de usuarios que han respondido una encuesta
 * @param {number} encuestaId - ID de la encuesta
 * @returns {Array} Lista de respuestas con datos de usuario
 */
export const obtenerRespuestasDetalladas = async (encuestaId) => {
  return executeWithTiming('obtenerRespuestasDetalladas', async () => {
    // Verificar estado de la encuesta
    const encuesta = await obtenerEncuestaPorId(encuestaId);
    const encuestaCerrada = encuesta.estado !== 'activa';
    const cacheKey = `respuestas_detalladas_${encuestaId}`;

    // Si la encuesta está cerrada, intentar obtener del caché
    if (encuestaCerrada) {
      const cached = memoryCache.get(cacheKey);
      if (cached) {
        logger.info(`[CACHE HIT] Respuestas detalladas de encuesta cerrada ${encuestaId} obtenidas del caché`);
        return cached;
      }
    }

    const { data, error } = await supabase
      .from('encuestas_respuestas')
      .select(`
        id,
        fecha_respuesta,
        usuario:appUsers!encuestas_respuestas_usuario_id_fkey(
          id,
          nombre,
          Apellidos,
          email
        )
      `)
      .eq('encuesta_id', encuestaId)
      .order('fecha_respuesta', { ascending: false });

    if (error) throw new Error(error.message);

    const respuestas = data.map(respuesta => ({
      id: respuesta.id,
      fechaRespuesta: respuesta.fecha_respuesta,
      usuario: respuesta.usuario
    }));

    // Si la encuesta está cerrada, cachear indefinidamente
    if (encuestaCerrada) {
      memoryCache.set(cacheKey, respuestas, null); // null = indefinido
      logger.info(`[CACHED INDEFINIDO] Respuestas detalladas de encuesta cerrada ${encuestaId}`);
    } else {
      // Si está activa, cachear por 1 minuto (pueden llegar nuevas respuestas)
      memoryCache.set(cacheKey, respuestas, 60 * 1000); // 1 minuto
      logger.debug(`[CACHED 1min] Respuestas detalladas de encuesta activa ${encuestaId}`);
    }

    return respuestas;
  });
};

/**
 * Cerrar una encuesta manualmente (antes de su fecha de fin)
 * @param {number} encuestaId - ID de la encuesta
 * @returns {Object} Encuesta actualizada
 */
export const cerrarEncuesta = async (encuestaId) => {
  return executeWithTiming('cerrarEncuesta', async () => {
    // Actualizar fecha_fin a ayer para cerrar la encuesta inmediatamente
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const fechaCierre = ayer.toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('encuestas')
      .update({ fecha_fin: fechaCierre })
      .eq('id', encuestaId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Invalidar cachés para que se recalculen con estado cerrado
    const cacheKeyResultados = `resultados_encuesta_${encuestaId}`;
    const cacheKeyRespuestas = `respuestas_detalladas_${encuestaId}`;
    memoryCache.delete(cacheKeyResultados);
    memoryCache.delete(cacheKeyRespuestas);
    logger.info(`[CACHE INVALIDADO] Encuesta ${encuestaId} cerrada manualmente`);

    return data;
  });
};
