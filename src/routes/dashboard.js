import { Router } from 'express';
import { verifyToken } from '../middlewares/auth.js';
import {
  getEstadisticas,
  getEstadisticasUsuarios,
  getEstadisticasTalleres,
  getEstadisticasEncuestas,
  getDistribucionRoles,
  getActividadPorDias,
  getUsuariosConectados,
  getActividadReciente
} from '../Controllers/dashboardController.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Rutas del dashboard
router.get('/estadisticas', getEstadisticas);
router.get('/estadisticas/usuarios', getEstadisticasUsuarios);
router.get('/estadisticas/talleres', getEstadisticasTalleres);
router.get('/estadisticas/encuestas', getEstadisticasEncuestas);
router.get('/distribucion-roles', getDistribucionRoles);
router.get('/actividad-dias', getActividadPorDias);
router.get('/usuarios-conectados', getUsuariosConectados);
router.get('/actividad-reciente', getActividadReciente);
router.get('/actividad-reciente/:id', getActividadReciente);

export default router;
