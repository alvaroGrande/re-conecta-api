import { supabase } from "./connection.js";
import { executeWithTiming } from "../utils/queryLogger.js";
import { getCached } from "../utils/memoryCache.js";

/**
 * Búsqueda global en talleres, encuestas y usuarios
 * @param {string} q - Texto de búsqueda
 * @param {number} rolUsuario - Rol del usuario que busca (1=admin, 2=coordinador, 3=usuario)
 * @param {string} usuarioId - ID del usuario que busca
 * @param {number} limit - Máximo de resultados por entidad
 * @returns {Object} Resultados agrupados por entidad
 */
export const buscarGlobal = async (q, rolUsuario, usuarioId, limit = 5) => {
  const queryNormalizada = q.trim().toLowerCase();
  const cacheKey = `busqueda:global:r${rolUsuario}:u${usuarioId}:q:${queryNormalizada}:l${limit}`;

  const { data } = await getCached(
    cacheKey,
    async () => {
      return executeWithTiming('buscarGlobal', async () => {
        const termino = `%${queryNormalizada}%`;

        // Ejecutar las búsquedas en paralelo para minimizar latencia
        const [talleres, encuestas, usuarios] = await Promise.all([

          // ─── Talleres ───────────────────────────────────────────────────────
          supabase
            .from('talleres')
            .select('id, titulo, descripcion, fecha, modalidad, activo')
            .or(`titulo.ilike.${termino},descripcion.ilike.${termino}`)
            .order('fecha', { ascending: true })
            .limit(limit),

          // ─── Encuestas ──────────────────────────────────────────────────────
          (() => {
            let queryEncuestas = supabase
              .from('encuestas')
              .select('id, titulo, descripcion, fecha_fin, fecha_creacion, creado_por')
              .or(`titulo.ilike.${termino},descripcion.ilike.${termino}`)
              .order('fecha_creacion', { ascending: false })
              .limit(limit);

            // Coordinadores solo ven sus propias encuestas
            if (rolUsuario === 2) {
              queryEncuestas = queryEncuestas.eq('creado_por', usuarioId);
            }

            return queryEncuestas;
          })(),

          // ─── Usuarios (solo admin y coordinador) ───────────────────────────
          (() => {
            if (rolUsuario > 2) {
              return Promise.resolve({ data: [], error: null });
            }

            // Admin: búsqueda directa por usuario
            if (rolUsuario === 1) {
              return supabase
                .from('appUsers')
                .select('id, nombre, Apellidos, email, rol')
                .or(`nombre.ilike.${termino},Apellidos.ilike.${termino},email.ilike.${termino}`)
                .limit(limit);
            }

            // Coordinador: primero obtener asignados y luego filtrar en memoria
            return supabase
              .from('usuarios_instructores')
              .select('usuario:usuario_id(id, nombre, Apellidos, email, rol)')
              .eq('instructor_id', usuarioId)
              .limit(50);
          })()
        ]);

        if (talleres.error) throw new Error("Error buscando talleres: " + talleres.error.message);
        if (encuestas.error) throw new Error("Error buscando encuestas: " + encuestas.error.message);
        if (usuarios.error) throw new Error("Error buscando usuarios: " + usuarios.error.message);

        // Normalizar resultados de usuarios para coordinadores (estructura anidada)
        let usuariosData = usuarios.data ?? [];
        if (rolUsuario === 2 && usuariosData.length && usuariosData[0]?.usuario) {
          usuariosData = usuariosData
            .map((r) => r.usuario)
            .filter((u) =>
              u.nombre?.toLowerCase().includes(queryNormalizada)
              || u.Apellidos?.toLowerCase().includes(queryNormalizada)
              || u.email?.toLowerCase().includes(queryNormalizada)
            )
            .slice(0, limit);
        }

        return {
          talleres: talleres.data ?? [],
          encuestas: encuestas.data ?? [],
          usuarios: usuariosData,
          total: (talleres.data?.length ?? 0) + (encuestas.data?.length ?? 0) + usuariosData.length
        };
      });
    },
    60 * 1000
  );

  return data;
};
