import { Router } from 'express';
import { requireRole } from '../middlewares/auth.js';
import {
  getPermisos,
  getPermisosDisponibles,
  updatePermisos,
  resetPermisos,
} from '../Controllers/rolesPermisosController.js';

const router = Router();

// Solo el Administrador (rol 1) puede gestionar roles
router.get('/disponibles', requireRole(1), getPermisosDisponibles);
router.get('/', requireRole(1), getPermisos);
router.put('/', requireRole(1), updatePermisos);
router.delete('/', requireRole(1), resetPermisos);

export default router;
