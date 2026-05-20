import { buscarGlobal } from "../DAO/busquedaDAO.js";

/**
 * GET /api/busqueda?q=texto&limit=5
 * Búsqueda global en talleres, encuestas y usuarios
 */
export const buscar = async (req, res, next) => {
  try {
    const { q, limit } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: "El término de búsqueda debe tener al menos 2 caracteres" });
    }

    const rolUsuario = req.user.rol;
    const usuarioId = req.user.id;
    const limite = limit ? Math.min(parseInt(limit), 10) : 5;

    const resultados = await buscarGlobal(q.trim(), rolUsuario, usuarioId, limite);

    res.json(resultados);
  } catch (error) {
    next(error);
  }
};
