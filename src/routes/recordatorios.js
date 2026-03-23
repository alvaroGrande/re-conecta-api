import { Router } from 'express';
import * as recordatoriosController from '../Controllers/recordatoriosController.js';

const router = Router();

// GET /api/recordatorios
router.get('/', recordatoriosController.getRecordatorios);

// POST /api/recordatorios
router.post('/', recordatoriosController.crearRecordatorio);

// PATCH /api/recordatorios/:id
router.patch('/:id', recordatoriosController.actualizarRecordatorio);

// DELETE /api/recordatorios/:id
router.delete('/:id', recordatoriosController.eliminarRecordatorio);

export default router;
