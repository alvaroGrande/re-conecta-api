import { Router } from 'express';
import * as notificacionesController from '../Controllers/notificacionesController.js';
import { verifyToken, requireRole } from '../middlewares/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Obtener notificaciones del usuario (extendido)
router.get('/', notificacionesController.getNotificaciones);

// Contar notificaciones no leídas
router.get('/no-leidas/count', notificacionesController.getContadorNoLeidas);

// Configuración de notificaciones del usuario
router.get('/config', notificacionesController.getConfigNotificaciones);
router.put('/config', notificacionesController.actualizarConfigNotificacion);

// Crear notificación individual
router.post('/', notificacionesController.crearNotificacion);

// Enviar notificación masiva
router.post('/masiva', notificacionesController.enviarNotificacionMasiva);

// Notificaciones enviadas (historial del emisor)
router.get('/enviadas', notificacionesController.getNotificacionesEnviadas);

// Marcar notificación como leída
router.patch('/:id/leida', notificacionesController.marcarLeida);

// Marcar todas como leídas
router.patch('/todas/leidas', notificacionesController.marcarTodasLeidas);

// Eliminar una notificación
router.delete('/:id', notificacionesController.eliminarNotificacion);

// Plantillas (solo admin)
router.get('/plantillas', requireRole(1), notificacionesController.getPlantillas);

// Estado de servicios de notificación (solo admin)
router.get('/servicios/estado', requireRole(1), notificacionesController.getEstadoServicios);

// Cola de notificaciones (solo admin)
router.get('/cola', requireRole(1), notificacionesController.getColaNotificaciones);

export default router;
