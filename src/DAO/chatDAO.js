import { supabase } from './connection.js';
import { executeWithTiming } from '../utils/queryLogger.js';
import { memoryCache } from '../utils/memoryCache.js';

const CHAT_GENERAL_ID = '00000000-0000-0000-0000-000000000001';

// ── Caché de chats ────────────────────────────────────────────────────────────

const CACHE_TTL_LISTA   = 10 * 60 * 1000; // 10 min — lista completa por usuario
const MAX_RECIENTES     = 50;              // cuántos chats "recientes" cachear adicionalmente

const _cacheKeyLista     = (uid) => `chat:lista:${uid}`;
const _cacheKeyRecientes = (uid) => `chat:recientes:${uid}`;

/**
 * Invalida las dos entradas de caché de un usuario.
 */
export const invalidarCacheChatsUsuario = (usuarioIds) => {
  const ids = Array.isArray(usuarioIds) ? usuarioIds : [usuarioIds];
  ids.forEach(uid => {
    memoryCache.delete(_cacheKeyLista(uid));
    memoryCache.delete(_cacheKeyRecientes(uid));
  });
};

/**
 * Dado un chatId, obtiene los IDs de sus miembros para invalidar caché en bloque.
 * Usa una consulta ligera (solo usuario_id).
 */
export const invalidarCachePorChat = async (chatId) => {
  const { data } = await supabase
    .from('chat_miembros')
    .select('usuario_id')
    .eq('chat_id', chatId);
  if (data?.length) invalidarCacheChatsUsuario(data.map(m => m.usuario_id));
};

// ── Chats ────────────────────────────────────────────────────────────────────

/**
 * Devuelve todos los chats a los que pertenece el usuario.
 * El chat general se une automáticamente si el usuario no es miembro aún.
 * Cachea el resultado por usuario durante 2 minutos y mantiene un subconjunto
 * de los 5 chats más recientes en una clave separada.
 */
export const obtenerChatsDeUsuario = async (usuarioId) => {
  return executeWithTiming('obtenerChatsDeUsuario', async () => {
    const cacheKey = _cacheKeyLista(usuarioId);
    const cached = memoryCache.get(cacheKey);
    if (cached !== null) return cached;

    // Asegurar que el usuario sea miembro del chat general
    await supabase
      .from('chat_miembros')
      .upsert({ chat_id: CHAT_GENERAL_ID, usuario_id: usuarioId }, { onConflict: 'chat_id,usuario_id', ignoreDuplicates: true });

    const { data, error } = await supabase
      .from('chat_miembros')
      .select(`
        chat:chats (
          id, nombre, descripcion, tipo, es_efimero, ttl_horas, creado_en, activo,
          creado_por_usuario:appUsers!chats_creado_por_fkey (id, nombre, Apellidos),
          miembros:chat_miembros (
            usuario:appUsers (id, nombre, Apellidos, foto_perfil)
          )
        )
      `)
      .eq('usuario_id', usuarioId)
      .eq('chats.activo', true);

    if (error) throw new Error('Error al obtener chats: ' + error.message);
    const chats = data.map(r => r.chat).filter(Boolean);

    // Guardar lista completa en caché
    memoryCache.set(cacheKey, chats, CACHE_TTL_LISTA);

    // Guardar los N más recientes en caché separada (más larga) para socket reconnect
    const recientes = [...chats]
      .sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en))
      .slice(0, MAX_RECIENTES);
    memoryCache.set(_cacheKeyRecientes(usuarioId), recientes, CACHE_TTL_LISTA * 2);

    return chats;
  });
};

/**
 * Obtener un chat por ID (verifica que el usuario sea miembro).
 */
