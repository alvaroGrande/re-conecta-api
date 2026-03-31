import { Router } from "express"
import { requireRole } from "../middlewares/auth.js"
import {
  getCategorias,
  getValoresByCategoria,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
  crearValor,
  actualizarValor,
  eliminarValor,
  reordenarValores,
} from "../Controllers/lovController.js"

const router = Router()

// ── Admin: gestión de categorías ─────────────────────────────────────────────
router.get("/",                requireRole(1), getCategorias)
router.post("/",               requireRole(1), crearCategoria)

// ── Admin: gestión de valores dentro de una categoría ────────────────────────
router.put("/valores/:id",                     requireRole(1), actualizarValor)
router.delete("/valores/:id",                  requireRole(1), eliminarValor)
router.post("/:categoriaId/valores/reordenar", requireRole(1), reordenarValores)
router.post("/:categoriaId/valores",           requireRole(1), crearValor)

// ── Admin: editar/eliminar categoría por ID ───────────────────────────────────
router.put("/:id",             requireRole(1), actualizarCategoria)
router.delete("/:id",          requireRole(1), eliminarCategoria)

// ── Autenticados: obtener valores de un LOV por código (con caché backend) ───
router.get("/:codigo",                         getValoresByCategoria)

export default router
