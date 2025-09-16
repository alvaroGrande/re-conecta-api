import express from "express";
import cors from "cors";
import { errorHandler } from "./middlewares/errorHandler.js";
import compression from "compression"
import { rateLimit } from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Limitar cada IP a 100 solicitudes por ventana (aquí, por 15 minutos)
  standardHeaders: true, // Retorna información de límite en las cabeceras `RateLimit-*`
  legacyHeaders: false, // Deshabilita las cabeceras `X-RateLimit-*`
});

const app = express();

// Middlewares
app.use(limiter);
app.use(cors());
app.use(express.json());
app.use(compression());

// Rutas de ejemplo
app.get("/", (req, res) => {
  res.json({ message: "API funcionando 🚀" });
});

import talleresRoutes from "./routes/talleres.js";
app.use("/api/talleres", talleresRoutes);

app.use(errorHandler);

export default app;