export const obtenerChatPorId = async (chatId, usuarioId) => {
  return executeWithTiming('obtenerChatPorId', async () => {
    const { data, error } = await supabase
      .from('chats')
      .select(`
        id, nombre, descripcion, tipo, es_efimero, ttl_horas, creado_en, activo,
        creado_por_usuario:appUsers!chats_creado_por_fkey (id, nombre, Apellidos),
        miembros:chat_miembros (
          usuario:appUsers (id, nombre, Apellidos, email, foto_perfil)
        )
      `)
      .eq('id', chatId)
      .single();

    if (error) throw new Error('Chat no encontrado');

    // Verificar membresía (excepto general que es público)
    if (data.tipo !== 'general') {
      const esMiembro = data.miembros.some(m => m.usuario?.id === usuarioId);
      if (!esMiembro) throw new Error('No tienes acceso a este chat');
    }

    return data;
  });
};

/**
 * Obtener o crear un chat directo (1 a 1) entre dos usuarios.
 * Si ya existe, lo devuelve. Si no, lo crea con ambos miembros.
 */
export const obtenerOCrearChatDirecto = async (usuarioAId, usuarioBId) => {
  return executeWithTiming('obtenerOCrearChatDirecto', async () => {
    // Buscar si ya existe un chat directo entre los dos usuarios
    // Un chat directo tiene exactamente 2 miembros: usuarioA y usuarioB
    const { data: miembrosA } = await supabase
      .from('chat_miembros')
      .select('chat_id')
      .eq('usuario_id', usuarioAId);

    const idsA = (miembrosA || []).map(m => m.chat_id);
    if (!idsA.length) {
      const resultado = await _crearChatDirecto(usuarioAId, usuarioBId);
      // Chat nuevo → invalidar caché de ambos
      invalidarCacheChatsUsuario([usuarioAId, usuarioBId]);
      return resultado;
    }

    const { data: chatsDirectos } = await supabase
      .from('chats')
      .select(`
        id, nombre, descripcion, tipo, es_efimero, ttl_horas, creado_en, activo,
        miembros:chat_miembros (usuario_id)
      `)
      .eq('tipo', 'directo')
      .eq('activo', true)
      .in('id', idsA);

    const existente = (chatsDirectos || []).find(chat => {
      const ids = chat.miembros.map(m => m.usuario_id)
      return ids.includes(usuarioAId) && ids.includes(usuarioBId) && ids.length === 2
    });

    if (existente) {
      // Devolver con datos completos
      const { data, error } = await supabase
        .from('chats')
        .select(`
          id, nombre, descripcion, tipo, es_efimero, ttl_horas, creado_en, activo,
          miembros:chat_miembros (
            usuario:appUsers (id, nombre, Apellidos, email, foto_perfil)
          )
        `)
        .eq('id', existente.id)
        .single();
      if (error) throw new Error('Error al obtener chat directo: ' + error.message);
      return { chat: data, creado: false };
    }

    const resultado = await _crearChatDirecto(usuarioAId, usuarioBId);
    invalidarCacheChatsUsuario([usuarioAId, usuarioBId]);
    return resultado;
  });
};

const _crearChatDirecto = async (usuarioAId, usuarioBId) => {
  const { data: chat, error } = await supabase
    .from('chats')
    .insert({ nombre: 'directo', tipo: 'directo', es_efimero: false, creado_por: usuarioAId })
    .select()
    .single();

  if (error) throw new Error('Error al crear chat directo: ' + error.message);

  await supabase.from('chat_miembros').insert([
    { chat_id: chat.id, usuario_id: usuarioAId },
    { chat_id: chat.id, usuario_id: usuarioBId }
  ]);

  const { data: completo } = await supabase
    .from('chats')
    .select(`
      id, nombre, descripcion, tipo, es_efimero, ttl_horas, creado_en, activo,
      miembros:chat_miembros (
        usuario:appUsers (id, nombre, Apellidos, email, foto_perfil)
      )
    `)
    .eq('id', chat.id)
    .single();

  return { chat: completo, creado: true };
};

/**
 * Crear un chat grupal.
 * Solo admins y coordinadores pueden crear grupos.
 */
