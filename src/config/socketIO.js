import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config.js';
import logger from '../logger.js';
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
