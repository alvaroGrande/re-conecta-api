import { Router } from "express";

import { login, logout, getProfile } from "../Controllers/authController.js";
import { verifyToken } from "../middlewares/auth.js";

const router = Router();

router.post("/login", login);
router.post("/logout", verifyToken, logout);
router.post("/me", getProfile);
export default router;
