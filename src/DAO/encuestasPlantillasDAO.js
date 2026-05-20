import { supabase } from "./connection.js";
import { executeWithTiming } from "../utils/queryLogger.js";

const SELECT_PLANTILLA = `
  *,
  creador:appUsers!encuestas_plantillas_creado_por_fkey(id, nombre, Apellidos),
  preguntas:encuestas_plantillas_preguntas(
    *,
    opciones:encuestas_plantillas_opciones(*)
  )
`;

/**
 * Obtener todas las plantillas activas.
 * - Admin (1): todas.
 * - Coordinador (2): las propias + las de admin sin dueño.
 * - Usuario (3): sin acceso (403 en controller).
 *
 * @param {Object} filtros
 * @param {number} filtros.usuarioRol
 * @param {string} filtros.usuarioId
 * @param {boolean} [filtros.soloActivas=true]
 */
export const obtenerPlantillas = async (filtros = {}) => {
  return executeWithTiming('obtenerPlantillas', async () => {
    const { usuarioRol, usuarioId, soloActivas = true } = filtros;

    let query = supabase
      .from('encuestas_plantillas')
      .select(SELECT_PLANTILLA)
      .order('created_at', { ascending: false });

    if (soloActivas) {
      query = query.eq('activa', true);
    }

    if (usuarioRol === 2 && usuarioId) {
      query = query.or(`creado_por.eq.${usuarioId},creado_por.is.null`);
    }

    const { data, error } = await query;
    if (error) throw new Error('Error al obtener plantillas: ' + error.message);
    return data;
  });
};

/**
 * Obtener una plantilla por ID.
 * @param {number} id
 */
export const obtenerPlantillaPorId = async (id) => {
  return executeWithTiming('obtenerPlantillaPorId', async () => {
    const { data, error } = await supabase
      .from('encuestas_plantillas')
      .select(SELECT_PLANTILLA)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error('Error al obtener plantilla: ' + error.message);
    return data;
  });
};

/**
 * Crear una plantilla con sus preguntas y opciones.
 *
 * @param {Object} datos
 * @param {string}  datos.titulo
 * @param {string}  [datos.descripcion]
 * @param {string}  [datos.creado_por]   - UUID del creador
 * @param {number}  [datos.rol_objetivo]
 * @param {Array}   datos.preguntas
 */
export const crearPlantilla = async (datos) => {
  return executeWithTiming('crearPlantilla', async () => {
    const { titulo, descripcion, creado_por, rol_objetivo, preguntas = [] } = datos;

    // 1. Insertar plantilla
    const { data: plantilla, error: errorPlantilla } = await supabase
      .from('encuestas_plantillas')
      .insert([{ titulo, descripcion, creado_por: creado_por || null, rol_objetivo: rol_objetivo || null }])
      .select('id')
      .single();

    if (errorPlantilla) throw new Error('Error al crear plantilla: ' + errorPlantilla.message);

    const plantillaId = plantilla.id;

    // 2. Insertar preguntas
    for (const [idx, preg] of preguntas.entries()) {
      const { data: pregInserida, error: errorPreg } = await supabase
        .from('encuestas_plantillas_preguntas')
        .insert([{ plantilla_id: plantillaId, texto: preg.texto, tipo: preg.tipo, orden: idx }])
        .select('id')
        .single();

      if (errorPreg) throw new Error('Error al crear pregunta de plantilla: ' + errorPreg.message);

      // 3. Insertar opciones si es pregunta múltiple
      if (preg.tipo === 'multiple' && Array.isArray(preg.opciones) && preg.opciones.length > 0) {
        const opciones = preg.opciones.map((op, oidx) => ({
          pregunta_id: pregInserida.id,
          texto: op.texto,
          orden: oidx,
        }));
        const { error: errorOp } = await supabase
          .from('encuestas_plantillas_opciones')
          .insert(opciones);
        if (errorOp) throw new Error('Error al crear opciones de plantilla: ' + errorOp.message);
      }
    }

    return obtenerPlantillaPorId(plantillaId);
  });
};

/**
 * Actualizar metadatos de una plantilla (sin reemplazar preguntas).
 * Para reemplazar preguntas usa replacePreguntas.
 *
 * @param {number} id
 * @param {Object} cambios - titulo, descripcion, activa, rol_objetivo
 */