export const crearChat = async ({ nombre, descripcion, es_efimero, ttl_horas, miembros, creadoPor }) => {
  return executeWithTiming('crearChat', async () => {
    const { data: chat, error } = await supabase
      .from('chats')
      .insert({
        nombre,
        descripcion: descripcion || null,
        tipo: 'grupal',
        es_efimero: es_efimero || false,
        ttl_horas: es_efimero ? (ttl_horas || 24) : null,
        creado_por: creadoPor
      })
      .select()
      .single();

    if (error) throw new Error('Error al crear chat: ' + error.message);

    // Añadir miembros (incluir al creador)
    const idsUnicos = [...new Set([creadoPor, ...(miembros || [])])];
    const filas = idsUnicos.map(uid => ({ chat_id: chat.id, usuario_id: uid }));
    const { error: errMiembros } = await supabase.from('chat_miembros').insert(filas);
    if (errMiembros) throw new Error('Error al añadir miembros: ' + errMiembros.message);

    // Invalidar caché de todos los miembros
    invalidarCacheChatsUsuario(idsUnicos);

    return chat;
  });
};

/**
 * Actualizar nombre/descripción/efímero de un chat grupal.
 */
export const actualizarChat = async (chatId, cambios) => {
  return executeWithTiming('actualizarChat', async () => {
    const { nombre, descripcion, es_efimero, ttl_horas } = cambios;
    const payload = {};
    if (nombre !== undefined) payload.nombre = nombre;
    if (descripcion !== undefined) payload.descripcion = descripcion;
    if (es_efimero !== undefined) {
      payload.es_efimero = es_efimero;
      payload.ttl_horas = es_efimero ? (ttl_horas || 24) : null;
    }

    const { data, error } = await supabase
      .from('chats')
      .update(payload)
      .eq('id', chatId)
      .select()
      .single();

    if (error) throw new Error('Error al actualizar chat: ' + error.message);
    return data;
  });
};

/**
 * Eliminar (desactivar) un chat grupal.
 */
export const eliminarChat = async (chatId) => {
  return executeWithTiming('eliminarChat', async () => {
    // Obtener miembros antes de desactivar para invalidar su caché
    await invalidarCachePorChat(chatId);

    const { error } = await supabase
      .from('chats')
      .update({ activo: false })
      .eq('id', chatId)
      .neq('tipo', 'general'); // el general nunca se elimina

    if (error) throw new Error('Error al eliminar chat: ' + error.message);
  });
};

/**
 * Añadir miembros a un chat grupal.
 */
export const añadirMiembros = async (chatId, usuarioIds) => {
  return executeWithTiming('añadirMiembros', async () => {
    const filas = usuarioIds.map(uid => ({ chat_id: chatId, usuario_id: uid }));
    const { error } = await supabase
      .from('chat_miembros')
      .upsert(filas, { onConflict: 'chat_id,usuario_id', ignoreDuplicates: true });

    if (error) throw new Error('Error al añadir miembros: ' + error.message);

    // Los nuevos miembros ahora tienen este chat → invalidar su caché
    invalidarCacheChatsUsuario(usuarioIds);
  });
};

/**
 * Eliminar un miembro de un chat grupal.
 */
export const eliminarMiembro = async (chatId, usuarioId) => {
  return executeWithTiming('eliminarMiembro', async () => {
    const { error } = await supabase
      .from('chat_miembros')
      .delete()
      .eq('chat_id', chatId)
      .eq('usuario_id', usuarioId);

    if (error) throw new Error('Error al eliminar miembro: ' + error.message);

    // El usuario ya no pertenece a este chat → invalidar su caché
    invalidarCacheChatsUsuario(usuarioId);
  });
};

// ── Mensajes ─────────────────────────────────────────────────────────────────

/**
 * Obtener los últimos mensajes de un chat (paginado).
 */
