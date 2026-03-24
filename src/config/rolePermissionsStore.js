/**
 * Store de permisos por rol usando Supabase como persistencia.
 * Tabla: roles_permisos (rol SMALLINT, permiso VARCHAR)
 *
 * Se integra con memoryCache (el mismo singleton que usa el resto de la app)
 * para evitar consultas repetidas a la BD. La caché es indefinida y se invalida
 * manualmente al guardar o restaurar permisos.
 * La entrada aparece en el panel CacheAdmin bajo la clave 'roles:permisos'.
 */
import { memoryCache } from '../utils/memoryCache.js';
import { supabase } from '../DAO/connection.js';
import { PERMISOS, PERMISOS_POR_ROL } from './permissions.js';
import logger from '../logger.js';

const CACHE_KEY = 'roles:permisos';

/**
 * Carga los permisos desde Supabase y los guarda en caché.
 * @returns {Promise<Record<number, Set<string>>>}
 */
async function cargarCache() {
  const { data, error } = await supabase
    .from('roles_permisos')
    .select('rol, permiso');

  if (error) throw new Error(`[ROLES] Error al cargar permisos: ${error.message}`);

  const mapa = {};
  for (const { rol, permiso } of data) {
    if (!mapa[rol]) mapa[rol] = new Set();
    mapa[rol].add(permiso);
  }
  return mapa;
}

async function getCache() {
  let mapa = memoryCache.get(CACHE_KEY);
  if (!mapa) {
    mapa = await cargarCache();
    // TTL null = indefinido: la caché no expira, se invalida manualmente
    memoryCache.set(CACHE_KEY, mapa, null);
    logger.info('[ROLES] Permisos cargados desde BD y guardados en caché');
  }
  return mapa;
}

/**
 * Devuelve el mapa completo { [rol]: string[] } de permisos actuales.
 * @returns {Promise<Record<number, string[]>>}
 */
export async function getPermisosActuales() {
  const mapa = await getCache();
  return Object.fromEntries(
    Object.entries(mapa).map(([rol, set]) => [rol, [...set]])
  );
}

/**
 * Verifica si el rol tiene el permiso especificado.
 * Nota: este método es asíncrono porque consulta la caché (que puede no estar cargada).
 * @param {number} rol
 * @param {string} permiso
 * @returns {Promise<boolean>}
 */
export async function tienePermiso(rol, permiso) {
  const mapa = await getCache();
  return mapa[Number(rol)]?.has(permiso) ?? false;
}

/**
 * Reemplaza todos los permisos de los roles editables (2 y 3) en Supabase.
 * El Administrador (rol 1) siempre mantiene todos los permisos.
 * @param {{ [rol: string]: string[] }} nuevoStore
 */
export async function actualizarTodosLosPermisos(nuevoStore) {
  // Forzar que el Administrador tenga siempre todos los permisos
  nuevoStore['1'] = Object.values(PERMISOS);

  // Filas a insertar
  const filas = [];
  for (const [rolStr, permisos] of Object.entries(nuevoStore)) {
    const rol = Number(rolStr);
    for (const permiso of permisos) {
      filas.push({ rol, permiso });
    }
  }

  // Roles que se van a reemplazar
  const rolesAActualizar = Object.keys(nuevoStore).map(Number);

  // Borrar filas existentes de esos roles
  const { error: deleteError } = await supabase
    .from('roles_permisos')
    .delete()
    .in('rol', rolesAActualizar);

  if (deleteError) throw new Error(`[ROLES] Error al eliminar permisos previos: ${deleteError.message}`);

  // Insertar nuevas filas
  const { error: insertError } = await supabase
    .from('roles_permisos')
    .insert(filas);

  if (insertError) throw new Error(`[ROLES] Error al insertar nuevos permisos: ${insertError.message}`);

  // Invalidar caché para que el próximo request recargue desde BD
  memoryCache.delete(CACHE_KEY);
  logger.info('[ROLES] Permisos actualizados y caché invalidada');
}

/**
 * Restaura los permisos a los valores por defecto definidos en permissions.js.
 * Borra todas las filas y las reinserta desde los defaults.
 */
export async function resetearPermisos() {
  const filas = [];
  for (const [rolStr, permisos] of Object.entries(PERMISOS_POR_ROL)) {
    const rol = Number(rolStr);
    for (const permiso of permisos) {
      filas.push({ rol, permiso });
    }
  }

  const { error: deleteError } = await supabase
    .from('roles_permisos')
    .delete()
    .neq('id', 0); // borra todas las filas

  if (deleteError) throw new Error(`[ROLES] Error al limpiar tabla: ${deleteError.message}`);

  const { error: insertError } = await supabase
    .from('roles_permisos')
    .insert(filas);

  if (insertError) throw new Error(`[ROLES] Error al restaurar permisos por defecto: ${insertError.message}`);

  memoryCache.delete(CACHE_KEY);
  logger.info('[ROLES] Permisos restaurados a valores por defecto y caché invalidada');
}

