
import {supabase} from "./connection.js";
import logger from "../logger.js";
import { executeWithTiming } from "../utils/queryLogger.js";
import memoryCache from "../utils/memoryCache.js";
export const getUserByEmail = async (email) => {
  return executeWithTiming('getUserByEmail', async () => {
    const { data, error } = await supabase
    .from('appUsers')
    .select('*')
    .eq('email', email)   // filtra solo activos
    logger.debug(`getUserByEmail - email: ${email}, found: ${data?.length || 0}`);
    if((error)) throw new Error(error.message);
    return data;
  });
};

export const getUserById = async (id) => {
  return executeWithTiming('getUserById', async () => {
    const { data, error } = await supabase
      .from('appUsers')
      .select('*')
      .eq('id', id)
      .single()  // devuelve un único objeto en vez de array

    if (error) throw error
    return data
  });
};

export const getAllUsers = async (filters = {}, options = {}, rolUsuario = null, usuarioId = null) => {
  return executeWithTiming('getAllUsers', async () => {
    try {
      // Si es coordinador, obtener solo sus usuarios asignados
      if (rolUsuario === 2 && usuarioId) {
        // Obtener usuarios coordinados con join a usuarios_instructores
        let query = supabase
          .from('usuarios_instructores')
          .select(`
            usuario:usuario_id (
              id,
              nombre,
              Apellidos,
              email,
              rol,
              ultimoInicio,
              foto_perfil
            )
          `, { count: 'exact' })
          .eq('instructor_id', usuarioId);

        // Aplicar filtros
        if (filters.email) {
          query = query.ilike('usuario.email', `%${filters.email}%`);
        }
        if (filters.name) {
          query = query.ilike('usuario.nombre', `%${filters.name}%`);
        }
        if (filters.role) {
          const role = parseInt(filters.role, 10);
          if (!Number.isNaN(role)) {
            query = query.eq('usuario.rol', role);
          }
        }

        // Aplicar paginación
        if (options.limit != null) {
          const limit = parseInt(options.limit, 10);
          const offset = parseInt(options.offset || 0, 10);
          if (!Number.isNaN(limit) && !Number.isNaN(offset)) {
            query = query.range(offset, offset + limit - 1);
          }
        }

        const { data, error, count } = await query;
        if (error) throw new Error(error.message);
        
        // Extraer los objetos de usuario del resultado
        const usuarios = data?.map(item => item.usuario).filter(Boolean) || [];
        return { data: usuarios, total: count ?? usuarios.length };
      }
      
      // Para admins o sin filtro de coordinador, devolver todos los usuarios
      let query = supabase.from('appUsers').select('*', { count: 'exact' });

      const appliedFilters = [];
      if (filters.email) {
        query = query.ilike('email', `%${filters.email}%`);
        appliedFilters.push(`email ilike '%${filters.email}%'`);
      }

      if (filters.role) {
        const role = parseInt(filters.role, 10);
        if (!Number.isNaN(role)) {
          query = query.eq('rol', role);
          appliedFilters.push(`rol = ${role}`);
        }
      }

      if (filters.name) {
        query = query.ilike('nombre', `%${filters.name}%`);
        appliedFilters.push(`nombre ilike '%${filters.name}%'`);
      }

      if (options.limit != null) {
        const limit = parseInt(options.limit, 10);
        const offset = parseInt(options.offset || 0, 10);
        if (!Number.isNaN(limit) && !Number.isNaN(offset)) {
          query = query.range(offset, offset + limit - 1);
          appliedFilters.push(`range ${offset}..${offset + limit - 1}`);
        }
      }

      const { data, error, count } = await query;
      if (error) throw new Error(error.message);
      return { data, total: count ?? (Array.isArray(data) ? data.length : 0) };
    } catch (err) {
      logger.error('getAllUsers - error:', err.message || err);
      throw err;
    }
  });
};

export const createUser = async (user) => {
  return executeWithTiming('createUser', async () => {
    const { data, error } = await supabase
      .from('appUsers')
      .insert([user])
      .select()
      .single()

    if (error) throw new Error(error.message)
    
    // Invalidar caché de estadísticas de usuarios
    memoryCache.delete('estadisticas_usuarios');
    
    // Si el usuario creado es instructor (rol 2), invalidar caché de instructores
    if (user.rol === 2) {
      const allKeys = memoryCache.keys();
      const instructorKeys = allKeys.filter(key => key.startsWith('todos_instructores_'));
      instructorKeys.forEach(key => memoryCache.delete(key));
      if (instructorKeys.length > 0) {
        logger.debug(`Cache invalidado: ${instructorKeys.length} claves de instructores (nuevo instructor)`);
      }
    }
    
    logger.debug('Cache invalidado: nuevo usuario creado');
    
    return data
  });
};

export const updateUserById = async (id, patch) => {
  return executeWithTiming('updateUserById', async () => {
    const { data, error } = await supabase
      .from('appUsers')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    
    // Invalidar caché de estadísticas de usuarios
    memoryCache.delete('estadisticas_usuarios');
    
    // Si se actualizó el rol, invalidar caché de instructores
    if (patch.rol !== undefined) {
      const allKeys = memoryCache.keys();
      const instructorKeys = allKeys.filter(key => key.startsWith('todos_instructores_'));
      instructorKeys.forEach(key => memoryCache.delete(key));
      if (instructorKeys.length > 0) {
        logger.debug(`Cache invalidado: ${instructorKeys.length} claves de instructores (cambio de rol)`);
      }
    }
    
    logger.debug('Cache invalidado: usuario actualizado');
    
    return data
  });
};

