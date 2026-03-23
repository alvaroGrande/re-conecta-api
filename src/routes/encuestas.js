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

const router = Router();

// Rutas públicas (requieren autenticación pero no permisos especiales)
router.get("/", getEncuestas);
router.get("/:id", getEncuestaPorId);
router.get("/:id/resultados", getResultadosEncuesta);

// Responder a una encuesta (cualquier usuario autenticado)
router.post("/:id/respuestas", responderEncuesta);

// Rutas de administrador (verificación de rol dentro del controlador)
router.post("/", crearEncuesta);
router.patch("/:id/publicar", publicarEncuesta);
router.get("/:id/respuestas-detalladas", getRespuestasDetalladas);
router.get("/:id/respuestas-usuario/:usuarioId", getRespuestasDeUsuario);
router.put("/:id/cerrar", cerrarEncuesta);

export default router;
