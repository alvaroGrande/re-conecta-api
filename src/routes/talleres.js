import { Router } from "express";
import { getTalleres, getTallerPorId, crearTaller, activarTaller, desactivarTaller, inscribirTaller } from "../Controllers/talleresController.js";

const router = Router();

router.get("/", getTalleres);
router.get("/:id", getTallerPorId);
router.post("/", crearTaller);
router.patch("/:id/activar", activarTaller);
router.patch("/:id/desactivar", desactivarTaller);
router.post("/inscribir/:id", inscribirTaller);

export default router;
