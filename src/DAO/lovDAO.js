import { supabase } from "./connection.js";
import { executeWithTiming } from "../utils/queryLogger.js";

// ─── Caché en memoria (TTL: 5 min) ─────────────────────────────────────────
const cache = new Map() // codigo → { data, expiresAt }
const TTL_MS = 5 * 60 * 1000

function cacheGet(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null }
  return entry.data
}
function cacheSet(key, data) {
  cache.set(key, { data, expiresAt: Date.now() + TTL_MS })
}
export function invalidarCache(codigo) {
  if (codigo) cache.delete(codigo)
  else cache.clear()
}

// ─── Categorías ─────────────────────────────────────────────────────────────

export const getCategorias = () =>
  executeWithTiming("lov.getCategorias", async () => {
    const { data, error } = await supabase
      .from("lov_categorias")
      .select("*, lov_valores(id, codigo, nombre, orden, activo)")
      .order("nombre")
    if (error) throw new Error(error.message)
    // Ordenar valores dentro de cada categoría
    return data.map(cat => ({
      ...cat,
      valores: (cat.lov_valores ?? []).sort((a, b) => a.orden - b.orden),
      lov_valores: undefined,
    }))
  })

export const getValoresByCategoria = (codigo) =>
  executeWithTiming("lov.getValoresByCategoria", async () => {
    const cached = cacheGet(codigo)
    if (cached) return cached

    const catResult = await supabase
      .from("lov_categorias")
      .select("id")
      .eq("codigo", codigo)
      .single()
    if (catResult.error) throw new Error(catResult.error.message)

    const valResult = await supabase
      .from("lov_valores")
      .select("id, codigo, nombre, orden, activo")
      .eq("categoria_id", catResult.data.id)
      .eq("activo", true)
      .order("orden")
    if (valResult.error) throw new Error(valResult.error.message)

    cacheSet(codigo, valResult.data)
    return valResult.data
  })

export const crearCategoria = (datos, usuarioId) =>
  executeWithTiming("lov.crearCategoria", async () => {
    const { data, error } = await supabase
      .from("lov_categorias")
      .insert({ ...datos, creado_por: usuarioId })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  })

export const actualizarCategoria = (id, datos, usuarioId) =>
  executeWithTiming("lov.actualizarCategoria", async () => {
    const { data, error } = await supabase
      .from("lov_categorias")
      .update({ ...datos, modificado_por: usuarioId, modificado_en: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  })

export const eliminarCategoria = (id) =>
  executeWithTiming("lov.eliminarCategoria", async () => {
    const { error } = await supabase
      .from("lov_categorias")
      .delete()
      .eq("id", id)
    if (error) throw new Error(error.message)
  })

// ─── Valores ─────────────────────────────────────────────────────────────────

export const crearValor = (categoriaId, datos, usuarioId) =>
  executeWithTiming("lov.crearValor", async () => {
    const { data, error } = await supabase
      .from("lov_valores")
      .insert({ ...datos, categoria_id: categoriaId, creado_por: usuarioId })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  })

export const actualizarValor = (id, datos, usuarioId) =>
  executeWithTiming("lov.actualizarValor", async () => {
    const { data, error } = await supabase
      .from("lov_valores")
      .update({ ...datos, modificado_por: usuarioId, modificado_en: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  })

export const eliminarValor = (id) =>
  executeWithTiming("lov.eliminarValor", async () => {
    const { error } = await supabase
      .from("lov_valores")
      .delete()
      .eq("id", id)
    if (error) throw new Error(error.message)
  })

export const reordenarValores = (items) =>
  executeWithTiming("lov.reordenarValores", async () => {
    // items: [{ id, orden }]
    await Promise.all(
      items.map(({ id, orden }) =>
        supabase.from("lov_valores").update({ orden }).eq("id", id)
      )
    )
  })
