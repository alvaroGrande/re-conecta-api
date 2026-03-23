import { Router } from "express";
import { 
    createRoom, 
    getMeetingSignature, 
    getMeetingInfo,
    getMyVideocalls,
    getAllVideocalls
} from "../Controllers/videoCallsController.js";
import { verifyToken } from "../middlewares/auth.js";

const router = Router();

// Crear sala y obtener firma (requieren autenticación)
router.post("/create-room", verifyToken, createRoom);
router.post("/signature", getMeetingSignature); // Sin auth para permitir invitados

// Obtener información de reuniones
router.get("/meeting/:meetingId", getMeetingInfo);
router.get("/my-videocalls", verifyToken, getMyVideocalls);
router.get("/all-videocalls", verifyToken, getAllVideocalls); // Solo admin

export default router;