export const deleteUserById = async (id) => {
  return executeWithTiming('deleteUserById', async () => {
    const { data, error } = await supabase
      .from('appUsers')
      .delete()
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    
    // Invalidar caché de estadísticas de usuarios
    memoryCache.delete('estadisticas_usuarios');
    logger.debug('Cache invalidado: usuario eliminado');
    
    return data
  });
};

/**
 * Actualizar foto de perfil de un usuario
 * @param {string} userId - ID del usuario
 * @param {string} fotoBase64 - Imagen en formato base64
 * @returns {Object} Usuario actualizado con URL de la foto
 */
export const updateProfilePhoto = async (userId, fotoBase64) => {
  return executeWithTiming('updateProfilePhoto', async () => {
    try {
      // Eliminar el prefijo data:image/... si existe
      const base64Data = fotoBase64.includes('base64,') 
        ? fotoBase64.split('base64,')[1] 
        : fotoBase64;
      
      // Convertir base64 a buffer
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      // Detectar el tipo de imagen del base64
      let contentType = 'image/jpeg'; // Por defecto
      if (fotoBase64.includes('image/png')) contentType = 'image/png';
      else if (fotoBase64.includes('image/webp')) contentType = 'image/webp';
      else if (fotoBase64.includes('image/gif')) contentType = 'image/gif';
      
      // Generar nombre único para el archivo
      const extension = contentType.split('/')[1];
      const fileName = `${userId}-${Date.now()}.${extension}`;
      const filePath = `profile-photos/${fileName}`;
      
      // Obtener la foto anterior si existe para eliminarla
      const { data: userData } = await supabase
        .from('appUsers')
        .select('foto_perfil')
        .eq('id', userId)
        .single();
      
      // Subir la nueva imagen a Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, imageBuffer, {
          contentType,
          upsert: false
        });
      
      if (uploadError) {
        logger.error(`Error al subir imagen a Storage: ${uploadError.message}`);
        if (uploadError.message.includes('Bucket not found')) {
          throw new Error(`El bucket 'avatars' no existe en Supabase Storage. Por favor, créalo desde el dashboard de Supabase (Storage > New bucket > Name: 'avatars' > Public: activado). Ver instrucciones en: src/scripts/setup_supabase_storage.md`);
        }
        throw new Error(`Error al subir imagen: ${uploadError.message}`);
      }
      
      // Obtener URL pública de la imagen
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      // Actualizar la base de datos con la URL de la imagen
      const { data, error } = await supabase
        .from('appUsers')
        .update({ foto_perfil: publicUrl })
        .eq('id', userId)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      
      // Eliminar la foto anterior del storage si existe
      if (userData?.foto_perfil && userData.foto_perfil.includes('avatars/')) {
        try {
          const oldFilePath = userData.foto_perfil.split('avatars/')[1];
          await supabase.storage
            .from('avatars')
            .remove([oldFilePath]);
          logger.debug(`Foto anterior eliminada: ${oldFilePath}`);
        } catch (deleteError) {
          logger.warn(`No se pudo eliminar la foto anterior: ${deleteError.message}`);
        }
      }
      
      return data;
    } catch (error) {
      logger.error(`Error en updateProfilePhoto: ${error.message}`);
      throw error;
    }
  });
};

/**
 * Actualizar ultimoInicio cuando el usuario hace login
 * El trigger de la base de datos actualizará automáticamente ultima_actividad
 * @param {string} userId - ID del usuario
 * @returns {Object} Usuario actualizado
 */
export const actualizarUltimoInicio = async (userId) => {
  return executeWithTiming('actualizarUltimoInicio', async () => {
    try {
      const ahora = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('appUsers')
        .update({ 
          ultimoInicio: ahora
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        logger.error(`[USERdao] Error al actualizar ultimoInicio: ${error.message}`);
        throw new Error(error.message);
      }

      logger.info(`[USERdao] ultimoInicio actualizado para usuario: ${userId}`);
      return data;
    } catch (error) {
      logger.error(`[USERAO] Error en actualizarUltimoInicio: ${error.message}`);
      throw error;
    }
  });
};

/**
 * Marcar usuario como desconectado al hacer logout
 * Actualiza ultima_actividad a NULL para que no aparezca en el dashboard
 * @param {string} userId - ID del usuario
 * @returns {Object} Usuario actualizado
 */
export const marcarUsuarioDesconectado = async (userId) => {
  return executeWithTiming('marcarUsuarioDesconectado', async () => {
    try {
      const { data, error } = await supabase
        .from('appUsers')
        .update({ 
          ultima_actividad: null
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        logger.error(`[USERdao] Error al marcar usuario desconectado: ${error.message}`);
        throw new Error(error.message);
      }

      logger.info(`[USERdao] Usuario marcado como desconectado: ${userId}`);
      return data;
    } catch (error) {
      logger.error(`[USERdao] Error en marcarUsuarioDesconectado: ${error.message}`);
      throw error;
    }
  });
};
