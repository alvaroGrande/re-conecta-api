import 'dotenv/config'
export const JWT = {
  SECRET: process.env.JWT_SECRET
};

export const SUPABASE = {
  KEY : process.env.SUPABASE_KEY,
  URL : 'https://uyzqigelvhjkopoyrcft.supabase.co'
}

export const LOG_CONFIG = {
  LEVEL: process.env.LOG_LEVEL || 'info',
  PRETTY_PRINT: true,
  REDACT: ['req.headers.authorization', 'res.headers.authorization'],
}

export const EMAIL = {
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  FROM: process.env.EMAIL_FROM || 'noreply@re-conecta.com'
}

export const TWILIO = {
  SID: process.env.TWILIO_SID,
  TOKEN: process.env.TWILIO_TOKEN,
  WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER
}

export const ZOOM = {
  API_KEY: process.env.ZOOM_API_KEY,
  API_SECRET: process.env.ZOOM_API_SECRET
}

export default { JWT, SUPABASE, LOG_CONFIG, ZOOM, EMAIL, TWILIO };