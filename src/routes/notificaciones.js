import { Router } from 'express';
import * as notificacionesController from '../Controllers/notificacionesController.js';
import { verifyToken } from '../middlewares/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Obtener notificaciones del usuario
router.get('/', notificacionesController.getNotificaciones);

// Contar notificaciones no leídas
router.get('/no-leidas/count', notificacionesController.getContadorNoLeidas);

// Obtener notificaciones enviadas
router.get('/enviadas', notificacionesController.getNotificacionesEnviadas);

// Crear notificación individual
router.post('/', notificacionesController.crearNotificacion);

// Enviar notificación masiva
router.post('/masiva', notificacionesController.enviarNotificacionMasiva);

// Marcar notificación como leída
router.patch('/:id/leida', notificacionesController.marcarLeida);

// Marcar todas como leídas
router.patch('/todas/leidas', notificacionesController.marcarTodasLeidas);

// Eliminar notificación
router.delete('/:id', notificacionesController.eliminarNotificacion);

export default router;
