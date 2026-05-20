import * as plantillasDAO from "../DAO/encuestasPlantillasDAO.js";
import * as encuestasDAO   from "../DAO/encuestasDAO.js";
import logger from '../logger.js';

const esAdminOCoordinador = (user) => user?.rol === 1 || user?.rol === 2;
const esAdmin             = (user) => user?.rol === 1;

// ──────────────────────────────────────────────
// GET /api/encuestas/plantillas
// ──────────────────────────────────────────────
export const getPlantillas = async (req, res, next) => {
  try {
    if (!esAdminOCoordinador(req.user)) {
      return res.status(403).json({ message: 'Sin permisos para ver plantillas.' });
    }

    // ?todas=1 → devuelve activas e inactivas (para vista de gestión)
    // por defecto solo devuelve las activas (para el drawer de importar preguntas)
    const soloActivas = req.query.todas !== '1';

    const plantillas = await plantillasDAO.obtenerPlantillas({
      usuarioRol:  req.user.rol,
      usuarioId:   req.user.id,
      soloActivas,
    });

    res.json(plantillas);
  } catch (err) {
    next(err);
  }
};

// ──────────────────────────────────────────────
// GET /api/encuestas/plantillas/:id
// ──────────────────────────────────────────────
export const getPlantillaPorId = async (req, res, next) => {
  try {
    if (!esAdminOCoordinador(req.user)) {
      return res.status(403).json({ message: 'Sin permisos.' });
    }

    const plantilla = await plantillasDAO.obtenerPlantillaPorId(req.params.id);
    if (!plantilla) {
      return res.status(404).json({ message: 'Plantilla no encontrada.' });
    }

    // Coordinador solo puede ver sus propias o las globales
    if (req.user.rol === 2 && plantilla.creado_por && plantilla.creado_por !== req.user.id) {
      return res.status(403).json({ message: 'Sin permisos para esta plantilla.' });
    }

    res.json(plantilla);
  } catch (err) {
    next(err);
  }
};

// ──────────────────────────────────────────────
// POST /api/encuestas/plantillas
// ──────────────────────────────────────────────
export const crearPlantilla = async (req, res, next) => {
  try {
    if (!esAdminOCoordinador(req.user)) {
      return res.status(403).json({ message: 'Sin permisos para crear plantillas.' });
    }

    const { titulo, descripcion, rol_objetivo, preguntas } = req.body;

    if (!titulo?.trim()) {
      return res.status(400).json({ message: 'El título es obligatorio.' });
    }
    if (!Array.isArray(preguntas) || preguntas.length === 0) {
      return res.status(400).json({ message: 'La plantilla debe tener al menos una pregunta.' });
    }

    const creado_por = req.user.id;

    const plantilla = await plantillasDAO.crearPlantilla({
      titulo: titulo.trim(),
      descripcion,
      creado_por,
      rol_objetivo: rol_objetivo != null ? Number(rol_objetivo) : null,
      preguntas,
    });

    logger.info(`[PLANTILLAS] Plantilla creada: #${plantilla.id} "${plantilla.titulo}" por ${creado_por}`);
    res.status(201).json(plantilla);
  } catch (err) {
    next(err);
  }
};

// ──────────────────────────────────────────────
// PUT /api/encuestas/plantillas/:id
// ──────────────────────────────────────────────
export const actualizarPlantilla = async (req, res, next) => {
  try {
    if (!esAdminOCoordinador(req.user)) {
      return res.status(403).json({ message: 'Sin permisos.' });
    }

    const plantilla = await plantillasDAO.obtenerPlantillaPorId(req.params.id);
    if (!plantilla) return res.status(404).json({ message: 'Plantilla no encontrada.' });

    if (req.user.rol === 2 && plantilla.creado_por !== req.user.id) {
      return res.status(403).json({ message: 'Solo puedes editar tus propias plantillas.' });
    }

    const cambios = {};
    if (req.body.titulo     !== undefined) cambios.titulo      = req.body.titulo;
    if (req.body.descripcion!== undefined) cambios.descripcion = req.body.descripcion;
    if (req.body.activa     !== undefined) cambios.activa      = req.body.activa;
    if (req.body.rol_objetivo!== undefined) cambios.rol_objetivo = req.body.rol_objetivo;

    await plantillasDAO.incrementarVersionPlantilla(plantilla.id);
    const actualizada = await plantillasDAO.actualizarPlantilla(plantilla.id, cambios);

    res.json(actualizada);
  } catch (err) {
    next(err);
  }
};

// ──────────────────────────────────────────────
// DELETE /api/encuestas/plantillas/:id
// ──────────────────────────────────────────────
export const eliminarPlantilla = async (req, res, next) => {
  try {
    if (!esAdminOCoordinador(req.user)) {
      return res.status(403).json({ message: 'Sin permisos.' });
    }

    const plantilla = await plantillasDAO.obtenerPlantillaPorId(req.params.id);
    if (!plantilla) return res.status(404).json({ message: 'Plantilla no encontrada.' });

    if (req.user.rol === 2 && plantilla.creado_por !== req.user.id) {
      return res.status(403).json({ message: 'Solo puedes eliminar tus propias plantillas.' });
    }

    await plantillasDAO.eliminarPlantilla(plantilla.id);
    logger.info(`[PLANTILLAS] Plantilla eliminada: #${plantilla.id} por ${req.user.id}`);
    res.json({ message: 'Plantilla eliminada correctamente.' });
  } catch (err) {
    next(err);
  }
};

// ──────────────────────────────────────────────
// POST /api/encuestas/plantillas/:id/crear-encuesta
// Crea una encuesta nueva a partir de esta plantilla
// ──────────────────────────────────────────────
export const crearEncuestaDesde = async (req, res, next) => {
  try {
    if (!esAdminOCoordinador(req.user)) {
      return res.status(403).json({ message: 'Sin permisos para crear encuestas.' });
    }

    const plantilla = await plantillasDAO.obtenerPlantillaPorId(req.params.id);
    if (!plantilla) return res.status(404).json({ message: 'Plantilla no encontrada.' });

    const { titulo, descripcion, fecha_fin, rol_objetivo } = req.body;

    if (!fecha_fin) {
      return res.status(400).json({ message: 'fecha_fin es obligatoria.' });
    }

    const rol_obj = req.user.rol === 2 ? 3 : (rol_objetivo != null ? Number(rol_objetivo) : null);

    const encuestaId = await plantillasDAO.crearEncuestaDesde(plantilla.id, {
      titulo:       titulo || plantilla.titulo,
      descripcion:  descripcion || plantilla.descripcion,
      fecha_fin,
      creado_por:   req.user.id,
      rol_objetivo: rol_obj,
    });

    logger.info(`[PLANTILLAS] Encuesta #${encuestaId} creada desde plantilla #${plantilla.id} por ${req.user.id}`);
    res.status(201).json({ encuesta_id: encuestaId, message: 'Encuesta creada correctamente desde la plantilla.' });
  } catch (err) {
    next(err);
  }
};
