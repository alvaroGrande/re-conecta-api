import * as talleresDAO from "../DAO/talleresDAO.js";
// import ApiError from "../utils/ApiError.js";

export const getTalleres = async (req, res) => {
  try {
    const talleres = await talleresDAO.obtenerTalleres();
    res.json(talleres);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getTallerPorId = async (req, res) => {
  try {
    const taller = await talleresDAO.obtenerTallerPorId(req.params.id);
    if (!taller) return res.status(404).json({ message: "Taller no encontrado" });
    res.json(taller);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const crearTaller = async (req, res, next) => {
  try {
    const nuevoTaller = await talleresDAO.crearTaller(req.body);
    res.status(201).json(nuevoTaller);
  } catch (error) {
    next(error); 
  }
};

export const activarTaller = async (req, res, next) => {
  try {
    const tallerActivado = await talleresDAO.activarTaller(req.params.id);
    if (!tallerActivado) return res.status(404).json({ message: "Taller no encontrado" });
    res.json(tallerActivado);
  } catch (error) {
    next(error); 
  } 
}
export const desactivarTaller = async (req, res, next) => {
  try {
    const tallerDesactivado = await talleresDAO.desactivarTaller(req.params.id);
    if (!tallerDesactivado) return res.status(404).json({ message: "Taller no encontrado" });
    res.json(tallerDesactivado);
  } catch (error) {
    next(error); 
  } 
}

export const inscribirTaller = async (req, res, next) => {
    try {
    const inscribirTaller = await talleresDAO.inscribirTaller(req.params.id);
    if (!inscribirTaller) return res.status(404).json({ message: "Taller no encontrado" });
    res.json(inscribirTaller);
  } catch (error) {
    next(error); 
  } 
}
