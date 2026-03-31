import nodemailer from 'nodemailer'
import twilio from 'twilio'
import config from '../config.js'
import logger from '../logger.js'

/**
 * Servicio de envío de notificaciones
 * Maneja envío por email, WhatsApp y otros canales
 */

// Configuración de servicios externos
const emailTransporter = nodemailer.createTransport({
  host: config.EMAIL.SMTP_HOST,
  port: config.EMAIL.SMTP_PORT,
  secure: config.EMAIL.SMTP_SECURE,
  auth: {
    user: config.EMAIL.SMTP_USER,
    pass: config.EMAIL.SMTP_PASS
  }
})

const twilioClient = twilio(config.TWILIO.SID, config.TWILIO.TOKEN)

/**
 * Procesar plantilla con variables
 * @param {string} plantilla - Contenido de la plantilla
 * @param {Object} variables - Variables a reemplazar
 * @returns {string} Contenido procesado
 */
export const procesarPlantilla = (plantilla, variables) => {
  let resultado = plantilla

  // Reemplazar variables {{variable}}
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g')
    resultado = resultado.replace(regex, variables[key] || '')
  })

  return resultado
}

/**
 * Enviar notificación por email
 * @param {Object} notificacion - Datos de la notificación
 * @param {Object} receptor - Datos del receptor
 * @returns {Promise<Object>} Resultado del envío
 */
export const enviarEmail = async (notificacion, receptor) => {
  try {
    const mailOptions = {
      from: config.EMAIL.FROM,
      to: receptor.email,
      subject: notificacion.titulo,
      html: notificacion.contenido
    }

    const info = await emailTransporter.sendMail(mailOptions)

    logger.info({
      type: 'email_sent',
      notificacionId: notificacion.id,
      receptorId: receptor.id,
      email: receptor.email,
      messageId: info.messageId
    }, 'Email enviado exitosamente')

    return { exito: true, messageId: info.messageId }
  } catch (error) {
    logger.error({
      type: 'email_error',
      notificacionId: notificacion.id,
      receptorId: receptor.id,
      email: receptor.email,
      error: error.message
    }, 'Error al enviar email')

    throw error
  }
}

/**
 * Enviar notificación por WhatsApp
 * @param {Object} notificacion - Datos de la notificación
 * @param {Object} receptor - Datos del receptor
 * @returns {Promise<Object>} Resultado del envío
 */
export const enviarWhatsApp = async (notificacion, receptor) => {
  try {
    // Asumimos que el teléfono está en datos_adicionales o en el perfil del usuario
    const telefono = notificacion.datos_adicionales?.telefono || receptor.telefono

    if (!telefono) {
      throw new Error('No se encontró número de teléfono para WhatsApp')
    }

    // Formatear número para WhatsApp (asegurar formato internacional)
    const numeroFormateado = telefono.startsWith('+') ? telefono : `+34${telefono}`

    const message = await twilioClient.messages.create({
      from: `whatsapp:${config.TWILIO.WHATSAPP_NUMBER}`,
      to: `whatsapp:${numeroFormateado}`,
      body: notificacion.contenido
    })

    logger.info({
      type: 'whatsapp_sent',
      notificacionId: notificacion.id,
      receptorId: receptor.id,
      telefono: numeroFormateado,
      messageSid: message.sid
    }, 'WhatsApp enviado exitosamente')

    return { exito: true, messageSid: message.sid }
  } catch (error) {
    logger.error({
      type: 'whatsapp_error',
      notificacionId: notificacion.id,
      receptorId: receptor.id,
      telefono: receptor.telefono,
      error: error.message
    }, 'Error al enviar WhatsApp')

    throw error
  }
}

/**
 * Enviar notificación por push (in-app)
 * @param {Object} notificacion - Datos de la notificación
 * @param {Object} receptor - Datos del receptor
 * @returns {Promise<Object>} Resultado del envío
 */
export const enviarPush = async (notificacion, receptor) => {
  // Para push in-app, simplemente marcamos como enviada
  // El frontend la recibe vía WebSocket o polling
  logger.info({
    type: 'push_sent',
    notificacionId: notificacion.id,
    receptorId: receptor.id
  }, 'Notificación push enviada (in-app)')

  return { exito: true }
}

/**
 * Enviar notificación según canal
 * @param {Object} notificacion - Datos de la notificación
 * @param {Object} receptor - Datos del receptor
 * @returns {Promise<Object>} Resultado del envío
 */
export const enviarNotificacion = async (notificacion, receptor) => {
  switch (notificacion.canal) {
    case 'email':
      return await enviarEmail(notificacion, receptor)
    case 'whatsapp':
      return await enviarWhatsApp(notificacion, receptor)
    case 'push':
    default:
      return await enviarPush(notificacion, receptor)
  }
}

/**
 * Verificar configuración de servicios externos
 * @returns {Object} Estado de los servicios
 */
export const verificarConfiguracion = () => {
  const servicios = {
    email: {
      configurado: !!(config.EMAIL?.SMTP_HOST && config.EMAIL?.SMTP_USER),
      proveedor: 'SendGrid/Nodemailer'
    },
    whatsapp: {
      configurado: !!(config.TWILIO?.SID && config.TWILIO?.TOKEN),
      proveedor: 'Twilio'
    },
    push: {
      configurado: true, // Siempre disponible (in-app)
      proveedor: 'WebSocket/Polling'
    }
  }

  return servicios
}
