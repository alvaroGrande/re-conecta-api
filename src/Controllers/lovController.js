import * as lovDAO from "../DAO/lovDAO.js"

// ── Admin: listar todas las categorías con sus valores ───────────────────────
export const getCategorias = async (req, res, next) => {
  try {
    const categorias = await lovDAO.getCategorias()
    res.json(categorias)
  } catch (error) {
    next(error)
  }
}

// ── Público (autenticado): obtener valores de una categoría (con caché) ──────
export const getValoresByCategoria = async (req, res, next) => {
  try {
    const valores = await lovDAO.getValoresByCategoria(req.params.codigo)
    res.json(valores)
  } catch (error) {
    next(error)
  }
}

// ── Admin: crear categoría ───────────────────────────────────────────────────
export const crearCategoria = async (req, res, next) => {
  try {
    const { codigo, nombre, descripcion } = req.body
    if (!codigo || !nombre) return res.status(400).json({ error: "codigo y nombre son obligatorios" })
    const nueva = await lovDAO.crearCategoria(
      { codigo: codigo.trim().toLowerCase(), nombre: nombre.trim(), descripcion },
      req.user.id
    )
    res.status(201).json(nueva)
  } catch (error) {
    if (error.message.includes("unique")) return res.status(409).json({ error: "Ya existe una categoría con ese código" })
    next(error)
  }
}

// ── Admin: actualizar categoría ──────────────────────────────────────────────
export const actualizarCategoria = async (req, res, next) => {
  try {
    const { nombre, descripcion, activo } = req.body
    const actualizada = await lovDAO.actualizarCategoria(req.params.id, { nombre, descripcion, activo }, req.user.id)
    lovDAO.invalidarCache()
    res.json(actualizada)
  } catch (error) {
    next(error)
  }
}

// ── Admin: eliminar categoría ────────────────────────────────────────────────
export const eliminarCategoria = async (req, res, next) => {
  try {
    await lovDAO.eliminarCategoria(req.params.id)
    lovDAO.invalidarCache()
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
}

// ── Admin: crear valor ───────────────────────────────────────────────────────
export const crearValor = async (req, res, next) => {
  try {
    const { codigo, nombre, orden } = req.body
    if (!codigo || !nombre) return res.status(400).json({ error: "codigo y nombre son obligatorios" })
    const nuevo = await lovDAO.crearValor(
      req.params.categoriaId,
      { codigo: codigo.trim().toLowerCase(), nombre: nombre.trim(), orden: orden ?? 0 },
      req.user.id
    )
    lovDAO.invalidarCache()
    res.status(201).json(nuevo)
  } catch (error) {
    if (error.message.includes("unique")) return res.status(409).json({ error: "Ya existe un valor con ese código en esta categoría" })
    next(error)
  }
}

// ── Admin: actualizar valor ──────────────────────────────────────────────────
export const actualizarValor = async (req, res, next) => {
  try {
    const { nombre, orden, activo } = req.body
    const actualizado = await lovDAO.actualizarValor(req.params.id, { nombre, orden, activo }, req.user.id)
    lovDAO.invalidarCache()
    res.json(actualizado)
  } catch (error) {
    next(error)
  }
}

// ── Admin: eliminar valor ────────────────────────────────────────────────────
export const eliminarValor = async (req, res, next) => {
  try {
    await lovDAO.eliminarValor(req.params.id)
    lovDAO.invalidarCache()
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
}

// ── Admin: reordenar valores ─────────────────────────────────────────────────
export const reordenarValores = async (req, res, next) => {
  try {
    const { items } = req.body // [{ id, orden }]
    if (!Array.isArray(items)) return res.status(400).json({ error: "items debe ser un array" })
    await lovDAO.reordenarValores(items)
    lovDAO.invalidarCache()
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
}