export const obtenerMensajes = async (chatId, { limite = 50, antes = null } = {}) => {
  return executeWithTiming('obtenerMensajes', async () => {
    let query = supabase
      .from('chat_mensajes')
      .select(`
        id, contenido, creado_en, expira_en,
        usuario:appUsers!chat_mensajes_usuario_id_fkey (id, nombre, Apellidos, foto_perfil)
      `)
      .eq('chat_id', chatId)
      .gt('expira_en', new Date().toISOString()) // excluir mensajes expirados
      .order('creado_en', { ascending: false })
      .limit(limite);

    // Solución: usar OR para incluir mensajes sin expira_en
    // Rehacer con filtro OR manual
    const { data: todos, error } = await supabase
      .from('chat_mensajes')
      .select(`
        id, contenido, creado_en, expira_en,
        usuario:appUsers!chat_mensajes_usuario_id_fkey (id, nombre, Apellidos, foto_perfil)
      `)
      .eq('chat_id', chatId)
      .or(`expira_en.is.null,expira_en.gt.${new Date().toISOString()}`)
      .order('creado_en', { ascending: false })
      .limit(limite);

    if (error) throw new Error('Error al obtener mensajes: ' + error.message);
    return todos.reverse(); // devolver en orden cronológico
  });
};

/**
 * Guardar un mensaje en la base de datos.
 */
export const guardarMensaje = async ({ chatId, usuarioId, contenido, esEfimero, ttlHoras }) => {
  return executeWithTiming('guardarMensaje', async () => {
    let expira_en = null;
    if (esEfimero && ttlHoras) {
      expira_en = new Date(Date.now() + ttlHoras * 3600 * 1000).toISOString();
    }

    const { data, error } = await supabase
      .from('chat_mensajes')
      .insert({ chat_id: chatId, usuario_id: usuarioId, contenido, expira_en })
      .select(`
        id, contenido, creado_en, expira_en,
        usuario:appUsers!chat_mensajes_usuario_id_fkey (id, nombre, Apellidos, foto_perfil)
      `)
      .single();

    if (error) throw new Error('Error al guardar mensaje: ' + error.message);

    // Un mensaje nuevo puede alterar el orden de «chats recientes» → invalidar caché
    // de todos los miembros de este chat (fire-and-forget, no bloquea la respuesta)
    invalidarCachePorChat(chatId).catch(() => {});

    return data;
  });
};

/**
 * Eliminar mensajes expirados (usado por tarea programada).
 */
export const limpiarMensajesExpirados = async () => {
  return executeWithTiming('limpiarMensajesExpirados', async () => {
    const { error } = await supabase
      .from('chat_mensajes')
      .delete()
      .lt('expira_en', new Date().toISOString())
      .not('expira_en', 'is', null);

    if (error) throw new Error('Error al limpiar mensajes: ' + error.message);
  });
};

// ── Archivado ─────────────────────────────────────────────────────────────────

/**
 * Archivar chats efímeros cuyo TTL ha expirado.
 * Un chat efímero caduca cuando: NOW() >= creado_en + ttl_horas * interval '1 hour'
 * Nunca archiva el chat general. Devuelve los IDs archivados para notificar vía WebSocket.
 * @returns {{ archivados: number, ids: string[] }}
 */
export const archivarChatsEfimerosExpirados = async () => {
  return executeWithTiming('archivarChatsEfimerosExpirados', async () => {
    // Obtener todos los chats efímeros activos con su fecha de creación y TTL
    const { data: expirados, error: errExp } = await supabase
      .from('chats')
      .select('id, creado_en, ttl_horas')
      .eq('es_efimero', true)
      .eq('activo', true)
      .eq('archivado', false)
      .neq('tipo', 'general')
      .not('ttl_horas', 'is', null);

    if (errExp) throw new Error('Error buscando chats efímeros: ' + errExp.message);

    // Filtrar los que han superado su TTL en JavaScript (creado_en + ttl_horas <= ahora)
    const ahora = Date.now();
    const idsExpirados = (expirados ?? []).filter(c => {
      const expira = new Date(c.creado_en).getTime() + c.ttl_horas * 3600 * 1000;
      return expira <= ahora;
    }).map(c => c.id);

    if (idsExpirados.length === 0) return { archivados: 0, ids: [] };

    // Archivar marcando archivado = true y registrando la fecha
    const { error: errUpd } = await supabase
      .from('chats')
      .update({ archivado: true, archivado_en: new Date().toISOString() })
      .in('id', idsExpirados);

    if (errUpd) throw new Error('Error archivando chats efímeros: ' + errUpd.message);

    // Invalidar caché de todos los miembros afectados
    for (const chatId of idsExpirados) {
      await invalidarCachePorChat(chatId).catch(() => {});
    }

    return { archivados: idsExpirados.length, ids: idsExpirados };
  });
};