export const actualizarPlantilla = async (id, cambios) => {
  return executeWithTiming('actualizarPlantilla', async () => {
    const permitidos = ['titulo', 'descripcion', 'activa', 'rol_objetivo'];
    const update = Object.fromEntries(
      Object.entries(cambios).filter(([k]) => permitidos.includes(k))
    );

    const { data, error } = await supabase
      .from('encuestas_plantillas')
      .update(update)
      .eq('id', id)
      .select(SELECT_PLANTILLA)
      .single();

    if (error) throw new Error('Error al actualizar plantilla: ' + error.message);
    return data;
  });
};

/**
 * Eliminar una plantilla (cascade a preguntas y opciones).
 * @param {number} id
 */
export const eliminarPlantilla = async (id) => {
  return executeWithTiming('eliminarPlantilla', async () => {
    const { error } = await supabase
      .from('encuestas_plantillas')
      .delete()
      .eq('id', id);

    if (error) throw new Error('Error al eliminar plantilla: ' + error.message);
    return { id };
  });
};

/**
 * Incrementar la versión de una plantilla al editarla.
 * @param {number} id
 */
export const incrementarVersionPlantilla = async (id) => {
  return executeWithTiming('incrementarVersionPlantilla', async () => {
    const { data: current, error: errorGet } = await supabase
      .from('encuestas_plantillas')
      .select('version')
      .eq('id', id)
      .single();

    if (errorGet) throw new Error('Plantilla no encontrada');

    const { error } = await supabase
      .from('encuestas_plantillas')
      .update({ version: current.version + 1 })
      .eq('id', id);

    if (error) throw new Error('Error al incrementar versión: ' + error.message);
  });
};

/**
 * Crear una encuesta a partir de una plantilla.
 * Transfiere título, descripción, preguntas y opciones a las tablas de encuestas.
 *
 * @param {number} plantillaId
 * @param {Object} extras - { titulo, descripcion, fecha_fin, creado_por, rol_objetivo }
 */
export const crearEncuestaDesde = async (plantillaId, extras = {}) => {
  return executeWithTiming('crearEncuestaDesde', async () => {
    // 1. Obtener plantilla completa
    const { data: plantilla, error: errorGet } = await supabase
      .from('encuestas_plantillas')
      .select(`
        *,
        preguntas:encuestas_plantillas_preguntas(
          *,
          opciones:encuestas_plantillas_opciones(*)
        )
      `)
      .eq('id', plantillaId)
      .single();

    if (errorGet || !plantilla) throw new Error('Plantilla no encontrada');

    const titulo      = extras.titulo      || plantilla.titulo;
    const descripcion = extras.descripcion || plantilla.descripcion || '';
    const fecha_fin   = extras.fecha_fin;
    const creado_por  = extras.creado_por  || plantilla.creado_por || null;
    const rol_objetivo = extras.rol_objetivo != null ? extras.rol_objetivo : plantilla.rol_objetivo;

    if (!fecha_fin) throw new Error('fecha_fin es obligatoria para crear la encuesta');

    // 2. Crear encuesta
    const { data: encuesta, error: errorEnc } = await supabase
      .from('encuestas')
      .insert([{ titulo, descripcion, fecha_fin, creado_por, rol_objetivo }])
      .select('id')
      .single();

    if (errorEnc) throw new Error('Error al crear encuesta desde plantilla: ' + errorEnc.message);

    const encuestaId = encuesta.id;

    // 3. Insertar preguntas y opciones
    const preguntas = (plantilla.preguntas || []).sort((a, b) => a.orden - b.orden);
    for (const preg of preguntas) {
      const { data: pregInserida, error: errorPreg } = await supabase
        .from('encuestas_preguntas')
        .insert([{ encuesta_id: encuestaId, texto: preg.texto, tipo: preg.tipo, orden: preg.orden }])
        .select('id')
        .single();

      if (errorPreg) throw new Error('Error al copiar pregunta de plantilla: ' + errorPreg.message);

      if (preg.tipo === 'multiple' && Array.isArray(preg.opciones) && preg.opciones.length > 0) {
        const opciones = preg.opciones
          .sort((a, b) => a.orden - b.orden)
          .map((op) => ({ pregunta_id: pregInserida.id, texto: op.texto, orden: op.orden }));

        const { error: errorOp } = await supabase
          .from('encuestas_opciones')
          .insert(opciones);

        if (errorOp) throw new Error('Error al copiar opciones de plantilla: ' + errorOp.message);
      }
    }

    return encuestaId;
  });
};
