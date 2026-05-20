import { Router } from 'express';
import { requireRole } from '../middlewares/auth.js';
import * as chatController from '../Controllers/chatController.js';

const router = Router();

// GET  /api/chat           — Lista de chats del usuario
router.get('/', chatController.getChats);

// GET  /api/chat/archivados — Lista de chats archivados del usuario
router.get('/archivados', chatController.getChatsArchivados);

// GET  /api/chat/archivados/:id/mensajes — Mensajes de chat archivado
router.get('/archivados/:id/mensajes', chatController.getMensajesArchivados);

// POST /api/chat/directo/:usuarioId — Obtener o crear chat directo
router.post('/directo/:usuarioId', chatController.iniciarChatDirecto);

// POST /api/chat           — Crear chat grupal (solo admin y coordinador)
router.post('/', requireRole(1, 2), chatController.crearChat);

// GET  /api/chat/:id       — Detalle de un chat
router.get('/:id', chatController.getChatPorId);

// PUT  /api/chat/:id       — Actualizar chat grupal
router.put('/:id', chatController.actualizarChat);

// DELETE /api/chat/:id     — Eliminar chat grupal
router.delete('/:id', chatController.eliminarChat);

// GET  /api/chat/:id/mensajes  — Mensajes del chat
router.get('/:id/mensajes', chatController.getMensajes);

// POST /api/chat/:id/miembros  — Añadir miembros
router.post('/:id/miembros', requireRole(1, 2), chatController.añadirMiembros);

// DELETE /api/chat/:id/miembros/:usuarioId — Quitar miembro
router.delete('/:id/miembros/:usuarioId', chatController.eliminarMiembro);

export default router;
