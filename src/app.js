import express from "express";
import pinoHttp from "pino-http";
import logger from "./logger.js";
import cors from "cors";
import { errorHandler } from "./middlewares/errorHandler.js";
import compression from "compression"
import { rateLimit } from 'express-rate-limit'
import { verifyToken } from "./middlewares/auth.js";


const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 1000, // Limitar cada IP a 1000 solicitudes por ventana (aquí, por 1 minuto)
  standardHeaders: true, // Retorna información de límite en las cabeceras `RateLimit-*`
  legacyHeaders: false, // Deshabilita las cabeceras `X-RateLimit-*`
});

const app = express();

// Socket.IO será inyectado desde server.js
let ioInstance = null;

export const setIO = (io) => {
  ioInstance = io;
  app.set('io', io);
};

// Middleware para inyectar io en cada request
app.use((req, res, next) => {
  if (ioInstance) {
    req.io = ioInstance;
  }
  next();
});

app.use(pinoHttp({ 
  logger : logger,
  autoLogging: false
}));

// Middlewares
app.use(limiter);
// CORS - Configuración permisiva para desarrollo
app.use(cors({
  origin: true, // Permite cualquier origen en desarrollo
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // Cache preflight por 24 horas
}));
app.use(express.json());
app.use(compression());


// Rutas de ejemplo
app.get("/", (req, res) => {
  res.json({ message: "API funcionando y conectada" });
});

import authRoutes from "./routes/auth.js";
app.use("/api/auth", authRoutes);
app.use(verifyToken);
import talleresRoutes from "./routes/talleres.js";
app.use("/api/talleres", talleresRoutes);

import videoCallsRoutes from "./routes/videoCalls.js";
import usersRoutes from "./routes/users.js";
import encuestasRoutes from "./routes/encuestas.js";
import contactosRoutes from "./routes/contactos.js";
import notificacionesRoutes from "./routes/notificaciones.js";
import dashboardRoutes from "./routes/dashboard.js";
import tasksRoutes from "./routes/tasks.js";
import testRoutes from "./routes/test.js";
import recordatoriosRoutes from "./routes/recordatorios.js";
app.use("/api/usuarios", usersRoutes);
app.use("/api/video-calls", videoCallsRoutes);
app.use("/api/encuestas", encuestasRoutes);
app.use("/api/contactos", contactosRoutes);
app.use("/api/notificaciones", notificacionesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/test", testRoutes);
app.use("/api/recordatorios", recordatoriosRoutes);


app.use(errorHandler);

export default app;
