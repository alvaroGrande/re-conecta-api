import axios from "axios";
import crypto from "crypto";
import config from "../config.js";
import logger from "../logger.js";

const { SDK_KEY, SDK_SECRET, ACCOUNT_ID, CLIENT_ID, CLIENT_SECRET, API_URL } = config.ZOOM;

/**
 * Genera el token de acceso OAuth para la API de Zoom
 * Documentación: https://developers.zoom.us/docs/internal-apps/s2s-oauth/
 */
export const getZoomAccessToken = async () => {
  try {
    const tokenUrl = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ACCOUNT_ID}`;
    const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    
    const response = await axios.post(tokenUrl, null, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    return response.data.access_token;
  } catch (error) {
    logger.error('Error obteniendo token de Zoom:', error.response?.data || error.message);
    throw new Error('No se pudo obtener el token de acceso de Zoom');
  }
};

/**
 * Crea una meeting en Zoom
 * Plan gratuito permite: 40 minutos con 3+ participantes, ilimitado 1-a-1, hasta 100 participantes
 * Documentación: https://developers.zoom.us/docs/api/rest/reference/zoom-api/methods/#operation/meetingCreate
 */
export const createZoomMeeting = async (properties) => {
  try {
    const accessToken = await getZoomAccessToken();
    
    const { topic, duration, numParticipants } = properties;
    
    // Configuración del meeting para plan gratuito
    const meetingConfig = {
      topic: topic || 'reConecta Video Call',
      type: 1, // 1 = Instant Meeting, 2 = Scheduled Meeting
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: true,
        mute_upon_entry: false,
        waiting_room: false, // Desactivado para facilitar acceso
        audio: 'both', // both, telephony, voip
        auto_recording: 'none', // none, local, cloud (cloud requiere plan de pago)
        approval_type: 0, // 0 = automatically approve, 1 = manually approve
        meeting_authentication: false, // No requiere autenticación
      },
      // Nota: duration es informativo, el plan gratuito limita a 40 min con 3+ personas
      duration: duration || 40,
      password: '' // Sin contraseña
    };

    const response = await axios.post(
      `${API_URL}/users/me/meetings`,
      meetingConfig,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info(`Reunión de Zoom creada: ${response.data.id} con ${numParticipants || 0} participantes esperados`);

    return {
      success: true,
      meetingId: response.data.id,
      meetingNumber: response.data.id,
      joinUrl: response.data.join_url,
      startUrl: response.data.start_url,
      password: response.data.password,
      meetingData: response.data
    };
  } catch (error) {
    logger.error('Error creando meeting en Zoom:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Error al crear la reunión'
    };
  }
};

/**
 * Genera la firma JWT requerida por Zoom Meeting SDK
 * Documentación: https://developers.zoom.us/docs/meeting-sdk/auth/
 */
export const generateZoomSignature = (meetingNumber, role = 0) => {
  try {
    // Validar que meetingNumber esté presente
    if (!meetingNumber) {
      logger.error('meetingNumber es requerido para generar la firma');
      return {
        success: false,
        error: 'meetingNumber es requerido'
      };
    }

    // Convertir meetingNumber a string y limpiar espacios/guiones
    const cleanMeetingNumber = String(meetingNumber).replace(/[\s-]/g, '');
    
    if (!cleanMeetingNumber) {
      logger.error('meetingNumber no es válido después de limpiar');
      return {
        success: false,
        error: 'meetingNumber no es válido'
      };
    }

    // role: 0 = participant, 1 = host
    const iat = Math.round(Date.now() / 1000);
    const exp = iat + 60 * 60 * 2; // 2 horas de validez
    
    const payload = {
      sdkKey: SDK_KEY,
      mn: cleanMeetingNumber,
      role: role,
      iat: iat,
      exp: exp,
      appKey: SDK_KEY,
      tokenExp: exp
    };

    const signature = crypto
      .createHmac('sha256', SDK_SECRET)
      .update(`${SDK_KEY}${cleanMeetingNumber}${iat}${role}`)
      .digest('base64');

    return {
      success: true,
      signature: signature,
      sdkKey: SDK_KEY
    };
  } catch (error) {
    logger.error('Error generando firma de Zoom:', error.message);
    return {
      success: false,
      error: 'Error al generar la firma'
    };
  }
};

/**
 * Obtiene información de un meeting existente
 */
export const getZoomMeeting = async (meetingId) => {
  try {
    const accessToken = await getZoomAccessToken();
    
    const response = await axios.get(
      `${API_URL}/meetings/${meetingId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      meeting: response.data
    };
  } catch (error) {
    logger.error('Error obteniendo meeting de Zoom:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Meeting no encontrado'
    };
  }
};

/**
 * Elimina un meeting programado
 */
export const deleteZoomMeeting = async (meetingId) => {
  try {
    const accessToken = await getZoomAccessToken();
    
    await axios.delete(
      `${API_URL}/meetings/${meetingId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    return {
      success: true,
      message: 'Meeting eliminado exitosamente'
    };
  } catch (error) {
    logger.error('Error eliminando meeting de Zoom:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Error al eliminar meeting'
    };
  }
};
