import { Router } from "express";
import { 
  getEncuestas, 
  getEncuestaPorId, 
  crearEncuesta, 
  responderEncuesta, 
  getResultadosEncuesta,
  publicarEncuesta,
  getRespuestasDetalladas,
  getRespuestasDeUsuario,
  cerrarEncuesta
} from "../Controllers/encuestasController.js";
import {
  getPlantillas,
  getPlantillaPorId,
  crearPlantilla,
  actualizarPlantilla,
  eliminarPlantilla,
  crearEncuestaDesde,
} from "../Controllers/encuestasPlantillasController.js";

const router = Router();

// ── Plantillas (deben ir antes de /:id para evitar conflictos) ──
router.get("/plantillas",            getPlantillas);
router.get("/plantillas/:id",        getPlantillaPorId);
router.post("/plantillas",           crearPlantilla);
router.put("/plantillas/:id",        actualizarPlantilla);
router.delete("/plantillas/:id",     eliminarPlantilla);
router.post("/plantillas/:id/crear-encuesta", crearEncuestaDesde);

// ── Encuestas ──
router.get("/", getEncuestas);
router.get("/:id", getEncuestaPorId);
router.get("/:id/resultados", getResultadosEncuesta);
router.post("/:id/respuestas", responderEncuesta);
router.post("/", crearEncuesta);
router.patch("/:id/publicar", publicarEncuesta);
router.get("/:id/respuestas-detalladas", getRespuestasDetalladas);
router.get("/:id/respuestas-usuario/:usuarioId", getRespuestasDeUsuario);
router.put("/:id/cerrar", cerrarEncuesta);

export default router;
