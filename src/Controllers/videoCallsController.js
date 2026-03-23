import { createZoomMeeting, generateZoomSignature, getZoomMeeting } from "../utils/zoom.js";
import * as videollamadasDAO from "../DAO/videollamadasDAO.js";
import * as notificacionesDAO from "../DAO/notificacionesDAO.js";
import * as dashboardDAO from "../DAO/dashboardDAO.js";
import logger from "../logger.js";

/**
 * Crea una nueva reunión de Zoom
 * Plan gratuito: 40 min con 3+ participantes, ilimitado 1-a-1
 */
export const createRoom = async (req, res) => {
    try {
        const { topic, duration, participantes = [] } = req.body;
        const creatorId = req.user.id; // Usuario autenticado

        // Crear la reunión en Zoom
        const result = await createZoomMeeting({
            topic: topic || 'reConecta Video Call',
            duration: duration || 40,
            numParticipants: participantes.length
        });

        if (!result.success) {
            return res.status(500).json({ 
                message: 'Error al crear la reunión en Zoom',
                error: result.error 
            });
        }

        // Registrar la videollamada en la base de datos
        const videollamada = await videollamadasDAO.registrarVideollamada({
            meeting_id: result.meetingId,
            meeting_number: result.meetingNumber,
            topic: topic || 'reConecta Video Call',
            creator_id: creatorId,
            password: result.password || '',
            join_url: result.joinUrl,
            start_url: result.startUrl,
            duration: duration || 40,
            num_participants: participantes.length,
            meeting_type: 'instant'
        });

        logger.info(`Videollamada creada por usuario ${creatorId}: ${result.meetingId}`);

        // Registrar actividad en el sistema
        try {
            await dashboardDAO.registrarActividad(
                creatorId,
                'videollamada',
                'Videollamada creada',
                `Creó videollamada "${topic || 'reConecta Video Call'}" con ${participantes.length} participante(s) - ID: ${result.meetingNumber}`
            );
        } catch (actError) {
            logger.error('Error al registrar actividad de videollamada:', actError);
        }

        // Si hay participantes, agregarlos y enviar notificaciones
        if (participantes.length > 0) {
            // Agregar participantes a la base de datos
            const participantesRegistrados = await videollamadasDAO.agregarParticipantes(
                videollamada.id,
                participantes
            );

            // Enviar notificaciones a los participantes
            const receptoresIds = participantes
                .filter(p => p.usuario_id)
                .map(p => p.usuario_id);

            if (receptoresIds.length > 0) {
                await notificacionesDAO.enviarNotificacionMasiva(
                    creatorId,
                    receptoresIds,
                    {
                        tipo: 'videollamada',
                        titulo: '📹 Invitación a videollamada',
                        contenido: `Has sido invitado a la videollamada "${topic || 'reConecta Video Call'}". Haz clic para unirte.`,
                        url: `/videocall?meeting=${result.meetingNumber}`
                    }
                );

                // Marcar participantes como notificados
                await videollamadasDAO.marcarParticipantesNotificados(videollamada.id);

                logger.info(`Notificaciones enviadas a ${receptoresIds.length} participantes`);
            }
        }

        res.status(201).json({
            message: 'Reunión creada exitosamente',
            meetingId: result.meetingId,
            meetingNumber: result.meetingNumber,
            joinUrl: result.joinUrl,
            password: result.password,
            videollamadaId: videollamada.id,
            participantesNotificados: participantes.length,
            meetingData: result.meetingData
        });

    } catch (error) {
        logger.error('Error al crear videollamada:', error);
        res.status(500).json({ 
            message: 'Error al crear la reunión',
            error: error.message 
        });
    }
};

/**
 * Genera la firma necesaria para unirse a un meeting con Zoom SDK
 */
export const getMeetingSignature = async (req, res) => {
    const { meetingNumber, role } = req.body;

    if (!meetingNumber) {
        return res.status(400).json({ 
            message: 'meetingNumber es requerido' 
        });
    }

    const result = generateZoomSignature(meetingNumber, role || 0);

    if (result.success) {
        res.status(200).json({
            signature: result.signature,
            sdkKey: result.sdkKey
        });
    } else {
        res.status(500).json({ 
            message: 'Error al generar la firma',
            error: result.error 
        });
    }
};

/**
 * Obtiene información de un meeting existente
 */
export const getMeetingInfo = async (req, res) => {
    const { meetingId } = req.params;

    const result = await getZoomMeeting(meetingId);

    if (result.success) {
        res.status(200).json({
            meeting: result.meeting
        });
    } else {
        res.status(404).json({ 
            message: 'Meeting no encontrado',
            error: result.error 
        });
    }
};

/**
 * Obtiene el historial de videollamadas creadas por el usuario
 */
export const getMyVideocalls = async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 50, offset = 0 } = req.query;

        const videollamadas = await videollamadasDAO.obtenerVideollamadasPorCreador(
            userId,
            parseInt(limit),
            parseInt(offset)
        );

        res.status(200).json({
            message: 'Videollamadas obtenidas correctamente',
            total: videollamadas.length,
            videollamadas
        });
    } catch (error) {
        logger.error('Error al obtener videollamadas del usuario:', error);
        res.status(500).json({ 
            message: 'Error al obtener videollamadas',
            error: error.message 
        });
    }
};

/**
 * Obtiene todas las videollamadas (solo para administradores)
 */
export const getAllVideocalls = async (req, res) => {
    try {
        // Verificar que el usuario sea administrador
        if (req.user.rol !== 1) {
            return res.status(403).json({ 
                message: 'No tienes permisos para acceder a esta información' 
            });
        }

        const { limit = 100, offset = 0 } = req.query;

        const videollamadas = await videollamadasDAO.obtenerTodasVideollamadas(
            parseInt(limit),
            parseInt(offset)
        );

        res.status(200).json({
            message: 'Todas las videollamadas obtenidas correctamente',
            total: videollamadas.length,
            videollamadas
        });
    } catch (error) {
        logger.error('Error al obtener todas las videollamadas:', error);
        res.status(500).json({ 
            message: 'Error al obtener videollamadas',
            error: error.message 
        });
    }
};
