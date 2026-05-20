import { Router } from "express";
import { buscar } from "../Controllers/busquedaController.js";

const router = Router();

router.get("/", buscar);

export default router;
