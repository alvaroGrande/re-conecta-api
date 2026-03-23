import { Router } from "express";
import { requireRole } from "../middlewares/auth.js";
import {
  getTalleres,
  getTallerPorId,
  crearTaller,
  editarTaller,
  eliminarTaller,
  activarTaller,
  desactivarTaller,
  cancelarTaller,
  inscribirTaller,
  desinscribirTaller,
  inscribirUsuarioSupervisor,
  desinscribirUsuarioSupervisor,
  getInscritos,
  getMiInscripcion,
  getMotivosCancelacion,
} from "../Controllers/talleresController.js";
import {
  getTalleresArchivados,
  getResumenArchivados,
  getTallerArchivadoDetalle,
  patchAsistencia,
} from "../Controllers/talleresArchivadosController.js";

const router = Router();

// ─── Catálogo de motivos de cancelación (todos los roles autenticados) ─────────
router.get("/motivos-cancelacion", getMotivosCancelacion);

// ─── Talleres archivados (admin) — ANTES de /:id para evitar conflicto ────────
router.get("/archivados", requireRole(1), getTalleresArchivados);                        // listar (filtros: anio, mes)
router.get("/archivados/resumen", requireRole(1), getResumenArchivados);                 // agrupado por año/mes
router.get("/archivados/:id", requireRole(1), getTallerArchivadoDetalle);                // detalle + inscripciones
router.patch("/archivados/:id/asistencia/:usuarioId", requireRole(1), patchAsistencia);  // marcar asistencia

// ─── CRUD básico ─────────────────────────────────────────────────────────────
router.get("/", getTalleres);
router.get("/:id", getTallerPorId);
router.post("/", requireRole(1), crearTaller);                // solo admin
router.patch("/:id", requireRole(1), editarTaller);           // solo admin
router.delete("/:id", requireRole(1), eliminarTaller);        // solo admin
router.patch("/:id/activar", requireRole(1), activarTaller);  // solo admin
router.patch("/:id/desactivar", requireRole(1), desactivarTaller); // solo admin
router.patch("/:id/cancelar", requireRole(1), cancelarTaller); // solo admin

// ─── Inscripciones propias ────────────────────────────────────────────────────
router.get("/:id/mi-inscripcion", getMiInscripcion);
router.post("/:id/inscribir", inscribirTaller);
router.delete("/:id/inscribir", desinscribirTaller);

// ─── Gestión de inscritos (admin / supervisor) ────────────────────────────────
router.get("/:id/inscritos", requireRole(1, 2), getInscritos);
router.post("/:tallerId/inscribir/:usuarioId", requireRole(1, 2), inscribirUsuarioSupervisor);
router.delete("/:tallerId/inscribir/:usuarioId", requireRole(1, 2), desinscribirUsuarioSupervisor);

export default router;