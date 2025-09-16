import express from "express";
import cors from "cors";
import { errorHandler } from "./middlewares/errorHandler.js";
import compression from "compression"

const app = express();

// Middlewares
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
