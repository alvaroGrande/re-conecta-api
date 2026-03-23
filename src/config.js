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

export const ZOOM = { 
  SDK_KEY: process.env.ZOOM_SDK_KEY,
  SDK_SECRET: process.env.ZOOM_SDK_SECRET,
  ACCOUNT_ID: process.env.ZOOM_ACCOUNT_ID,
  CLIENT_ID: process.env.ZOOM_CLIENT_ID,
  CLIENT_SECRET: process.env.ZOOM_CLIENT_SECRET,
  API_URL: 'https://api.zoom.us/v2'
}

export default { JWT, SUPABASE, LOG_CONFIG, ZOOM };