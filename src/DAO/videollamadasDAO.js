import { supabase } from "./connection.js";
import logger from "../logger.js";
import { executeWithTiming } from "../utils/queryLogger.js";

/**
 * Registrar una nueva videollamada
 */
export const registrarVideollamada = async (videollamadaData) => {
  return executeWithTiming('registrarVideollamada', async () => {
    const {
      meeting_id,
      meeting_number,
      topic,
      creator_id,
      password,
      join_url,
      start_url,
      duration,
      num_participants,
      meeting_type
    } = videollamadaData;

    const { data, error } = await supabase
      .from('videollamadas')
      .insert([
        {
          meeting_id,
          meeting_number,
          topic,
          creator_id,
          password,
          join_url,
          start_url,
          duration,
          num_participants,
          meeting_type,
          status: 'scheduled'
        }
      ])
      .select(`
        *,
        creator:appUsers!creator_id (
          id,
          nombre,
          Apellidos,
          email
        )
      `)
      .single();

    if (error) {
      logger.error('Error al registrar videollamada:', error);
      throw new Error("Error al registrar videollamada: " + error.message);
    }

    return data;
  });
};

/**
 * Agregar participantes a una videollamada
 */
export const agregarParticipantes = async (videollamadaId, participantes) => {
  return executeWithTiming('agregarParticipantes', async () => {
    const participantesData = participantes.map(p => ({
      videollamada_id: videollamadaId,
      usuario_id: p.usuario_id || null,
      nombre: p.nombre,
      email: p.email,
      rol: p.rol || 'participant'
    }));

    const { data, error } = await supabase
      .from('videollamadas_participantes')
      .insert(participantesData)
      .select(`
        *,
        usuario:appUsers!usuario_id (
          id,
          nombre,
          Apellidos,
          email
        )
      `);

    if (error) {
      logger.error('Error al agregar participantes:', error);
      throw new Error("Error al agregar participantes: " + error.message);
    }

    return data;
  });
};

/**
 * Marcar participantes como notificados
 */
export const marcarParticipantesNotificados = async (videollamadaId) => {
  return executeWithTiming('marcarParticipantesNotificados', async () => {
    const { data, error } = await supabase
      .from('videollamadas_participantes')
      .update({
        notificado: true,
        fecha_notificacion: new Date().toISOString()
      })
      .eq('videollamada_id', videollamadaId)
      .select();

    if (error) {
      logger.error('Error al marcar participantes como notificados:', error);
      throw new Error("Error al marcar participantes: " + error.message);
    }

    return data;
  });
};

/**
 * Obtener videollamadas creadas por un usuario
 */
export const obtenerVideollamadasPorCreador = async (creatorId, limit = 50, offset = 0) => {
  return executeWithTiming('obtenerVideollamadasPorCreador', async () => {
    const { data, error } = await supabase
      .from('videollamadas')
      .select(`
        *,
        creator:appUsers!creator_id (
          id,
          nombre,
          Apellidos,
          email
        ),
        participantes:videollamadas_participantes (
          id,
          usuario_id,
          nombre,
          email,
          rol,
          notificado,
          unido
        )
      `)
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Error al obtener videollamadas:', error);
      throw new Error("Error al obtener videollamadas: " + error.message);
    }

    return data;
  });
};

/**
 * Obtener todas las videollamadas (para administrador)
 */
export const obtenerTodasVideollamadas = async (limit = 100, offset = 0) => {
  return executeWithTiming('obtenerTodasVideollamadas', async () => {
    const { data, error } = await supabase
      .from('videollamadas')
      .select(`
        *,
        creator:appUsers!creator_id (
          id,
          nombre,
          Apellidos,
          email,
          rol
        ),
        participantes:videollamadas_participantes (
          id,
          usuario_id,
          nombre,
          email,
          rol,
          notificado
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Error al obtener todas las videollamadas:', error);
      throw new Error("Error al obtener videollamadas: " + error.message);
    }

    return data;
  });
};

/**
 * Actualizar estado de una videollamada
 */
export const actualizarEstadoVideollamada = async (meetingId, status, additionalData = {}) => {
  return executeWithTiming('actualizarEstadoVideollamada', async () => {
    const updateData = { status, ...additionalData };

    const { data, error } = await supabase
      .from('videollamadas')
      .update(updateData)
      .eq('meeting_id', meetingId)
      .select()
      .single();

    if (error) {
      logger.error('Error al actualizar estado de videollamada:', error);
      throw new Error("Error al actualizar videollamada: " + error.message);
    }

    return data;
  });
};
