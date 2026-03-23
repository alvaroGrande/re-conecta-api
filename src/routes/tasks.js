import { Router } from 'express';
import * as tasksController from '../Controllers/tasksController.js';
import { verifyToken } from '../middlewares/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Obtener últimas ejecuciones
router.get('/ejecuciones', tasksController.getUltimasEjecuciones);

// Obtener resumen de tareas
router.get('/resumen', tasksController.getResumenTareas);

// Obtener estadísticas de tareas
router.get('/estadisticas', tasksController.getEstadisticasTareas);

// Obtener estadísticas de actividades
router.get('/estadisticas-actividad', tasksController.getEstadisticasActividad);

// Obtener estadísticas de queries
router.get('/estadisticas-queries', tasksController.getEstadisticasQueries);

// Obtener queries más lentas
router.get('/queries-lentas', tasksController.getQueriesMasLentas);

// Obtener historial de una tarea específica
router.get('/historial/:nombreTarea', tasksController.getHistorialTarea);

// Ejecutar tarea manualmente (solo admin)
router.post('/ejecutar/:nombreTarea', tasksController.ejecutarTareaManualmente);

// Obtener estadísticas del caché
router.get('/cache/stats', tasksController.getCacheStats);

// Obtener detalles de todas las entradas del caché (solo admin)
router.get('/cache/details', tasksController.getCacheDetails);

// Obtener datos de una entrada específica del caché (solo admin)
router.get('/cache/entry/:key', tasksController.getCacheEntryData);

// Limpiar caché (solo admin)
router.delete('/cache/clear', tasksController.clearCache);

// Eliminar entrada específica del caché (solo admin)
router.delete('/cache/entry/:key', tasksController.deleteCacheEntry);

export default router;
