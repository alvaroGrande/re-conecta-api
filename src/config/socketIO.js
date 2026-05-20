import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config.js';
import logger from '../logger.js';
import * as chatDAO from '../DAO/chatDAO.js';
const { SECRET } = config.JWT;
/**
 * Configurar Socket.IO con autenticación
 */
export const setupSocketIO = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: true, // Permite cualquier origen en desarrollo
      credentials: true,
      methods: ["GET", "POST"]
    }
  });

  // Middleware de autenticación para Socket.IO
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Autenticación requerida'));
    }

    try {
      const decoded = jwt.verify(token, SECRET);
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Token inválido'));
    }
  });

  // Eventos de conexión
  io.on('connection', (socket) => {
    const userId = socket.user.id;
    logger.info(`Usuario conectado: ${socket.user.email} (${userId})`);

    // Unir al usuario a su sala personal
    socket.join(`user_${userId}`);

    // Evento: Usuario en línea
    socket.on('online', () => {
      socket.broadcast.emit('user_online', { userId, email: socket.user.email });
    });

    // Evento: Usuario escribiendo
    socket.on('typing', (data) => {
      const { receptorId } = data;
      io.to(`user_${receptorId}`).emit('user_typing', {
        userId,
        nombre: socket.user.nombre
      });
    });

    // Evento: Usuario dejó de escribir
    socket.on('stop_typing', (data) => {
      const { receptorId } = data;
      io.to(`user_${receptorId}`).emit('user_stop_typing', { userId });
    });

    // Evento: Marcar notificación como leída (broadcast a otros dispositivos del mismo usuario)
    socket.on('notificacion_leida', (data) => {
      const { notificacionId } = data;
      socket.to(`user_${userId}`).emit('notificacion_marcada_leida', { notificacionId });
    });

    // Evento de desconexión
    socket.on('disconnect', () => {
      // console.log(`✗ Usuario desconectado: ${socket.user.email}`);
      socket.broadcast.emit('user_offline', { userId });
    });

    // ── Chat ────────────────────────────────────────────────────────────────

    /**
     * Unirse a las salas Socket.IO de los chats del usuario.
     * El cliente emite esto al abrir el chat.
     */
    socket.on('chat:conectar', async () => {
      try {
        const chats = await chatDAO.obtenerChatsDeUsuario(userId);
        chats.forEach(chat => socket.join(`chat_${chat.id}`));
      } catch (err) {
        logger.warn(`chat:conectar error para usuario ${userId}: ${err.message}`);
      }
    });

    /**
     * Unirse a la sala de un chat concreto.
     * Verifica que el usuario sea miembro antes de hacer join.
     */
    socket.on('chat:unirse', async (data) => {
      const { chatId } = data || {};
      if (!chatId) return;

      try {
        const chats = await chatDAO.obtenerChatsDeUsuario(userId);
        const esMiembro = chats.some(c => c.id === chatId);
        if (!esMiembro) {
          logger.warn(`chat:unirse rechazado — usuario ${userId} no pertenece al chat ${chatId}`);
          socket.emit('chat:error', { message: 'No tienes acceso a este chat' });
          return;
        }
        socket.join(`chat_${chatId}`);
      } catch (err) {
        logger.warn(`chat:unirse error para usuario ${userId}: ${err.message}`);
      }
    });

    /**
     * Enviar un mensaje a un chat.
     * El servidor persiste el mensaje y lo emite a todos los miembros de la sala.
     */
    socket.on('chat:mensaje', async (data) => {
      const { chatId, contenido } = data || {};
      if (!chatId || !contenido?.trim()) return;

      try {
        // Obtener info del chat para saber si es efímero
        const chat = await chatDAO.obtenerChatPorId(chatId, userId);

        const mensaje = await chatDAO.guardarMensaje({
          chatId,
          usuarioId: userId,
          contenido: contenido.trim(),
          esEfimero: chat.es_efimero,
          ttlHoras: chat.ttl_horas
        });

        // Emitir a todos los miembros de la sala (incluido el emisor)
        io.to(`chat_${chatId}`).emit('chat:nuevo_mensaje', { chatId, mensaje });
      } catch (err) {
        logger.warn(`chat:mensaje error: ${err.message}`);
        socket.emit('chat:error', { message: 'No se pudo enviar el mensaje' });
      }
    });

    /**
     * Indicador de "está escribiendo" dentro de un chat.
     */
    socket.on('chat:escribiendo', (data) => {
      const { chatId } = data || {};
      if (!chatId) return;
      socket.to(`chat_${chatId}`).emit('chat:usuario_escribiendo', {
        chatId,
        userId,
        nombre: socket.user.nombre
      });
    });

    socket.on('chat:parar_escribiendo', (data) => {
      const { chatId } = data || {};
      if (!chatId) return;
      socket.to(`chat_${chatId}`).emit('chat:usuario_paró_escribiendo', { chatId, userId });
    });
  });

  console.log('✓ Socket.IO configurado correctamente');
  return io;
};

/**
 * Middleware para inyectar io en las peticiones HTTP
 */
export const injectIO = (io) => {
  return (req, res, next) => {
    req.io = io;
    next();
  };
};
