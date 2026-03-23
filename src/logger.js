import pino from "pino";
import { LOG_CONFIG } from "./config.js";
const isDev = process.env.NODE_ENV !== "production";
const {LEVEL, PRETTY_PRINT} = LOG_CONFIG;

const logger = pino({
  level: LEVEL || "info",
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:dd/mm/yyyy HH:MM:ss.l",
          ignore: "pid,hostname",
          singleLine: false,
          messageFormat: '{msg}',
        },
      }
    : undefined, // en producción genera JSON estructurado
});

export default logger;