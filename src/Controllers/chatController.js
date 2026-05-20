import * as chatDAO from '../DAO/chatDAO.js';
import logger from '../logger.js';

// ── Archivados ────────────────────────────────────────────────────────────────

/**
 * GET /api/chat/archivados
 * Lista de chats archivados del usuario autenticado.
 */
export const getChatsArchivados = async (req, res, next) => {
  try {
    const chats = await chatDAO.obtenerChatsArchivados(req.user.id);
    res.json({ data: chats });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/chat/archivados/:id/mensajes
 * Mensajes de un chat archivado (solo lectura).
 */
export const getMensajesArchivados = async (req, res, next) => {
  try {
    const mensajes = await chatDAO.obtenerMensajesArchivados(req.params.id, req.user.id);
    res.json({ data: mensajes });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/chat/directo/:usuarioId
 * Obtiene o crea un chat directo con el usuario indicado.
 */
export const iniciarChatDirecto = async (req, res, next) => {
  try {
    const { usuarioId: destinatarioId } = req.params
    const remitenteId = req.user.id

    if (remitenteId === destinatarioId) {
      return res.status(400).json({ message: 'No puedes iniciar un chat contigo mismo' })
    }

    const { chat, creado } = await chatDAO.obtenerOCrearChatDirecto(remitenteId, destinatarioId)

    // Si es nuevo, notificar al destinatario
    if (creado) {
      const io = req.io
      if (io) {
        io.to(`user_${destinatarioId}`).emit('chat:nuevo_directo', { chat })
      }
    }

    res.status(creado ? 201 : 200).json({ data: chat })
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/chat
 * Devuelve todos los chats del usuario autenticado.
 */
export const getChats = async (req, res, next) => {
  try {
    const chats = await chatDAO.obtenerChatsDeUsuario(req.user.id);
    res.json({ data: chats });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/chat/:id
 * Devuelve el detalle de un chat (con miembros).
 */
export const getChatPorId = async (req, res, next) => {
  try {
    const chat = await chatDAO.obtenerChatPorId(req.params.id, req.user.id);
    res.json({ data: chat });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/chat
 * Crea un chat grupal. Solo admins y coordinadores.
 */
export const crearChat = async (req, res, next) => {
  try {
    const { nombre, descripcion, es_efimero, ttl_horas, miembros } = req.body;

    if (!nombre?.trim()) {
      return res.status(400).json({ message: 'El nombre del chat es obligatorio' });
    }

    const chat = await chatDAO.crearChat({
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
      es_efimero: Boolean(es_efimero),
      ttl_horas: es_efimero ? (parseInt(ttl_horas) || 24) : null,
      miembros: miembros || [],
      creadoPor: req.user.id
    });

    // Notificar a los miembros via Socket.IO
    const io = req.io;
    if (io && miembros?.length) {
      miembros.forEach(uid => {
        io.to(`user_${uid}`).emit('chat:nuevo_grupo', { chat });
      });
    }

    logger.info(`Chat grupal creado: ${chat.id} por usuario ${req.user.id}`);
    res.status(201).json({ data: chat });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/chat/:id
 * Actualiza un chat grupal. Solo el creador o un admin.
 */
export const actualizarChat = async (req, res, next) => {
  try {
    const chat = await chatDAO.obtenerChatPorId(req.params.id, req.user.id);

    if (chat.tipo === 'general') {
      return res.status(403).json({ message: 'El chat general no se puede modificar' });
    }

    const esAdmin = req.user.rol === 1;
    const esCreador = chat.creado_por_usuario?.id === req.user.id;
    if (!esAdmin && !esCreador) {
      return res.status(403).json({ message: 'Sin permisos para modificar este chat' });
    }

    const actualizado = await chatDAO.actualizarChat(req.params.id, req.body);
    res.json({ data: actualizado });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/chat/:id
 * Elimina (desactiva) un chat grupal. Solo el creador o un admin.
 */
export const eliminarChat = async (req, res, next) => {
  try {
    const chat = await chatDAO.obtenerChatPorId(req.params.id, req.user.id);

    if (chat.tipo === 'general') {
      return res.status(403).json({ message: 'El chat general no se puede eliminar' });
    }

    const esAdmin = req.user.rol === 1;
    const esCreador = chat.creado_por_usuario?.id === req.user.id;
    if (!esAdmin && !esCreador) {
      return res.status(403).json({ message: 'Sin permisos para eliminar este chat' });
    }

    await chatDAO.eliminarChat(req.params.id);

    // Notificar a todos los miembros
    const io = req.io;
    if (io && chat.miembros) {
      chat.miembros.forEach(m => {
        if (m.usuario?.id) {
          io.to(`user_${m.usuario.id}`).emit('chat:eliminado', { chatId: req.params.id });
        }
      });
    }

    res.json({ message: 'Chat eliminado correctamente' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/chat/:id/miembros
 * Añade miembros a un chat grupal.
 */
export const añadirMiembros = async (req, res, next) => {
  try {
    const { usuarios } = req.body;
    if (!Array.isArray(usuarios) || usuarios.length === 0) {
      return res.status(400).json({ message: 'Debes indicar al menos un usuario' });
    }

    await chatDAO.añadirMiembros(req.params.id, usuarios);

    const io = req.io;
    if (io) {
      const chat = await chatDAO.obtenerChatPorId(req.params.id, req.user.id);
      usuarios.forEach(uid => {
        io.to(`user_${uid}`).emit('chat:nuevo_grupo', { chat });
      });
    }

    res.json({ message: 'Miembros añadidos correctamente' });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/chat/:id/miembros/:usuarioId
 * Elimina un miembro de un chat grupal.
 */
export const eliminarMiembro = async (req, res, next) => {
  try {
    const { id: chatId, usuarioId } = req.params;
    const esAdmin = req.user.rol === 1;
    const esSiMismo = usuarioId === req.user.id;

    if (!esAdmin && !esSiMismo) {
      return res.status(403).json({ message: 'Sin permisos para realizar esta acción' });
    }

    await chatDAO.eliminarMiembro(chatId, usuarioId);
    res.json({ message: 'Miembro eliminado correctamente' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/chat/:id/mensajes
 * Obtiene los mensajes de un chat (paginado).
 * Verifica que el usuario sea miembro del chat antes de devolver los mensajes.
 */
export const getMensajes = async (req, res, next) => {
  try {
    // Reutilizamos obtenerChatPorId que ya verifica membresía y lanza error si no pertenece
    await chatDAO.obtenerChatPorId(req.params.id, req.user.id);

    const limite = Math.min(parseInt(req.query.limite) || 50, 200);
    const antes = req.query.antes || null;

    const mensajes = await chatDAO.obtenerMensajes(req.params.id, { limite, antes });
    res.json({ data: mensajes });
  } catch (error) {
    if (error.message === 'No tienes acceso a este chat' || error.message === 'Chat no encontrado') {
      return res.status(403).json({ message: error.message });
    }
    next(error);
  }
};
