import { supabase } from "./connection.js";
import { executeWithTiming } from "../utils/queryLogger.js";
import { getCached } from "../utils/memoryCache.js";

/**
 * Obtener el instructor principal de un usuario
 * @param {number} usuarioId - ID del usuario
 * @returns {Object|null} Datos del instructor principal
 */
export const obtenerInstructorPrincipal = async (usuarioId) => {
  return executeWithTiming('obtenerInstructorPrincipal', async () => {
    const { data, error } = await supabase
      .from('usuarios_instructores')
      .select(`
        instructor_id,
        fecha_asignacion,
        appUsers!instructor_id (
          id,
          nombre,
          Apellidos,
          email,
          rol
        )
      `)
      .eq('usuario_id', usuarioId)
      .eq('es_principal', true)
      .single();

    if (error) {
      // Si no hay instructor principal, retornar null en lugar de error
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }

    return data?.appUsers || null;
  });
};

/**
 * Obtener todos los instructores asignados a un usuario
 * @param {number} usuarioId - ID del usuario
 * @returns {Array} Lista de instructores
 */
export const obtenerInstructoresAsignados = async (usuarioId) => {
  const { data, error } = await supabase
    .from('usuarios_instructores')
    .select(`
      id,
      instructor_id,
      es_principal,
      fecha_asignacion,
      appUsers!instructor_id (
        id,
        nombre,
        Apellidos,
        email,
        rol
      )
    `)
    .eq('usuario_id', usuarioId)
    .order('es_principal', { ascending: false })
    .order('fecha_asignacion', { ascending: false });

  if (error) throw new Error(error.message);

  return data.map(item => ({
    ...item.appUsers,
    es_principal: item.es_principal,
    fecha_asignacion: item.fecha_asignacion
  }));
};

/**
 * Asignar un instructor a un usuario
 * @param {number} usuarioId - ID del usuario
 * @param {number} instructorId - ID del instructor
 * @param {boolean} esPrincipal - Si es el instructor principal
 * @returns {Object} Asignación creada
 */
export const asignarInstructor = async (usuarioId, instructorId, esPrincipal = false) => {
  // Si se marca como principal, desmarcar otros como principales
  if (esPrincipal) {
    await supabase
      .from('usuarios_instructores')
      .update({ es_principal: false })
      .eq('usuario_id', usuarioId);
  }

  const { data, error } = await supabase
    .from('usuarios_instructores')
    .insert([
      {
        usuario_id: usuarioId,
        instructor_id: instructorId,
        es_principal: esPrincipal
      }
    ])
    .select()
    .single();

  if (error) throw new Error("Error al asignar instructor: " + error.message);

  return data;
};

/**
 * Cambiar el instructor principal de un usuario
 * @param {number} usuarioId - ID del usuario
 * @param {number} instructorId - ID del nuevo instructor principal
 * @returns {Object} Resultado de la operación
 */
export const cambiarInstructorPrincipal = async (usuarioId, instructorId) => {
  // Desmarcar todos como principales
  await supabase
    .from('usuarios_instructores')
    .update({ es_principal: false })
    .eq('usuario_id', usuarioId);

  // Marcar el nuevo como principal
  const { data, error } = await supabase
    .from('usuarios_instructores')
    .update({ es_principal: true })
    .eq('usuario_id', usuarioId)
    .eq('instructor_id', instructorId)
    .select()
    .single();

  if (error) throw new Error("Error al cambiar instructor principal: " + error.message);

  return data;
};

/**
 * Desasignar un instructor de un usuario
 * @param {string} usuarioId - ID del usuario
 * @param {string} instructorId - ID del instructor a desasignar
 * @returns {boolean} True si se eliminó correctamente
 */
export const desasignarInstructor = async (usuarioId, instructorId) => {
  const { error } = await supabase
    .from('usuarios_instructores')
    .delete()
    .eq('usuario_id', usuarioId)
    .eq('instructor_id', instructorId);

  if (error) throw new Error("Error al desasignar instructor: " + error.message);

  return true;
};

/**
 * Obtener la lista de usuarios que coordina un instructor con paginación
 * @param {string} instructorId - ID del instructor
 * @param {number} page - Número de página
 * @param {number} limit - Cantidad de resultados por página
 * @param {string} search - Término de búsqueda
 * @returns {Object} Objeto con data, total, page, limit y hasMore
 */