/**
 * Archivar chats inactivos (sin mensajes) pasados N días.
 * Nunca archiva el chat general.
 * Llama a la función SQL que hace el UPDATE atómicamente.
 * @returns {{ archivados: number }}
 */
export const archivarChatsInactivos = async (diasInactividad = 30) => {
  return executeWithTiming('archivarChatsInactivos', async () => {
    const { data, error } = await supabase.rpc('archivar_chats_inactivos', {
      p_dias_inactividad: diasInactividad
    });
    if (error) throw new Error('Error al archivar chats: ' + error.message);
    return { archivados: data?.[0]?.archivados ?? 0 };
  });
};

/**
 * Obtener chats archivados del usuario.
 * Devuelve los chats donde el usuario es miembro y están archivados.
 */
export const obtenerChatsArchivados = async (usuarioId) => {
  return executeWithTiming('obtenerChatsArchivados', async () => {
    const { data, error } = await supabase
      .from('chat_miembros')
      .select(`
        chat:chats (
          id, nombre, descripcion, tipo, es_efimero, ttl_horas, creado_en, archivado, archivado_en,
          creado_por_usuario:appUsers!chats_creado_por_fkey (id, nombre, Apellidos),
          miembros:chat_miembros (
            usuario:appUsers (id, nombre, Apellidos, foto_perfil)
          )
        )
      `)
      .eq('usuario_id', usuarioId)
      .eq('chats.archivado', true)
      .eq('chats.activo', true);

    if (error) throw new Error('Error al obtener chats archivados: ' + error.message);
    return data.map(r => r.chat).filter(Boolean);
  });
};

/**
 * Obtener mensajes de un chat archivado (solo lectura).
 * No filtra por expiración para preservar el historial.
 */
export const obtenerMensajesArchivados = async (chatId, usuarioId, { limite = 100 } = {}) => {
  return executeWithTiming('obtenerMensajesArchivados', async () => {
    // Verificar que el usuario sea miembro
    const { data: miembro } = await supabase
      .from('chat_miembros')
      .select('chat_id')
      .eq('chat_id', chatId)
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (!miembro) throw new Error('No tienes acceso a este chat');

    const { data, error } = await supabase
      .from('chat_mensajes')
      .select(`
        id, contenido, creado_en, expira_en,
        usuario:appUsers!chat_mensajes_usuario_id_fkey (id, nombre, Apellidos, foto_perfil)
      `)
      .eq('chat_id', chatId)
      .order('creado_en', { ascending: true })
      .limit(limite);

    if (error) throw new Error('Error al obtener mensajes archivados: ' + error.message);
    return data;
  });
};

/**
 * Filtrar usuarios disponibles para añadir a un chat según las reglas de roles.
 * - Administradores: pueden añadir a cualquier usuario.
 * - Coordinadores: pueden añadir a los usuarios que coordinan.
 * - Usuarios: solo pueden añadir a sus amigos y coordinadores.
 */
export const filtrarUsuariosPorRol = async (usuarioId, rolUsuario) => {
  return executeWithTiming('filtrarUsuariosPorRol', async () => {
    let query = supabase.from('appUsers').select('id, nombre, Apellidos, rol');

    if (rolUsuario === 'coordinador') {
      query = query.eq('coordinador_id', usuarioId);
    } else if (rolUsuario === 'usuario') {
      query = query.or(`amigos.contains.{${usuarioId}},rol.eq.coordinador`);
    }

    const { data, error } = await query;
    if (error) throw new Error('Error al filtrar usuarios: ' + error.message);

    return data;
  });
};
