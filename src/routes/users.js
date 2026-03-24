import { Router } from "express";
import { getUsers, getUserById, createUser, updateUser, deleteUser, uploadProfilePhoto, uploadPhotoChunk } from "../Controllers/usersController.js";
import { verifyToken } from '../middlewares/auth.js';

const router = Router();

// Aplicar autenticación a todas las rutas
router.use(verifyToken);

router.get("/", getUsers);
router.get("/:id", getUserById);
router.post("/", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);
router.post("/:id/foto/chunk", uploadPhotoChunk); // debe ir antes de /:id/foto
router.post("/:id/foto", uploadProfilePhoto);

export default router;