export const obtenerUsuariosCoordinados = async (instructorId, page = 1, limit = 20, search = '') => {
  return executeWithTiming(`obtenerUsuariosCoordinados(page=${page}, search='${search}')`, async () => {
    // Primero obtener todos los IDs de usuarios coordinados
    const { data: relaciones, error: errorRelaciones } = await supabase
      .from('usuarios_instructores')
      .select('usuario_id, fecha_asignacion, es_principal, id')
      .eq('instructor_id', instructorId);

    if (errorRelaciones) throw new Error(errorRelaciones.message);

  if (relaciones.length === 0) {
    return {
      data: [],
      total: 0,
      page,
      limit,
      hasMore: false
    };
  }

  const usuariosIds = relaciones.map(r => r.usuario_id);
  const offset = (page - 1) * limit;

  // Query con paginación y búsqueda - filtrar solo usuarios con rol 3 (usuarios normales)
  let query = supabase
    .from('appUsers')
    .select('id, nombre, Apellidos, email, rol, foto_perfil, ultimoInicio', { count: 'exact' })
    .in('id', usuariosIds)
    .eq('rol', 3); // Solo usuarios normales, no instructores

  if (search) {
    query = query.or(`nombre.ilike.%${search}%,Apellidos.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data: usuarios, error: errorUsuarios, count } = await query
    .range(offset, offset + limit - 1)
    .order('nombre', { ascending: true });

  if (errorUsuarios) throw new Error(errorUsuarios.message);

    // Optimización: Obtener todas las actividades en una sola query
    const { data: todasActividades } = await supabase
      .from('actividad_sistema')
      .select('usuario_id, tipo, titulo, descripcion, created_at')
      .in('usuario_id', usuarios.map(u => u.id))
      .order('created_at', { ascending: false })
      .limit(usuarios.length * 3); // Máximo 3 actividades por usuario

    // Agrupar actividades por usuario
    const actividadesPorUsuario = {};
    (todasActividades || []).forEach(act => {
      if (!actividadesPorUsuario[act.usuario_id]) {
        actividadesPorUsuario[act.usuario_id] = [];
      }
      if (actividadesPorUsuario[act.usuario_id].length < 3) {
        actividadesPorUsuario[act.usuario_id].push(act);
      }
    });

    // Combinar datos
    const usuariosConActividades = usuarios.map(usuario => {
      const relacion = relaciones.find(r => r.usuario_id === usuario.id);
      
      return {
        ...usuario,
        fecha_asignacion: relacion?.fecha_asignacion,
        es_principal: relacion?.es_principal,
        ultimasActividades: actividadesPorUsuario[usuario.id] || []
      };
    });

    return {
      data: usuariosConActividades,
      total: count,
      page,
      limit,
      hasMore: offset + usuarios.length < count
    };
  });
};

/**
 * Obtener la lista de contactos de un usuario con paginación
 * @param {number} usuarioId - ID del usuario
 * @param {number} page - Número de página
 * @param {number} limit - Cantidad de resultados por página
 * @param {string} search - Término de búsqueda
 * @returns {Object} Objeto con data, total, page, limit y hasMore
 */
export const obtenerContactos = async (usuarioId, page = 1, limit = 20, search = '') => {
  return executeWithTiming(`obtenerContactos(page=${page}, search='${search}')`, async () => {
    // Primero obtener todos los IDs de contactos
    const { data: relaciones, error: errorRelaciones } = await supabase
      .from('contactos')
      .select('contacto_id, fecha_agregado, id')
      .eq('usuario_id', usuarioId);

    if (errorRelaciones) throw new Error(errorRelaciones.message);

  if (relaciones.length === 0) {
    return {
      data: [],
      total: 0,
      page,
      limit,
      hasMore: false
    };
  }

  const contactosIds = relaciones.map(r => r.contacto_id);
  const offset = (page - 1) * limit;

  // Query con paginación y búsqueda
  let query = supabase
    .from('appUsers')
    .select('id, nombre, Apellidos, email, rol', { count: 'exact' })
    .in('id', contactosIds);

  if (search) {
    // Sanitizar: remover caracteres especiales peligrosos
    const sanitizedSearch = search.replace(/[%_\\]/g, '\\$&');
    query = query.or(`nombre.ilike.%${sanitizedSearch}%,Apellidos.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%`);
  }

  const { data: contactos, error: errorContactos, count } = await query
    .range(offset, offset + limit - 1)
    .order('nombre', { ascending: true });

  if (errorContactos) throw new Error(errorContactos.message);

    // Combinar con datos de relación
    const contactosConFecha = contactos.map(contacto => {
      const relacion = relaciones.find(r => r.contacto_id === contacto.id);
      return {
        ...contacto,
        fecha_agregado: relacion?.fecha_agregado
      };
    });

    return {
      data: contactosConFecha,
      total: count,
      page,
      limit,
      hasMore: offset + contactos.length < count
    };
  });
};

/**
 * Agregar un contacto
 * @param {number} usuarioId - ID del usuario
 * @param {number} contactoId - ID del contacto a agregar
 * @returns {Object} Contacto creado
 */
export const agregarContacto = async (usuarioId, contactoId) => {
  // No permitir agregarse a sí mismo
  if (usuarioId === contactoId) {
    throw new Error("No puedes agregarte a ti mismo como contacto");
  }

  // Verificar que el contacto existe
  const { data: contactoExiste } = await supabase
    .from('appUsers')
    .select('id')
    .eq('id', contactoId)
    .single();

  if (!contactoExiste) {
    throw new Error("El usuario no existe");
  }

  // Crear el contacto
  const { data, error } = await supabase
    .from('contactos')
    .insert([
      {
        usuario_id: usuarioId,
        contacto_id: contactoId
      }
    ])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') { // Duplicate key
      throw new Error("Este contacto ya está agregado");
    }
    throw new Error("Error al agregar contacto: " + error.message);
  }

  return data;
};

/**
 * Eliminar un contacto
 * @param {number} usuarioId - ID del usuario
 * @param {number} contactoId - ID del contacto a eliminar
 * @returns {boolean} True si se eliminó correctamente
 */
export const eliminarContacto = async (usuarioId, contactoId) => {
  const { error } = await supabase
    .from('contactos')
    .delete()
    .eq('usuario_id', usuarioId)
    .eq('contacto_id', contactoId);

  if (error) throw new Error("Error al eliminar contacto: " + error.message);

  return true;
};

/**
 * Buscar usuarios disponibles para agregar como contacto
 * @param {number} usuarioId - ID del usuario que busca
 * @param {string} termino - Término de búsqueda (nombre, apellido o email)
 * @returns {Array} Lista de usuarios encontrados
 */
export const buscarUsuariosParaContacto = async (usuarioId, termino = '') => {
  let query = supabase
    .from('appUsers')
    .select('id, nombre, Apellidos, email, rol')
    .neq('id', usuarioId); // Excluir al usuario actual

  if (termino) {
    // Sanitizar: remover caracteres especiales peligrosos
    const sanitizedTermino = termino.replace(/[%_\\]/g, '\\$&');
    query = query.or(`nombre.ilike.%${sanitizedTermino}%,Apellidos.ilike.%${sanitizedTermino}%,email.ilike.%${sanitizedTermino}%`);
  }

  const { data, error } = await query
    .order('nombre', { ascending: true })
    .limit(20);

  if (error) throw new Error(error.message);

  // Obtener contactos actuales para marcarlos
  const { data: contactosActuales } = await supabase
    .from('contactos')
    .select('contacto_id')
    .eq('usuario_id', usuarioId);

  const idsContactos = new Set(contactosActuales?.map(c => c.contacto_id) || []);

  return data.map(usuario => ({
    ...usuario,
    esContacto: idsContactos.has(usuario.id)
  }));
};

/**
 * Obtener todos los instructores disponibles
 * @returns {Array} Lista de instructores (rol = 2)
 */
export const obtenerInstructoresDisponibles = async () => {
  const { data, error } = await supabase
    .from('appUsers')
    .select('id, nombre, Apellidos, email, rol')
    .eq('rol', 2) // rol 2 = Instructor
    .order('nombre', { ascending: true });

  if (error) throw new Error(error.message);

  return data;
};

/**
 * Obtener todos los instructores/supervisores para administradores con paginación
 * @param {number} page - Número de página
 * @param {number} limit - Cantidad de resultados por página
 * @param {string} search - Término de búsqueda
 * @returns {Object} Objeto con data, total, page, limit y hasMore
 */
export const obtenerTodosInstructores = async (page = 1, limit = 20, search = '') => {
  const cacheKey = `todos_instructores_${page}_${limit}_${search}`;
  
  return getCached(cacheKey, async () => {
    return executeWithTiming(`obtenerTodosInstructores(page=${page}, search='${search}')`, async () => {    
      const offset = (page - 1) * limit;
  
  let query = supabase
    .from('appUsers')
    .select(`
      id, 
      nombre, 
      Apellidos, 
      email, 
      rol,
      created_at
    `, { count: 'exact' })
    .eq('rol', 2); // rol 2 = Instructor/Supervisor

  // Búsqueda por nombre, apellidos o email
  if (search) {
    // Sanitizar: remover caracteres especiales peligrosos
    const sanitizedSearch = search.replace(/[%_\\]/g, '\\$&');
    query = query.or(`nombre.ilike.%${sanitizedSearch}%,Apellidos.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%`);
  }

  const { data, error, count } = await query
    .range(offset, offset + limit - 1)
    .order('nombre', { ascending: true });

  if (error) {
    logger.error(`[X] Error al obtener instructores: ${error.message}`);
    throw new Error(error.message);
  }

    // Obtener cantidad de usuarios coordinados por cada instructor
    const instructoresConConteo = await Promise.all(
      data.map(async (instructor) => {
        const { count: usuariosCount, error: countError } = await supabase
          .from('usuarios_instructores')
          .select('*', { count: 'exact', head: true })
          .eq('instructor_id', instructor.id);

        return {
          ...instructor,
          usuarios_coordinados: usuariosCount || 0
        };
      })
    );

    return {
      data: instructoresConConteo,
      total: count,
      page,
      limit,
      hasMore: offset + data.length < count
    };
    });
  });
};

/**
 * Obtener usuarios sin supervisor asignado
 * @returns {Array} Lista de usuarios sin supervisor
 */
export const obtenerUsuariosSinSupervisor = async () => {
  return executeWithTiming('obtenerUsuariosSinSupervisor', async () => {
    // Obtener todos los usuarios con rol 3 (usuario normal)
    const { data: todosUsuarios, error: errorUsuarios } = await supabase
      .from('appUsers')
      .select('id, nombre, Apellidos, email, rol, created_at')
      .eq('rol', 3)
      .order('nombre', { ascending: true });

    if (errorUsuarios) throw new Error(errorUsuarios.message);

    // Obtener IDs de usuarios que YA tienen supervisor
    const { data: usuariosConSupervisor, error: errorSupervisor } = await supabase
      .from('usuarios_instructores')
      .select('usuario_id');

    if (errorSupervisor) throw new Error(errorSupervisor.message);

    const idsConSupervisor = new Set(usuariosConSupervisor.map(u => u.usuario_id));

    // Filtrar usuarios que NO tienen supervisor
    return todosUsuarios.filter(usuario => !idsConSupervisor.has(usuario.id));
  });
};

/**
 * Obtener conteos de supervisores por categoría (sin usuarios y sobrecargados)
 * @returns {Object} Objeto con sinUsuarios y sobrecargados
 */
export const obtenerConteosSupervisores = async () => {
  return executeWithTiming('obtenerConteosSupervisores', async () => {
    // Obtener todos los instructores con su conteo de usuarios coordinados
    const { data, error } = await supabase
      .from('appUsers')
      .select(`
        id,
        usuarios_instructores!instructor_id(count)
      `)
      .eq('rol', 2); // rol 2 = Instructor/Supervisor

    if (error) throw new Error(error.message);

    let sinUsuarios = 0;
    let sobrecargados = 0;
    const MAX_USUARIOS = 10; // Debe coincidir con SUPERVISORES_CONFIG.MAX_USUARIOS_POR_SUPERVISOR

    data.forEach(instructor => {
      const conteo = instructor.usuarios_instructores?.[0]?.count || 0;
      
      if (conteo === 0) {
        sinUsuarios++;
      }
      
      if (conteo > MAX_USUARIOS) {
        sobrecargados++;
      }
    });

    return { sinUsuarios, sobrecargados };
  });
};
